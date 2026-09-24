# Smart Office POC

ZRS Camp 2026 Smart Office Challenge -- desk & parking booking POC.
Demonstrates one journey: **book -> check in -> automatic no-show release ->
rebook**, for morning / afternoon / full-day periods (FR-03, FR-08, FR-09).

See `ZRS_Camp_2026_Smart_Office_Reviewed_Plan.md` for the full story, policy
table and presentation outline, `docs/poc-scope.md` for what "done" means for
the camp, `docs/proposal/` for the client proposal drafts, and `AGENTS.md`
for the Agentic SDLC this repo follows.

## Status

This is a starting scaffold: data model, a booking-creation service (atomic
desk+parking, conflict-safe) and a check-in service are implemented, and the
release worker runs. Half-day booking is still **pending a written
facilitator decision** (`docs/decisions/0001-half-day-booking-policy.md`) --
until then, treat `HALF_DAY_BOOKING_ENABLED` as unresolved rather than
assuming it stays on. The conversational assistant, sensor/LED simulation and
UI are stubs or TODO -- build these out during the camp per `AGENTS.md`, and
check new work against `docs/poc-scope.md` before starting it.

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
```

## Try the API

```bash
# Book a desk and a parking space for a future weekday, full day
curl -s localhost:3000/api/bookings -X POST -H 'content-type: application/json' -d '{
  "employeeExternalId": "emp-alice",
  "workDate": "2026-09-28",
  "period": "full_day",
  "resourceTypes": ["desk", "parking"]
}'

# Check in the desk half of that booking (use the requestId from the response above)
curl -s localhost:3000/api/bookings/<requestId>/checkin -X POST -H 'content-type: application/json' -d '{
  "employeeExternalId": "emp-alice",
  "resourceType": "desk"
}'
```

Leave the parking half un-checked-in and watch `npm run worker` release it
after its deadline (`checkin_deadline` in `booking_claims`) -- for a live demo,
seed a claim with a deadline a minute or two in the future rather than waiting
for the real 10:00/14:00 cutoffs (see plan section 3, "short demonstration
deadline").

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
