# Agent guidance -- Smart Office POC

This file is the entry point for any agent session working in this repo. Read
it first. It should always reflect the current agreed rule and the next task
-- if it doesn't, fix it before doing anything else.

## Source of truth

- `ZRS_Camp_2026_Smart_Office_Reviewed_Plan.md` -- the team's current working plan (booking policy, POC scope, roadmap, presentation outline). Supersedes any earlier "Updated Plan" version.
- `docs/poc-scope.md` -- the tiered definition of done (must-demonstrate / focused checks / follow-up). Check any new work against this before starting it.
- `docs/decisions/` -- one file per decision that changes or extends the client specification (e.g. the half-day booking policy). Each record states the rule, why it deviates from spec, and who accepted it.
- `docs/proposal/` -- client proposal drafts (value, architecture, delivery approach, team, timeline, price), feeding the slide deck. Keep these in sync with the plan and the decision records rather than drifting into their own narrative.
- `db/migrations/0001_init.sql` -- the current data model and the constraints enforcing booking rules.

If the plan and the code disagree, the plan wins until a human updates one of the two -- say so instead of guessing.

## Workflow this repo follows

```
Brief -> agent refinement -> human acceptance criteria -> agent plan
      -> human design approval -> implementation -> independent checks/review
      -> correction -> human acceptance
```

Every agent task should be traceable to:

1. **Requirement** -- which functional requirement / acceptance criterion / decision record it serves.
2. **Input material** -- plan section, decision record, or existing code it must respect.
3. **Allowed tools** -- what the agent may run (build, test, lint, migrate) without further approval, and what needs a human.
4. **Expected artifact** -- the file(s)/PR it should produce.
5. **Acceptance checks** -- how a human or a review agent verifies it (tests, manual scenario, acceptance criterion number).
6. **Human owner** -- who accepts the result (see table below).

A failed check returns to implementation. A disputed or unclear requirement returns to the product/proposal lead -- do not silently reinterpret it.

## Human owners

| Role | Responsibility |
|---|---|
| Product/proposal lead | Client story, facilitator questions, scope, assumptions, slides and price |
| Technical lead | Interfaces, architecture, integration and technical decisions |
| Frontend engineer | Booking/check-in screens, conversational interface and accessibility |
| Backend engineer | Database constraints, booking, check-in and release |
| QA/evidence lead | Acceptance checks, edge cases, review evidence and demo recording |
| Platform/integration engineer | Local setup, worker, synthetic data, device simulation and run instructions |

## Ground rules

- **Labelling**: anything simulated (identity, sensors, LEDs, AI service fallback) must be clearly labelled as simulated in code comments, UI copy and slides -- never described as a live integration. See `.env.example` for the flags that control this.
- **Booking policy is not yet final**: half-day periods (`src/server/booking-policy.ts`) extend the spec's day-only BR-01/BR-02. Do not treat it as settled until `docs/decisions/0001-half-day-booking-policy.md` records a **written** facilitator acceptance. If declined, set `HALF_DAY_BOOKING_ENABLED=false` (already wired in `booking-service.ts`) rather than reworking the data model.
- **Scope discipline**: this POC covers FR-03 (booking), FR-08 (check-in) and FR-09 (automatic release) only, gated by the tiers in `docs/poc-scope.md`. Do not expand into full-delivery features (Entra, notifications, admin console, multi-office) inside the POC codebase, and do not spend camp time on tier-3 items before tier 1 and 2 pass -- describe full-delivery features in the proposal instead.
- **Evidence over claims**: every acceptance criterion implemented should have a way to demonstrate it (a test, a scripted scenario, or a recorded run) -- the presentation needs one real example of a full handoff (brief -> plan -> implementation -> check -> acceptance), so keep the trail for at least one non-trivial change (the half-day overlap rule is the natural candidate).
