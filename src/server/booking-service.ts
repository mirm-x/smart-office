import { PoolClient } from "pg";
import { db } from "@/lib/db";
import {
  ClaimPeriod,
  Period,
  canCheckInSameDay,
  claimsForPeriod,
  claimWindow,
  isWorkingDate,
  isWithinBookingHorizon,
} from "./booking-policy";

export type ResourceType = "desk" | "parking";

export interface CreateBookingInput {
  employeeExternalId: string;
  workDate: string; // YYYY-MM-DD, office-local
  period: Period;
  resourceTypes: ResourceType[]; // ["desk"], ["parking"], or both -- combined request is atomic
  // Optional specific resources to book (one id per requested type), chosen from
  // the floor map. When omitted for a type, a free resource of that type is
  // auto-assigned (the original behaviour). A specifically requested resource
  // that is no longer free yields `resource_taken` rather than a silent
  // reassignment.
  resourceIds?: string[];
}

export interface AssignedResource {
  type: ResourceType;
  label: string;
}

export type CreateBookingResult =
  | { ok: true; requestId: string; claimIds: string[]; resources: AssignedResource[] }
  | {
      ok: false;
      reason:
        | "invalid_date"
        | "no_resource_available"
        | "resource_taken"
        | "already_booked"
        | "conflict"
        | "unknown_employee"
        | "half_day_not_enabled"
        | "checkin_window_closed";
    };

const UNIQUE_VIOLATION = "23505";

// Reviewed plan section 2/6: half-day booking is a proposed amendment to the
// spec's day-only BR-01, pending a written facilitator decision (see
// docs/decisions/README.md#decision-0001-half-day-booking-policy). The POC demo enables the
// proposed periods without claiming client acceptance. Setting the flag false
// returns to the original full-day-only flow with no data-model change -- a
// full-day request already claims both halves.
const HALF_DAY_BOOKING_ENABLED = process.env.HALF_DAY_BOOKING_ENABLED === "true";

/**
 * Creates a booking request and one claim per (resource, half-day period).
 * Desk + parking requested together succeed or fail together (plan section 2,
 * "Both bookings succeed or neither does") via a single DB transaction; the
 * unique partial indexes on booking_claims turn a losing race into a clean
 * conflict response rather than a corrupted double-booking (acceptance
 * criterion: booking #3).
 */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  if (!isWorkingDate(input.workDate) || !isWithinBookingHorizon(input.workDate)) {
    return { ok: false, reason: "invalid_date" };
  }
  if (input.resourceTypes.length === 0) {
    return { ok: false, reason: "no_resource_available" };
  }
  if (!HALF_DAY_BOOKING_ENABLED && input.period !== "full_day") {
    return { ok: false, reason: "half_day_not_enabled" };
  }
  // A same-day booking whose check-in window has already closed could never
  // be checked in and would only be released as a no-show (plan section 2,
  // "Bookings after a check-in deadline"). "Book and check in now" is part of
  // the same pending facilitator decision, so until it lands the API rejects
  // dead same-day bookings instead of creating them.
  if (!canCheckInSameDay(input.workDate, input.period)) {
    return { ok: false, reason: "checkin_window_closed" };
  }

  const client = await db.connect();
  try {
    await client.query("begin");

    const employee = await client.query<{ id: string }>(
      "select id from employees where external_id = $1 and active = true",
      [input.employeeExternalId]
    );
    if (employee.rowCount === 0) {
      await client.query("rollback");
      return { ok: false, reason: "unknown_employee" };
    }
    const employeeId = employee.rows[0]!.id;

    const request = await client.query<{ id: string }>(
      "insert into booking_requests (employee_id, work_date, period) values ($1, $2, $3) returning id",
      [employeeId, input.workDate, input.period]
    );
    const requestId = request.rows[0]!.id;

    const claimPeriods = claimsForPeriod(input.period);

    // Friendly pre-check: this employee may hold only one claim per
    // (resource_type, date, period) -- enforced by the
    // booking_claims_employee_active_period unique index. Without this check a
    // second booking for a slot the employee already holds would surface as a
    // generic `conflict` ("that space was just taken"), which is misleading
    // because the space isn't the problem -- they already booked it. Detect it
    // up front and return a precise reason. The unique index remains the
    // race-safe backstop.
    const already = await client.query<{ resource_type: ResourceType }>(
      `select distinct resource_type
         from booking_claims
        where employee_id = $1
          and work_date = $2
          and period = any($3::text[])
          and resource_type = any($4::text[])
          and status in ('reserved', 'checked_in')`,
      [employeeId, input.workDate, claimPeriods, input.resourceTypes]
    );
    if (already.rowCount && already.rowCount > 0) {
      await client.query("rollback");
      return { ok: false, reason: "already_booked" };
    }

    // Resolve each selected space to one active resource of the requested type.
    // A stale or invalid selection must not silently turn into auto-assignment.
    const targetIdByType = new Map<ResourceType, string>();
    if (input.resourceIds && input.resourceIds.length > 0) {
      const requested = await client.query<{ id: string; type: ResourceType }>(
        "select id, type from resources where id = any($1::uuid[]) and status = 'active'",
        [input.resourceIds]
      );
      for (const row of requested.rows) {
        if (!input.resourceTypes.includes(row.type) || targetIdByType.has(row.type)) {
          await client.query("rollback");
          return { ok: false, reason: "resource_taken" };
        }
        targetIdByType.set(row.type, row.id);
      }
      if (targetIdByType.size !== input.resourceIds.length) {
        await client.query("rollback");
        return { ok: false, reason: "resource_taken" };
      }
    }

    const claimIds: string[] = [];
    const resources: AssignedResource[] = [];
    for (const resourceType of input.resourceTypes) {
      const targetId = targetIdByType.get(resourceType) ?? null;
      const resource = await pickAvailableResource(client, resourceType, input.workDate, claimPeriods, targetId);
      if (!resource) {
        await client.query("rollback");
        // A specific pick that is gone reads differently from "the office is
        // full" -- the UI tells the user their chosen space was just taken.
        return { ok: false, reason: targetId ? "resource_taken" : "no_resource_available" };
      }

      for (const claimPeriod of claimPeriods) {
        const { checkinWindowOpensAt, checkinDeadlineAt } = claimWindow(input.workDate, claimPeriod);
        const claim = await client.query<{ id: string }>(
          `insert into booking_claims
             (request_id, employee_id, resource_id, resource_type, work_date, period,
              checkin_window_opens_at, checkin_deadline)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           returning id`,
          [requestId, employeeId, resource.id, resourceType, input.workDate, claimPeriod, checkinWindowOpensAt, checkinDeadlineAt]
        );
        claimIds.push(claim.rows[0]!.id);
      }
      resources.push({ type: resourceType, label: resource.label });
    }

    await client.query("commit");
    return { ok: true, requestId, claimIds, resources };
  } catch (err: unknown) {
    await client.query("rollback");
    if (isUniqueViolation(err)) {
      return { ok: false, reason: "conflict" };
    }
    throw err;
  } finally {
    client.release();
  }
}

