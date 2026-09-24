import { db } from "@/lib/db";
import { Period, claimsForPeriod, isWorkingDate, isWithinBookingHorizon } from "./booking-policy";
import { ResourceType } from "./booking-service";

// Read model for the tier-1 UI (FR-03 / FR-08 display). Read-only queries that
// back the Book screen's availability hint and the My bookings list; every
// booking mutation still goes through booking-service.ts.

export type ClaimStatus = "reserved" | "checked_in" | "released" | "cancelled";

export interface BookingItem {
  requestId: string;
  resourceType: ResourceType;
  resourceLabel: string;
  workDate: string; // YYYY-MM-DD, office-local
  period: Period;
  status: ClaimStatus;
  checkinWindowOpensAt: string; // ISO instant (earliest claim in the group)
  checkinDeadlineAt: string; // ISO instant (earliest claim in the group)
}

interface ClaimQueryRow {
  request_id: string;
  resource_type: ResourceType;
  resource_label: string;
  work_date: string;
  request_period: Period;
  status: ClaimStatus;
  checkin_window_opens_at: Date;
  checkin_deadline: Date;
}

// Priority for collapsing a full-day booking's two half-day claims into one
// display status: an actionable "reserved" wins, then checked_in, then the
// terminal states -- so the row shows the state the employee can still act on.
const STATUS_PRIORITY: Record<ClaimStatus, number> = {
  reserved: 0,
  checked_in: 1,
  released: 2,
  cancelled: 3,
};

/**
 * Lists an employee's bookings, one row per (request, resource). A full-day
 * booking has two half-day claims; they are collapsed into one item whose
 * check-in window is anchored on the earlier (morning) half, matching
 * booking-service.checkIn.
 */
export async function listEmployeeBookings(employeeExternalId: string): Promise<BookingItem[]> {
  const result = await db.query<ClaimQueryRow>(
    `select bc.request_id,
            bc.resource_type,
            r.label as resource_label,
            to_char(bc.work_date, 'YYYY-MM-DD') as work_date,
            br.period as request_period,
            bc.status,
            bc.checkin_window_opens_at,
            bc.checkin_deadline
       from booking_claims bc
       join booking_requests br on br.id = bc.request_id
       join resources r on r.id = bc.resource_id
       join employees e on e.id = bc.employee_id
      where e.external_id = $1
      order by bc.work_date desc, bc.checkin_window_opens_at asc`,
    [employeeExternalId]
  );

  const groups = new Map<string, BookingItem>();
  for (const row of result.rows) {
    const key = `${row.request_id}:${row.resource_type}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        requestId: row.request_id,
        resourceType: row.resource_type,
        resourceLabel: row.resource_label,
        workDate: row.work_date,
        period: row.request_period,
        status: row.status,
        checkinWindowOpensAt: row.checkin_window_opens_at.toISOString(),
        checkinDeadlineAt: row.checkin_deadline.toISOString(),
      });
      continue;
    }
    if (STATUS_PRIORITY[row.status] < STATUS_PRIORITY[existing.status]) {
      existing.status = row.status;
    }
    if (row.checkin_window_opens_at.toISOString() < existing.checkinWindowOpensAt) {
      existing.checkinWindowOpensAt = row.checkin_window_opens_at.toISOString();
    }
    if (row.checkin_deadline.toISOString() < existing.checkinDeadlineAt) {
      existing.checkinDeadlineAt = row.checkin_deadline.toISOString();
    }
  }

  return [...groups.values()];
}

export interface ResourceAvailability {
  id: string;
  type: ResourceType;
  label: string;
  free: boolean;
  mine: boolean;
}

export interface AvailabilityResult {
  workDate: string;
  period: Period;
  desk: number;
  parking: number;
  resources: ResourceAvailability[];
}

/**
 * Per-resource free/taken status for a date + period, plus free counts by type.
 * A resource is free when it has no reserved/checked-in claim for any half-day
 * period the requested `period` occupies. When `employeeExternalId` is given,
 * `mine` marks the resources that same employee already holds for the slot, so
 * the floor map can colour them distinctly from spaces taken by others. Backs
 * the Book screen availability hero and floor map; authoritative allocation
 * still happens in booking-service.createBooking. Returns null for a
 * non-bookable date.
 */
export async function getAvailability(
  workDate: string,
  period: Period,
  employeeExternalId?: string
): Promise<AvailabilityResult | null> {
  if (!isWorkingDate(workDate) || !isWithinBookingHorizon(workDate)) {
    return null;
  }
  const claimPeriods = claimsForPeriod(period);
  const res = await db.query<{ id: string; type: ResourceType; label: string; free: boolean; mine: boolean }>(
    `select r.id,
            r.type,
            r.label,
            not exists (
              select 1 from booking_claims bc
               where bc.resource_id = r.id
                 and bc.work_date = $1
                 and bc.period = any($2::text[])
                 and bc.status in ('reserved', 'checked_in')
            ) as free,
            exists (
              select 1 from booking_claims bc
               join employees e on e.id = bc.employee_id
               where bc.resource_id = r.id
                 and bc.work_date = $1
                 and bc.period = any($2::text[])
                 and bc.status in ('reserved', 'checked_in')
                 and $3::text is not null
                 and e.external_id = $3::text
            ) as mine
       from resources r
      where r.status = 'active'
      order by r.type, r.label`,
    [workDate, claimPeriods, employeeExternalId ?? null]
  );

  const resources: ResourceAvailability[] = res.rows.map((row) => ({
    id: row.id,
    type: row.type,
    label: row.label,
    free: row.free,
    mine: row.mine,
  }));
  const desk = resources.filter((r) => r.type === "desk" && r.free).length;
  const parking = resources.filter((r) => r.type === "parking" && r.free).length;
  return { workDate, period, desk, parking, resources };
}
