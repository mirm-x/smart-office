# POC scope: what "done" means for the camp

Source: Reviewed plan, section 3 ("Camp acceptance: the short list"). This is
the tiering to check against before adding anything new -- if a change doesn't
serve tier 1 or 2, it's tier 3 or out of scope for the camp.

**Once tier 1 and tier 2 pass, freeze the POC and spend the remaining time on
evidence, the recording and the client proposal.**

## Tier 1 -- must demonstrate by Day 2

1. **Booking (FR-03):** book a desk, a parking space, or both, for a suitable
   date. If half-day is approved: morning/afternoon/full-day choice, morning
   and afternoon can coexist, full day conflicts with either. If declined:
   full-day booking only. Confirmation shows date, period, resource, status.
2. **Check-in (FR-08):** the booking owner checks in during the approved
   window; a timely check-in protects the booking for its period. Desk and
   parking check-ins are independent.
3. **Automatic release (FR-09):** the worker releases a no-show at the
   approved deadline. If immediate same-day rebooking is approved, a second
   employee books via "Book and check in now"; otherwise show the released
   status and the next allowed booking. A timely check-in is never released.

## Tier 2 -- focused checks before making those claims

1. Two concurrent requests for the same resource/period: one success, one
   conflict, enforced by the database (`booking_claims` unique partial
   indexes -- see `db/migrations/0001_init.sql`).
2. One employee cannot hold two active desks or two active parking spaces in
   an overlapping period (non-overlapping half-days are fine if approved).
3. A combined desk+parking request creates both bookings or neither.
4. A check-in exactly at/after the deadline is rejected; another employee
   cannot check in to a booking they don't own; a late event never restores a
   released booking.
5. Repeating the release worker produces no second state change or audit
   entry; a checked-in full-day booking stays protected for both halves.

## Tier 3 -- follow-up for full delivery, or camp stretch work only after tier 1+2 are safe

- Polished "remaining day" wording; repeated-request handling after ambiguous
  network responses.
- Worker restart recovery and a direct check-in-vs-release race test.
- Sensor-occupied exception screens, stale-reading handling, false-reading
  correction.
- Wider time-zone/holiday tests, full administration and notification paths.

## Where each tier lives in this repo

| Tier item | Code |
|---|---|
| Booking, combined desk+parking, conflict handling | `src/server/booking-service.ts` (`createBooking`) |
| Check-in, ownership, idempotency | `src/server/booking-service.ts` (`checkIn`) |
| Automatic release, exception flag on occupied-after-release | `worker/release-worker.ts` |
| Half-day windows / full-day fallback | `src/server/booking-policy.ts`, `HALF_DAY_BOOKING_ENABLED` in `.env.example` |