// POC resource picker: an active resource of the requested type with no active
// claim for any of the requested half-day periods on this date. When
// `targetId` is given (the employee picked a specific space on the floor map)
// the candidate is constrained to that resource, so a taken pick returns no row
// (surfaced as `resource_taken`) instead of silently reassigning. Otherwise the
// first free resource by label is auto-assigned.
// `for update skip locked` serializes concurrent requests against the same
// candidate rows; the unique partial indexes on booking_claims are the final
// safety net for the remaining race window (acceptance criterion: booking #3).
// Real allocation strategy (preferred desk, team clustering, etc.) is
// full-delivery scope.
async function pickAvailableResource(
  client: PoolClient,
  resourceType: ResourceType,
  workDate: string,
  claimPeriods: string[],
  targetId: string | null = null
) {
  const result = await client.query<{ id: string; label: string }>(
    `select r.id, r.label
       from resources r
      where r.type = $1
        and r.status = 'active'
        and ($4::uuid is null or r.id = $4::uuid)
        and not exists (
          select 1
            from booking_claims bc
           where bc.resource_id = r.id
             and bc.work_date = $2
             and bc.period = any($3::text[])
             and bc.status in ('reserved', 'checked_in')
        )
      order by r.label
      for update of r skip locked
      limit 1`,
    [resourceType, workDate, claimPeriods, targetId]
  );
  return result.rows[0] ?? null;
}

export type CheckInResult =
  | { ok: true; claimIds: string[]; alreadyCheckedIn: boolean }
  | { ok: false; reason: "not_found" | "not_owner" | "too_early" | "too_late" | "already_released" | "already_cancelled" };

interface ClaimRow {
  id: string;
  period: ClaimPeriod;
  status: string;
  checkin_window_opens_at: Date;
  checkin_deadline: Date;
  employee_id: string;
}

/**
 * Checks in every claim belonging to one (request, resource) pair -- i.e. one
 * half-day or the two halves of one full-day booking for one resource. Desk
 * and parking claims under the same request are independent (acceptance
 * criterion: check-in #5), so they are checked in with separate calls.
 * Idempotent: repeating an already-accepted check-in is a no-op, and a claim
 * that was already released can never be checked in again (criterion #6).
 */
