# Decision 0001: Half-day booking policy (morning / afternoon / full day)

**Status:** Proposed -- pending a **written** facilitator decision (reviewed plan section 2/6, "the first decision"). Get this before the team commits further to the segment-based data model; setup and client-story work continue in the meantime.

## Questions to put to the facilitator (ask together, one written decision)

1. Does half-day booking **replace** the spec's day-only rule, or **extend** it as an additional choice?
2. Do the one-desk / one-parking-space employee limits (BR-02) apply **per overlapping period**, or does the original daily limit still hold?
3. Is **"Book and check in now"** (immediate same-day rebooking of a released space) acceptable? This is required for the same-day rebooking demonstration.

## If declined

Build the original full-day-only flow instead. No data-model rework is needed:
a full-day request in this schema already claims both the morning and
afternoon halves, so declining the amendment is just `HALF_DAY_BOOKING_ENABLED=false`
(see `.env.example` and `src/server/booking-service.ts`) -- the API then
rejects morning/afternoon requests and only accepts full-day ones. Update the
commercial slide to the fallback estimate: **265 base + 53 contingency = 318
person-days, €254,400** (reviewed plan section 7), and present half-day
booking as a separately scoped future option rather than a built feature.

## Brief

The supplied specification's BR-01 (day-only booking) and BR-02 (daily employee
limit) assume a single working-day granularity. The team's plan proposes
splitting each working day into a morning (09:00-13:00) and afternoon
(13:00-17:00) claim, with a full-day option claiming both, to better match
uneven weekly demand and to make the no-show release story (the client's
central pain point) demonstrable within a working day rather than only
overnight.

## Rule

See the booking policy table in the plan (section 2) and its implementation in
`src/server/booking-policy.ts` and `db/migrations/0001_init.sql`:

- Three booking choices: morning, afternoon, full day.
- Independent check-in windows and no-show deadlines per half-day.
- One employee may hold one desk and one parking space per overlapping period.
- A desk + parking request for the same date/period is atomic.

## Why it deviates from spec

BR-01 and BR-02 describe day-only booking and a single daily limit. This
change is intentional and must be presented to the client (a facilitator, in
the camp) as an amendment, not assumed accepted.

## Acceptance trail (fill in during the camp)

| Step | Artifact | Owner | Status |
|---|---|---|---|
| Agent refinement of the brief | | | |
| Human acceptance criteria | plan section 3, "Acceptance criteria: booking/check-in/automatic release" | Product/proposal lead | Drafted |
| Agent implementation plan | | | |
| Human design approval | | Technical lead | |
| Implementation | `src/server/booking-policy.ts`, `db/migrations/0001_init.sql`, `src/server/booking-service.ts` | Backend engineer | Scaffolded |
| Independent check/review | | QA/evidence lead | |
| Facilitator (client) acceptance | | Product/proposal lead | Pending |

Keep this table current -- it is the "one real example" the presentation
(slide 6) and the jury Q&A should point to.
