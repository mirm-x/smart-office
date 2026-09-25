# Tier-1 UI design spec (Figma-ready)

**Smart Office POC · booking journey · FR-03 / FR-08 / FR-09**

This is a Figma-ready design specification for the tier-1 must-demo journey:
**book → check in → automatic no-show release → (re)book**. It is authored so
each section maps 1:1 to a Figma concept — rebuild it in Figma by turning
Foundations into styles, Components into component sets with variants, and
Screens into frames.

> This document records the original design handoff. The implemented visual
> refinements below supersede its earlier component redlines where they differ.

> **Importable Figma assets** (see `docs/design/README.md`):
> `tier1-ui-mockups.svg` (drag onto the Figma canvas → editable frames) and
> `tier1-ui-tokens.json` (import with the Tokens Studio for Figma plugin).

## Implemented visual refinement (September 2026)

The running POC keeps this specification's light palette, system font,
explicit status labels, and simulated-integration labelling. The implemented
screens use an 860px content column and a two-step booking form. Booking
availability sits beside the date and period choice after sign-in, so it
describes the current request without delaying the form or showing resource
counts to an unsigned visitor. The selectable illustrative floor
map is available from an optional expander (see
[decision 0002](../decisions/README.md#decision-0002-specific-resource-selection-on-the-floor-map-seatspace-picker)),
while automatic assignment remains the default. My bookings puts the nearest
active request first and keeps older or inactive requests in Booking history.
Desk pods use equal-size cards and wrap to another row when more pods are
present; the map does not depend on a carousel.
The map shows booking availability; it does not claim to show live sensor
occupancy.

For the implemented screens, `src/app/globals.css` is the reference for the
refined spacing, quiet borders, 16px card corners, period-card layout, and mobile
breakpoints. The SVG mockups and JSON tokens below remain the original design
handoff and have not been regenerated to depict this refinement.

## Traceability

- **Requirements:** FR-03 booking, FR-08 check-in, FR-09 automatic release.
- **Input material:** `ZRS_Camp_2026_Smart_Office_Reviewed_Plan.md` §2–3,
  `docs/poc-scope.md` (tier 1 + tier 2 focused checks),
  `src/server/booking-policy.ts`, `src/server/booking-service.ts`,
  `db/migrations/0001_init.sql`.
- **Human owner:** Frontend engineer (screens, accessibility). Read-model API
  additions confirmed with Backend / Technical lead.
- **Acceptance:** design approval → build → manual journey walkthrough.

## Scope

**In scope:** two screens — *Book a space* and *My bookings* — plus a labelled
simulated sign-in stub, the illustrative resource picker accepted in decision
0002, and the components/foundations they need.

**Out of scope (do not design here):** guided-chat conversational assistant,
sensor/LED occupancy panel, admin console, notifications, and "Book and check
in now" (gated on the pending facilitator decision — see
`docs/decisions/README.md#decision-0001-half-day-booking-policy`).

**Policy gates that shape the UI:**

- **Half-day periods** (morning / afternoon / full-day) render **only when
  `HALF_DAY_BOOKING_ENABLED` is true**. When false, show **full-day only** with
  no other change. Design both variants of the period selector.
- **Everything simulated must be labelled** — the sign-in stub is marked
  *"Simulated sign-in — no real SSO"*. Never depict it as live identity.

## Domain facts the design must honour

From `booking-policy.ts` / schema — these drive copy, validation and states:

| Period | Reserved | Check-in window | Auto-release from |
|---|---|---|---|
| Morning | 09:00–13:00 | 09:00 → before 10:00 | 10:00 |
| Afternoon | 13:00–17:00 | 13:00 → before 14:00 | 14:00 |
| Full day | 09:00–17:00 | 09:00 → before 10:00 | 10:00 |

- Booking horizon: a **working date (Mon–Fri)** up to **14 calendar days** ahead.
- Resource types: **desk**, **parking**, or **both** (both = atomic — all or
  nothing).
- Claim statuses: `reserved`, `checked_in`, `released`, `cancelled`.
- Desk and parking check-ins are **independent**.
- Office time zone label shown to the user: `Europe/Belgrade`.

---

# 1. Foundations → Figma styles

Create these as Figma **color / text / effect styles** and layout variables.
Names below are the suggested Figma style paths.

## 1.1 Colour

Core palette (light theme; POC ships light only).

| Figma style | Hex | Role |
|---|---|---|
| `color/bg/canvas` | `#F6F7F9` | App background |
| `color/bg/surface` | `#FFFFFF` | Cards, bars, inputs |
| `color/bg/subtle` | `#EEF1F4` | Hover/disabled fills, table zebra |
| `color/border/default` | `#D5DAE1` | Input & card borders |
| `color/border/strong` | `#AEB6C2` | Focus-adjacent, dividers |
| `color/text/primary` | `#1B2430` | Headings, body |
| `color/text/secondary` | `#5A6572` | Labels, help text |
| `color/text/inverse` | `#FFFFFF` | Text on brand/solid |
| `color/brand/600` | `#1F5FBF` | Primary actions, links |
| `color/brand/700` | `#184C99` | Primary hover/active |
| `color/focus/ring` | `#1F5FBF` | Focus-visible outline |

Status palette (used by StatusBadge + banners). Each has a **text-on-tint**
pairing verified for WCAG AA (≥4.5:1 for body text).

| Figma style | Tint bg | Text/icon | Meaning |
|---|---|---|---|
| `color/status/reserved` | `#E7EEFB` | `#184C99` | Reserved, awaiting check-in |
| `color/status/checked-in` | `#E3F3E8` | `#1E6B3A` | Checked in / protected |
| `color/status/released` | `#FCEBE7` | `#A5341E` | Released (no-show) |
| `color/status/cancelled` | `#EEF1F4` | `#5A6572` | Cancelled |
| `color/status/warning` | `#FDF3E1` | `#8A5A00` | Window closing / caution |
| `color/status/simulated` | `#F2ECFB` | `#5B3B9B` | Simulated-element label |

> Accessibility rule (plan §4): **status is conveyed by icon + text + colour**,
> never colour alone. Every status colour above has a paired icon (see §2.7).

## 1.2 Typography

Font family: **system UI stack** (matches current `layout.tsx`) —
`system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`.

| Figma text style | Size / line-height | Weight | Use |
|---|---|---|---|
| `text/display` | 28 / 34 | 700 | Screen H1 |
| `text/h2` | 20 / 28 | 600 | Section headings |
| `text/h3` | 16 / 24 | 600 | Card titles |
| `text/body` | 15 / 22 | 400 | Body, inputs |
| `text/body-strong` | 15 / 22 | 600 | Emphasis, values |
| `text/label` | 13 / 18 | 600 | Field labels, badges |
| `text/help` | 13 / 18 | 400 | Help & error text |
| `text/mono` | 13 / 20 | 500 | IDs, request/resource codes (`ui-monospace`) |

## 1.3 Spacing scale

4-pt base. Figma variables `space/1`…`space/10`.

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64` px.

Component padding and screen gaps below reference these tokens.

## 1.4 Radius & elevation

| Token | Value | Use |
|---|---|---|
| `radius/sm` | 6px | Inputs, badges |
| `radius/md` | 10px | Buttons, cards |
| `radius/lg` | 14px | Modals/large cards |
| `elevation/1` | `0 1px 2px rgba(16,24,40,.06)` | Cards, bars |
| `elevation/2` | `0 4px 12px rgba(16,24,40,.10)` | Menus, confirmation |

## 1.5 Layout grid & breakpoints

- **Content max-width:** 760px, centered (single-column, form-first POC).
- **Page padding:** `space/6` (24) desktop, `space/4` (16) mobile.
- **Breakpoints:** `sm 0–599`, `md 600–1023`, `lg 1024+`.
- Mobile-first single column throughout; on `lg`, *My bookings* rows may use a
  two-column meta layout (see §3.4). Target the demo laptop at `lg`.

---

# 2. Components → Figma component sets

Each component is one Figma component (or component set with variants). Anatomy,
variant matrix, states and auto-layout redlines follow. **Interaction states**
to build for every interactive component: `default`, `hover`, `focus-visible`,
`active`, `disabled`, and (where relevant) `error`.

Global focus-visible: 2px outline in `color/focus/ring` + 2px offset. Minimum
target size 44×44px.

## 2.1 IdentityBar (simulated sign-in stub)

Persistent top bar; the "signed in as" identity drives every API call.

- **Anatomy:** left app title `Smart Office` (`text/h3`) · right group: label
  `Signed in as`, text input (`Field`, compact), and a **simulated tag**
  reading `Simulated sign-in — no real SSO` (`color/status/simulated`, info
  icon).
- **Layout:** horizontal auto-layout, space-between, height 56, padding
  `space/4` (16) horizontal, `elevation/1`, `color/bg/surface`, bottom border
  `color/border/default`.
- **Input default:** `emp-alice`. Placeholder `e.g. emp-alice`. On mobile the
  bar wraps to two rows (title row, identity row).
- **States:** input follows `Field` states; empty input → downstream screens
  show the "enter an employee id" empty state (§3), not a hard error.

## 2.2 Button

- **Variants (property `variant`):** `primary` (brand solid), `secondary`
  (surface + border), `ghost` (text only), `danger` (rarely used — cancel).
- **Property `size`:** `md` (default, height 40, padding `12/16`), `sm`
  (height 32, padding `8/12`).
- **Property `state`:** default / hover / focus-visible / active / disabled /
  `loading` (spinner + label, non-interactive).
- **Redlines:** radius `radius/md`; icon-text gap `space/2` (8); label
  `text/body-strong`.
- **Colours:** primary bg `brand/600` → hover `brand/700`, text `text/inverse`;
  secondary text `text/primary`, border `border/default`; disabled 40% opacity +
  `not-allowed` cursor.

## 2.3 Field (label + input + help/error)

- **Anatomy (vertical auto-layout, gap `space/1`=4):** `<label>` (`text/label`)
  · input (height 40, padding `10/12`, radius `radius/sm`, border
  `border/default`) · help/error line (`text/help`).
- **Variants:** `type` = text / date; `state` = default / focus / error /
  disabled.
- **Error state:** border + help text use `color/status/released`; help line
  prefixed with an alert icon; input gets `aria-invalid`.
- **Date sub-spec:** native date input; `min` = today, `max` = today + 14 days;
  weekend/horizon violations surface as field error (copy in §4.2).

## 2.4 Select (period & resource choices)

Rendered as an accessible **segmented radio group** (not a native dropdown) so
options and the disabled state are visible.

- **Anatomy:** group label (`text/label`) + inline segment buttons; each segment
  is a radio (`role=radio`), auto-layout row, wraps on mobile.
- **Period variants:** `full-set` (Morning / Afternoon / Full day — when
  `HALF_DAY_BOOKING_ENABLED=true`) and `full-day-only` (single **Full day**
  segment, pre-selected, with help text `Half-day booking is not enabled`).
- **Resource variant:** Desk / Parking / Both.
- **Segment states:** default / hover / selected (brand fill, inverse text) /
  focus-visible / disabled.

## 2.5 Card

- Container: `color/bg/surface`, border `border/default`, radius `radius/md`,
  `elevation/1`, padding `space/5` (20), vertical auto-layout gap `space/4`.
- **Slots:** optional title (`text/h3`), body, footer actions (right-aligned
  Button row).
- Used for the booking form, confirmation, and each booking row.

## 2.6 Banner / Alert

Inline messaging block; also carries the "simulated" notices.

- **Variants (`tone`):** `info` (`brand`), `success` (`checked-in`), `error`
  (`released`), `warning`, `simulated` (`status/simulated`).
- **Anatomy:** leading icon · message (`text/body`) · optional inline action
  (`Button ghost sm`). Auto-layout row, gap `space/2`, padding `12/16`, radius
  `radius/sm`, tinted bg per tone with matching text colour.
- **Behaviour:** error/success banners are `aria-live="polite"` (see §4.3).

## 2.7 StatusBadge

Pill communicating claim status with **icon + text + colour**.

| Status | Label text | Icon | Style |
|---|---|---|---|
| reserved | `Reserved` | clock | `color/status/reserved` |
| checked_in | `Checked in` | check-circle | `color/status/checked-in` |
| released | `Released` | rotate/undo | `color/status/released` |
| cancelled | `Cancelled` | slash-circle | `color/status/cancelled` |

- **Redlines:** radius `radius/sm`, padding `4/10`, icon 14px, gap `space/1`,
  text `text/label`.

## 2.8 Countdown

Small live timer for the check-in window on *My bookings*.

- **Variants (`phase`):**
  - `not-open` — before window opens → `Check-in opens 09:00` (secondary text).
  - `open` — within window → `Check in before 10:00 · 07:42 left` (warning tint
    when < 5 min).
  - `closed` — past deadline, not checked in → `Window closed` (released tint).
- **Anatomy:** icon + text (`text/help`), inline. Updates each second;
  `aria-live="off"` on the ticking value, with a polite announcement only on
  phase change (avoid screen-reader spam — see §4.3).

---

# 3. Screens → Figma frames

Build each screen as a frame set with the listed states. Use vertical
auto-layout, content max-width 760 (§1.5). Both screens share the IdentityBar
(place it as an instance at the top of each frame or in a layout wrapper).

Frame naming suggestion: `Screen/Book/Default`, `Screen/Book/Confirmation`, …

## 3.1 App shell

`IdentityBar` (§2.1) pinned top · below it a simple nav row with two links:
**Book** (`/`) and **My bookings** (`/bookings`); active link uses `brand/600`
underline. Page content centered within max-width.

## 3.2 Book a space — layout

Single `Card` titled **Book a space**, vertical auto-layout gap `space/5`:

1. **Availability hint** (`Banner info`, optional): `12 desks and 5 parking
   spaces free for Mon 28 Sep, morning.` Recomputed when date/period change.
2. **Field — Work date** (date, §2.3). Help: `Weekdays only, up to 14 days
   ahead. Times shown in Europe/Belgrade.`
3. **Select — Period** (§2.4): `full-set` or `full-day-only` per flag.
4. **Select — Resource** (§2.4): Desk / Parking / Both.
5. **Footer:** `Button primary` **Book** (right-aligned); `loading` state while
   the request is in flight.

## 3.3 Book a space — states (frames)

- **Default** — empty-ish form with defaults (nearest weekday preselected,
  period = Full day, resource = Desk).
- **Loading** — submit button `loading`, inputs disabled.
- **Confirmation** — replace/augment the card with a **Confirmation** card
  (`Banner success` header) showing exactly (tier-1 AC): **Date · Period ·
  Resource · Status = Reserved**, resource label in `text/mono`, plus a
  `Button secondary` **Go to My bookings**. For a **Both** request show two
  resource lines (desk + parking) — both created or neither.
- **Error** — `Banner error` above the form; field-level error on the date when
  applicable. Copy mapped from API reasons (§4.2).
- **Half-day disabled** — Period selector in `full-day-only` variant with help
  text; no other change.
- **Empty identity** — if IdentityBar input is blank, show `Banner info`
  `Enter an employee id to book (e.g. emp-alice).` and disable **Book**.

## 3.4 My bookings — layout

Header row: **My bookings** (`text/h2`) + `Button secondary sm` **Refresh**.
Below: a vertical list of booking `Card`s (one per claim). Each row:

- **Left/meta:** resource label (`text/body-strong`) + type icon; date + period
  (`text/help`); on `lg`, meta sits in a left column.
- **Right:** `StatusBadge` (§2.7) + `Countdown` (§2.8) + primary action.
- **Primary action per status:**
  - `reserved`, window open → `Button primary sm` **Check in**.
  - `reserved`, before window → **Check in** disabled + Countdown `not-open`.
  - `reserved`, after deadline → no check-in button; Countdown `closed` (worker will
    release; row flips to `released` on next refresh).
  - `reserved` → **Cancel** opens an inline confirmation. Confirming cancels
    this desk or parking booking only; the row becomes `cancelled` after refresh.
  - `checked_in` → no action; helper text `Protected for this period.`
  - `released` → `Banner info` inline `Released — this space is free to book
    again.` + `Button ghost sm` **Book again** (→ Book screen).
  - `cancelled` → muted row, no action.
- Desk and parking rows are **separate cards** and check in independently.

## 3.5 My bookings — states (frames)

- **Loading** — 2–3 skeleton rows.
- **Empty** — illustration/neutral card: `No bookings yet. Book a desk or
  parking space to get started.` + `Button primary` **Book a space**.
- **List (mixed)** — canonical demo state: a desk `checked_in` (protected) and a
  parking `reserved` heading toward release — the core narrative in one frame.
- **Released (post-worker)** — the parking row now `released` with **Book
  again**; desk remains `checked_in`. This frame is the FR-09 money shot.
- **Check-in error** — `Banner error` on the row (copy §4.2: too_early /
  too_late / not_owner / already_released).
- **Empty identity** — same info banner as §3.3.

---

# 4. Content & accessibility

## 4.1 Voice & microcopy

Plain, calm, non-technical. Reinforce the central message: *a timely check-in
protects your booking; a no-show frees it.* Times shown in `Europe/Belgrade`.

## 4.2 Error copy mapped to API reasons

Booking (`POST /api/bookings`) → user-facing text:

| API `reason` | Where | Copy |
|---|---|---|
| `invalid_date` | Date field | `Pick a weekday within the next 14 days.` |
| `no_resource_available` | Banner error | `No {resource} free for that date and period. Try another slot.` |
| `conflict` | Banner error | `That space was just taken. Please try again.` |
| `unknown_employee` | Banner error | `We don't recognise that employee id.` |
| `half_day_not_enabled` | Period help | `Half-day booking isn't enabled — choose Full day.` |

Check-in (`POST /api/bookings/:requestId/checkin`):

| API `reason` | Copy |
|---|---|
| `too_early` | `Check-in isn't open yet — it opens at {window start}.` |
| `too_late` | `The check-in window has closed for this booking.` |
| `not_owner` | `You can only check in to your own booking.` |
| `not_found` | `We couldn't find that booking.` |
| `already_released` | `This booking was released and can't be checked in.` |
| `already_cancelled` | `This booking was cancelled and can't be checked in.` |

Generic network/500 → `Something went wrong. Please try again.`

## 4.3 Accessibility annotations (WCAG AA)

- **Labels:** every input has a visible `<label>` (Field). IdentityBar input
  labelled `Signed in as`.
- **Focus order:** IdentityBar → nav → form fields top-to-bottom → primary
  action. Logical DOM order; no positive `tabindex`.
- **Focus-visible:** 2px `color/focus/ring` outline + 2px offset on all
  interactive elements.
- **Colour independence:** StatusBadge and Countdown always pair colour with
  icon + text (§2.7).
- **Live regions:**
  - Booking result + check-in result banners: container `aria-live="polite"`,
    `role="status"` (success) / `role="alert"` (error).
  - Countdown: ticking seconds are **not** announced; announce only on phase
    change (`not-open → open → closed`) via a polite live region.
  - "Refresh" completion on My bookings: polite `Bookings updated.`
- **Semantics:** period/resource selectors use `role="radiogroup"` with
  `role="radio"` segments and arrow-key navigation. Booking list is a list of
  articles (`role="listitem"`/`<li>`).
- **Targets:** ≥44×44px interactive areas; segments meet this at `md` height.
- **Motion:** skeletons/spinners respect `prefers-reduced-motion` (no
  essential info conveyed by motion).
- **Contrast:** all text/status pairings in §1.1 meet AA (≥4.5:1 body,
  ≥3:1 large/UI). Verify in Figma with a contrast plugin before handoff.

## 4.4 Simulated-element labelling (ground rule)

- IdentityBar carries the persistent `Simulated sign-in — no real SSO` tag.
- A deadline shortened with `npm run demo:scenario` is a local synthetic
  fixture. My bookings shows the shortened time without a special badge, so
  the presenter must say that the normal policy time is unchanged.

---

# 5. Figma rebuild guide

Suggested file structure so this spec reconstructs cleanly.

## 5.1 Pages

1. **① Foundations** — colour, text, effect styles + layout variables (§1).
2. **② Components** — one section per component in §2, each a component set
   with the variant matrix and states laid out as a grid.
3. **③ Screens** — frames per §3, grouped `Book` and `My bookings`, one frame
   per state; add a "Flow" connection Book → Confirmation → My bookings →
   (release) → Book again.
4. **④ Redlines/Handoff** — annotated copies with spacing/measurements for dev.

## 5.2 Style & component naming

- Mirror the token paths in §1 exactly (`color/status/released`,
  `text/body-strong`, `space/4`). Slash-separated names auto-group in Figma.
- Component names: `IdentityBar`, `Button`, `Field`, `Select`, `Card`,
  `Banner`, `StatusBadge`, `Countdown`. Expose variants as properties
  (`variant`, `size`, `state`, `tone`, `status`, `phase`).

## 5.3 Auto-layout tips

- Build the content column as a vertical auto-layout frame, width 760, `space/5`
  gap; set page padding via the frame padding.
- Cards, Fields, Banners, Buttons all use auto-layout with the padding/gap
  redlines in §2 so text changes reflow without manual resizing.
- Segmented Select: horizontal auto-layout with `wrap` enabled for mobile.
- Use Figma variables for the breakpoints (§1.5) and create `sm`/`md`/`lg`
  variants of each Screen frame if you want responsive previews.

## 5.4 Handoff back to code

The code build (`src/app/globals.css` tokens + CSS Module components +
`/` and `/bookings` routes) should consume the same token names and component
variants defined here, keeping this spec the source of truth. Two read-model
endpoints are required for the screens: `GET /api/bookings?employeeExternalId=`
and `GET /api/availability?workDate=&period=` (confirm with backend/technical
lead).