export async function checkIn(
  requestId: string,
  resourceType: ResourceType,
  employeeExternalId: string
): Promise<CheckInResult> {
  const client = await db.connect();
  try {
    await client.query("begin");

    const employee = await client.query<{ id: string }>(
      "select id from employees where external_id = $1 and active = true",
      [employeeExternalId]
    );
    if (employee.rowCount === 0) {
      await client.query("rollback");
      return { ok: false, reason: "not_owner" };
    }
    const employeeId = employee.rows[0]!.id;

    const claims = await client.query<ClaimRow>(
      `select id, period, status, checkin_window_opens_at, checkin_deadline, employee_id
         from booking_claims
        where request_id = $1 and resource_type = $2
        for update`,
      [requestId, resourceType]
    );
    if (claims.rowCount === 0) {
      await client.query("rollback");
      return { ok: false, reason: "not_found" };
    }
    // The employee identity comes from the signed session set by the
    // simulated sign-in route; the API never trusts a client-passed id
    // (criterion #3).
    if (claims.rows[0]!.employee_id !== employeeId) {
      await client.query("rollback");
      return { ok: false, reason: "not_owner" };
    }

    if (claims.rows.every((c) => c.status === "checked_in")) {
      await client.query("commit");
      return { ok: true, claimIds: claims.rows.map((c) => c.id), alreadyCheckedIn: true };
    }
    if (claims.rows.some((c) => c.status === "cancelled")) {
      await client.query("rollback");
      return { ok: false, reason: "already_cancelled" };
    }
    if (claims.rows.some((c) => c.status === "released")) {
      await client.query("rollback");
      return { ok: false, reason: "already_released" };
    }

    // Full-day check-in is anchored on the earlier (morning) window and then covers both halves.
    const anchor = claims.rows.reduce((a, b) => (a.checkin_window_opens_at < b.checkin_window_opens_at ? a : b));
    const now = new Date();
    if (now < anchor.checkin_window_opens_at) {
      await client.query("rollback");
      return { ok: false, reason: "too_early" };
    }
    if (now >= anchor.checkin_deadline) {
      await client.query("rollback");
      return { ok: false, reason: "too_late" };
    }

    const claimIds: string[] = [];
    for (const c of claims.rows) {
      await client.query("update booking_claims set status = 'checked_in', checked_in_at = $1 where id = $2", [now, c.id]);
      await client.query(
        "insert into audit_log (claim_id, event, actor, details) values ($1, 'checked_in', $2, $3::jsonb)",
        [c.id, employeeExternalId, JSON.stringify({ request_id: requestId })]
      );
      claimIds.push(c.id);
    }

    await client.query("commit");
    return { ok: true, claimIds, alreadyCheckedIn: false };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export type CancelBookingResult =
  | { ok: true; claimIds: string[]; alreadyCancelled: boolean }
  | { ok: false; reason: "not_found" | "not_owner" | "already_checked_in" | "already_released" };

interface CancellationClaimRow {
  id: string;
  status: "reserved" | "checked_in" | "released" | "cancelled";
  employee_id: string;
}

export async function cancelBooking(
  requestId: string,
  resourceType: ResourceType,
  employeeExternalId: string
): Promise<CancelBookingResult> {
  const client = await db.connect();
  try {
    await client.query("begin");

    const employee = await client.query<{ id: string }>(
      "select id from employees where external_id = $1 and active = true",
      [employeeExternalId]
    );
    if (employee.rowCount === 0) {
      await client.query("rollback");
      return { ok: false, reason: "not_owner" };
    }

    // Lock both halves of this resource before changing either one.
    const claims = await client.query<CancellationClaimRow>(
      `select id, status, employee_id
         from booking_claims
        where request_id = $1 and resource_type = $2
        for update`,
      [requestId, resourceType]
    );
    if (claims.rowCount === 0) {
      await client.query("rollback");
      return { ok: false, reason: "not_found" };
    }
    if (claims.rows.some((claim) => claim.employee_id !== employee.rows[0]!.id)) {
      await client.query("rollback");
      return { ok: false, reason: "not_owner" };
    }
    if (claims.rows.some((claim) => claim.status === "checked_in")) {
      await client.query("rollback");
      return { ok: false, reason: "already_checked_in" };
    }

    const reserved = claims.rows.filter((claim) => claim.status === "reserved");
    if (reserved.length === 0) {
      if (claims.rows.every((claim) => claim.status === "cancelled")) {
        await client.query("commit");
        return { ok: true, claimIds: claims.rows.map((claim) => claim.id), alreadyCancelled: true };
      }
      await client.query("rollback");
      return { ok: false, reason: "already_released" };
    }

    for (const claim of reserved) {
      await client.query("update booking_claims set status = 'cancelled' where id = $1", [claim.id]);
      await client.query(
        "insert into audit_log (claim_id, event, actor, details) values ($1, 'cancelled', $2, $3::jsonb)",
        [claim.id, employeeExternalId, JSON.stringify({ request_id: requestId, resource_type: resourceType })]
      );
    }

    await client.query("commit");
    return { ok: true, claimIds: reserved.map((claim) => claim.id), alreadyCancelled: false };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === UNIQUE_VIOLATION;
}
