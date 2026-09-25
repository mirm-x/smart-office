# Smart Office POC

ZRS Camp 2026 Smart Office Challenge -- desk & parking booking POC.
Demonstrates **book -> check in -> automatic no-show release** (FR-03, FR-08,
FR-09). Same-day rebooking after a check-in deadline needs a facilitator
decision; until then, the API offers only periods whose check-in window is open.

See `ZRS_Camp_2026_Smart_Office_Reviewed_Plan.md` for the full story, policy
table and presentation outline, `docs/poc-scope.md` for what "done" means for
the camp, `docs/proposal/` for the client proposal drafts, and `AGENTS.md`
for the Agentic SDLC this repo follows.

## Status

The booking and My bookings screens, booking/check-in/cancellation service and no-show
release worker are implemented. The POC demo enables morning, afternoon and
full-day booking, but this change to BR-01/BR-02 is **pending a written
facilitator decision** (`docs/decisions/0001-half-day-booking-policy.md`).
Set `HALF_DAY_BOOKING_ENABLED=false` to show the original full-day-only rule.
The conversational assistant and sensor/LED
simulation remain future work; check new work against `docs/poc-scope.md`.

## Stack

Next.js (App Router) + TypeScript, PostgreSQL via `pg`, a standalone release
worker script. No ORM -- plain SQL migrations in `db/migrations/`.

## Run locally

```bash
cp .env.example .env        # adjust if needed

docker compose up -d        # starts Postgres on localhost:5432
npm install
npm run db:migrate          # applies db/migrations/*.sql, including seed data

npm run dev                 # Next.js app on http://localhost:3000
npm run worker              # in a second terminal: automatic release worker
npm test                    # focused cancellation checks, no database needed
```

## Try the API

```bash
# Simulated sign-in (labelled simulated; full delivery uses Entra): sets a
# signed session cookie that the check-in API trusts for ownership.
curl -s localhost:3000/api/auth/login -X POST -H 'content-type: application/json' \
  -d '{"employeeExternalId": "emp-alice"}' -c /tmp/so-cookies.txt

# Book a desk and a parking space for a future weekday, full day.
# Use a date within the next 14 days; the employee comes from the session cookie.
curl -s localhost:3000/api/bookings -X POST -H 'content-type: application/json' -b /tmp/so-cookies.txt -d '{
  "workDate": "2026-09-28",
  "period": "full_day",
  "resourceTypes": ["desk", "parking"]
}'

# Check in the desk resource (both halves of a full-day desk booking).
# The employee is taken from the session cookie, not the request body.
curl -s localhost:3000/api/bookings/<requestId>/checkin -X POST -H 'content-type: application/json' \
  -b /tmp/so-cookies.txt -d '{"resourceType": "desk"}'
```

Leave parking unchecked and watch `npm run worker` release it after its
deadline (`checkin_deadline` in `booking_claims`). For a live demo, arrange
test data with a near-term deadline instead of waiting for the 10:00/14:00
policy cutoffs. A released space can be booked in a later open period; booking
and checking in during the same period after its deadline is pending the
facilitator decision.

To demonstrate the release without waiting until 10:00 or 14:00, use the
**local synthetic demo helper**:

```bash
npm run worker                         # separate terminal; polls every 15 seconds
npm run demo:scenario -- prepare       # creates Alice's desk + parking booking
# Or book both in the UI as emp-alice, then run:
npm run demo:scenario -- arm-latest
npm run demo:scenario -- status <request-id>
```

The helper opens a simulated three-minute check-in window for one future
booking. Sign in as `emp-alice`, check in the desk, and leave parking unchecked.
After the deadline, refresh **My bookings**: the desk stays **Checked in** and
parking becomes **Released**. Sign in as `emp-bob` to book the freed parking
space for the same future date and period. Explain that this is an accelerated
synthetic demo window. The helper only accepts a loopback PostgreSQL database
outside production, and the normal policy deadlines are unchanged.
Run `npm run demo:scenario -- help` for all commands.

To try cancellation instead, find a reserved desk or parking row in **My
bookings**, then select **Cancel booking** and confirm. The other resource in a combined
request stays booked. A checked-in booking cannot be cancelled in this POC.

## Project structure

```
src/app/                Next.js routes (pages + API)
src/server/             Booking policy and booking/check-in service (core domain logic)
src/lib/db.ts           Shared PostgreSQL pool
worker/release-worker.ts Automatic no-show release loop
db/migrations/           Schema + seed data, applied by db/migrate.ts
docs/decisions/          Decisions that amend the source specification
docs/design/             UI/UX design spec (Figma-ready) for the tier-1 journey
docs/proposal/           Client proposal drafts (value, architecture, delivery, team, timeline, price)
AGENTS.md                 Agent workflow, roles and ground rules for this repo
```
