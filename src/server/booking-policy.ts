import { DateTime } from "luxon";

// Encodes the booking table from plan section 2 ("Booking policy for the
// proposal"). This is the proposed amendment to the spec's day-only BR-01 /
// BR-02 rules and MUST be confirmed with a facilitator acting as the client
// before it is treated as final -- see docs/decisions/0001-half-day-booking-policy.md.

export type Period = "morning" | "afternoon" | "full_day";
export type ClaimPeriod = "morning" | "afternoon";

export const OFFICE_TIME_ZONE = process.env.OFFICE_TIME_ZONE || "Europe/Belgrade";

interface PeriodWindow {
  /** Half-days this period claims a resource for. */
  claims: ClaimPeriod[];
  reservedStart: string; // HH:mm office-local
  reservedEnd: string; // HH:mm office-local
  checkinWindowOpens: string; // HH:mm office-local
  checkinDeadline: string; // HH:mm office-local, exclusive ("until before")
}

const PERIOD_WINDOWS: Record<Period, PeriodWindow> = {
  morning: {
    claims: ["morning"],
    reservedStart: "09:00",
    reservedEnd: "13:00",
    checkinWindowOpens: "09:00",
    checkinDeadline: "10:00",
  },
  afternoon: {
    claims: ["afternoon"],
    reservedStart: "13:00",
    reservedEnd: "17:00",
    checkinWindowOpens: "13:00",
    checkinDeadline: "14:00",
  },
  full_day: {
    claims: ["morning", "afternoon"],
    reservedStart: "09:00",
    reservedEnd: "17:00",
    checkinWindowOpens: "09:00",
    checkinDeadline: "10:00",
  },
};

// Each half-day claim keeps its own check-in window/deadline, even when it
// was created by a full-day request (a full-day check-in protects both, see
// acceptance criteria, but each claim can still be released independently).
const CLAIM_WINDOWS: Record<ClaimPeriod, Pick<PeriodWindow, "checkinWindowOpens" | "checkinDeadline">> = {
  morning: { checkinWindowOpens: "09:00", checkinDeadline: "10:00" },
  afternoon: { checkinWindowOpens: "13:00", checkinDeadline: "14:00" },
};

export const MAX_BOOKING_HORIZON_DAYS = 14;

function localInstant(workDate: string, hhmm: string): DateTime {
  const [hour, minute] = hhmm.split(":").map(Number);
  return DateTime.fromISO(workDate, { zone: OFFICE_TIME_ZONE }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
}

export function claimsForPeriod(period: Period): ClaimPeriod[] {
  return PERIOD_WINDOWS[period].claims;
}

/** Check-in window and no-show release deadline for one half-day claim, as UTC instants. */
export function claimWindow(workDate: string, claimPeriod: ClaimPeriod) {
  const w = CLAIM_WINDOWS[claimPeriod];
  return {
    checkinWindowOpensAt: localInstant(workDate, w.checkinWindowOpens).toUTC().toJSDate(),
    checkinDeadlineAt: localInstant(workDate, w.checkinDeadline).toUTC().toJSDate(),
  };
}

/** True when a booking for `period` on `workDate` would still be check-in-able
 * on the day itself: once the period's check-in deadline has passed, a same-day
 * booking would be released as a no-show before it could ever be checked in
 * (plan section 2, "Bookings after a check-in deadline"). Future dates are
 * always allowed; the earliest claim anchors the check (morning for full_day). */
export function canCheckInSameDay(
  workDate: string,
  period: Period,
  now: DateTime = DateTime.now().setZone(OFFICE_TIME_ZONE)
): boolean {
  const dt = DateTime.fromISO(workDate, { zone: OFFICE_TIME_ZONE });
  if (!dt.isValid || !dt.hasSame(now, "day")) return true;
  const anchor = claimsForPeriod(period)[0] ?? "morning";
  const { checkinDeadlineAt } = claimWindow(workDate, anchor);
  return now.toJSDate() < checkinDeadlineAt;
}

export function isWorkingDate(workDate: string): boolean {
  const dt = DateTime.fromISO(workDate, { zone: OFFICE_TIME_ZONE });
  return dt.isValid && dt.weekday >= 1 && dt.weekday <= 5; // Mon-Fri, per POC calendar
}

export function isWithinBookingHorizon(workDate: string, now: DateTime = DateTime.now().setZone(OFFICE_TIME_ZONE)): boolean {
  const dt = DateTime.fromISO(workDate, { zone: OFFICE_TIME_ZONE });
  if (!dt.isValid) return false;
  const daysAhead = dt.startOf("day").diff(now.startOf("day"), "days").days;
  return daysAhead >= 0 && daysAhead <= MAX_BOOKING_HORIZON_DAYS;
}
