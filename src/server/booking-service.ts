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
        | "conflict"
        | "unknown_employee"
        | "half_day_not_enabled"
        | "checkin_window_closed";
    };

const UNIQUE_VIOLATION = "23505";

// Reviewed plan section 2/6: half-day booking is a proposed amendment to the
// spec's day-only BR-01, pending a written facilitator decision (see
// docs/decisions/0001-half-day-booking-policy.md). Until that decision is
// recorded as accepted, keep this false and the API falls back to the
// original full-day-only flow with no data-model change -- a full-day
// request already claims both halves, so the fallback needs no rework.
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

    const claimIds: string[] = [];
    const resources: AssignedResource[] = [];
    for (const resourceType of input.resourceTypes) {
      const resource = await pickAvailableResource(client, resourceType, input.workDate, claimPeriods);
      if (!resource) {
        await client.query("rollback");
        return { ok: false, reason: "no_resource_available" };
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

// POC resource picker: first active resource of the requested type that has
// no active claim for any of the requested half-day periods on this date.
// `for update skip locked` serializes concurrent requests against the same
// candidate rows; the unique partial indexes on booking_claims are the final
// safety net for the remaining race window (acceptance criterion: booking #3).
// Real allocation strategy (preferred desk, team clustering, etc.) is
// full-delivery scope.
async function pickAvailableResource(
  client: PoolClient,
  resourceType: ResourceType,
  workDate: string,
  claimPeriods: string[]
) {
  const result = await client.query<{ id: string; label: string }>(
    `select r.id, r.label
       from resources r
      where r.type = $1
        and r.status = 'active'
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
    [resourceType, workDate, claimPeriods]
  );
  return result.rows[0] ?? null;
}

export type CheckInResult =
  | { ok: true; claimIds: string[]; alreadyCheckedIn: boolean }
  | { ok: false; reason: "not_found" | "not_owner" | "too_early" | "too_late" | "already_released" };

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
    if (claims.rows.some((c) => c.status === "released" || c.status === "cancelled")) {
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

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === UNIQUE_VIOLATION;
}
