# Decision 0002: Specific-resource selection on the floor map (seat/space picker)

**Status:** Accepted for the POC by the product/proposal lead (session request, 2026-09-24). Recorded because it expands the documented POC scope.

## Deviation from the documented scope

`docs/poc-scope.md`, `src/server/booking-service.ts` and the session `plan.md`
originally scoped booking as **auto-assign only** ("first free" resource), and
explicitly listed a **seat-map picker** as *full-delivery scope*
(booking-service `pickAvailableResource` comment; plan.md "no seat-map picker").

This decision brings a **minimal** picker into the POC because the demo needs
the floor map to be legible *and* actionable — the client asked to "see the
office layout and select a table".

## Rule (as built)

- `GET /api/availability` returns each active resource with its `id`, `type`,
  `label` and live `free` status (`src/server/booking-queries.ts`).
- `POST /api/bookings` accepts an optional `resourceIds: string[]` (one id per
  requested type). When supplied, `createBooking` books **that specific**
  resource; if it is no longer free the request fails with `resource_taken`
  (HTTP 409) rather than silently reassigning
  (`src/server/booking-service.ts`).
- When `resourceIds` is omitted for a type, the original auto-assign behaviour
  is unchanged — selection is purely optional convenience.
- The floor map (`src/app/components/booking-form.tsx`) lays desks out as pods
  (A/B/C) and parking as a row; free spaces are tappable to pick one. Coloured
  amenity zones (Greenery, Piazza, Collab, Workshop) remain **illustrative and
  not bookable**.

## Demo data

`db/migrations/0003_seed_floor.sql` seeds a larger but still small synthetic
floor (12 desks in 3 pods + 6 parking spaces) so the layout reads like a real
office. This is **not** the full site (~150 desks / 30 parking) and is not real
client data.

## Still out of POC scope (full delivery)

Real allocation strategy (preferred desk, team clustering, accessibility
needs), a true geometric floor plan from the client's CAD, and drag/zoom map
interactions.
