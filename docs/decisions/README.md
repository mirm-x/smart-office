# Decision records

Decisions that change or extend the client's spec. One section each. Link to a
decision by its anchor, e.g.
`docs/decisions/README.md#decision-0001-half-day-booking-policy`.

| # | Decision | Status |
|---|---|---|
| 0001 | [Half-day booking](#decision-0001-half-day-booking-policy) | Proposed -- needs written facilitator OK |
| 0002 | [Pick your own seat/space](#decision-0002-specific-resource-selection-on-the-floor-map-seatspace-picker) | Accepted for the POC |
| 0003 | [Bid only three features](#decision-0003-scope-the-bid-to-three-value-carrying-features) | Accepted by product lead |

---

## Decision 0001: Half-day booking policy

**What:** Let people book a **morning**, an **afternoon**, or a **full day** --
instead of the spec's whole-day-only rule.

**Why:** It matches real demand better and lets us show the no-show release
story within one working day (the client's main pain point).

**Status:** Proposed. It's **on** for the demo (`.env.example`), but that is a
team demo choice, **not** client acceptance. Present it as a *proposed*
feature until a facilitator says yes in writing.

**Ask the facilitator (one written decision):**
1. Does half-day **replace** whole-day booking, or is it an **extra** option?
2. Does the "one desk + one parking" limit apply **per period** or **per day**?
3. Is "Book and check in now" (rebooking a just-released space) OK?

**If they say no:** Set `HALF_DAY_BOOKING_ENABLED=false`. No code rework needed
-- a full-day booking already claims both halves, so the API just accepts
full-day requests only. Fallback price: **318 person-days, €254,400**.

**Where it lives:** `src/server/booking-policy.ts`,
`src/server/booking-service.ts`, `db/migrations/0001_init.sql`.

**Acceptance trail (keep current -- this is our demo example):**

| Step | Owner | Status |
|---|---|---|
| Acceptance criteria (plan §3) | Product lead | Drafted |
| Design approval | Technical lead | -- |
| Implementation | Backend engineer | Scaffolded |
| Independent check | QA lead | -- |
| Facilitator acceptance | Product lead | Pending |

---

## Decision 0002: Specific-resource selection on the floor map (seat/space picker)

**What:** Let users tap a **specific** free desk or parking space on the floor
map. Auto-assign ("first free") still works when they don't pick.

**Why:** The demo needs the map to be usable, not just decorative -- the client
asked to "see the office layout and select a table".

**Status:** Accepted for the POC (product lead, 2026-09-24). It's a small
addition to the original auto-assign-only scope.

**How it works:**
- `GET /api/availability` lists each resource with its `id`, `label` and `free`
  status.
- `POST /api/bookings` takes an optional `resourceIds`. If that space is already
  taken, it fails with `resource_taken` (409) instead of silently reassigning.
- Coloured zones (Greenery, Piazza, etc.) are just illustration -- not bookable.

**Demo data:** `db/migrations/0003_seed_floor.sql` seeds a small fake floor
(12 desks + 6 parking). Not the real site, not real client data.

**Still out of scope:** smart allocation (team clustering, accessibility), a
real CAD floor plan, and drag/zoom map interactions.

---

## Decision 0003: Scope the bid to three value-carrying features

**What:** The proposal bids **three features**, not the whole 19-requirement
spec:
1. **Auto-release + hardware** -- check-in, no-show release, sensors/LEDs
   (FR-08, FR-09).
2. **Easy booking, two ways** -- floor/parking map + Teams/Slack chat, same
   booking service (FR-03).
3. **Agentic SDLC delivery** -- the way we build the above (not priced).

Minimal Identity (sign-in, ownership) is included because features 1 and 2
need it. It's not a fourth feature.

**Why:** Bidding everything gives a big, generic number that hides why the
client wants this. Bidding the three features they were pitched on ties cost
straight to value and gets a pilot in front of them faster.

**What moves to a later phase (not dropped):** admin console, notifications,
reporting UI, multi-office rollout, and the 5,000-user / 99.9% scale targets.

**Price impact:**

| | Full spec | Three features |
|---|---:|---:|
| Base person-days | 285 | 115 |
| Envelope | 342 PD, €273,600 | 138 PD, €110,400 |
| Timeline | ~16-19 weeks | ~9-11 weeks |

Lower because it's less scope + parallel work, **not** a discount.

**Still open:**
- Traceability only needs to cover the five in-scope rows for now.
- The half-day decision ([0001](#decision-0001-half-day-booking-policy)) still
  applies inside feature 2.
- Confirm per-feature headcount with the real delivery team before quoting a
  fixed price.
