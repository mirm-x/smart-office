# Decision 0003: Scope the bid to three value-carrying features

**Status:** Accepted by the product/proposal lead (session request, 2026-09-24).
Recorded because it narrows the documented full-delivery scope and rebuilds
the price and timeline.

## Decision

The proposal (`docs/proposal/01-full-solution-proposal.md`) no longer bids
the entire client specification (19 functional requirements, 9 business
rules, 14 quality requirements). It bids **only the three value-carrying
features** from the Value section:

1. **Auto-release + hardware** -- check-in, automatic no-show release, real
   sensor/LED integration (FR-08, FR-09, occupancy sensing).
2. **Easy booking, two ways** -- a site-accurate floor/parking map plus a
   Teams/Slack natural-language channel routed through the same booking
   service (FR-03, conversational booking).
3. **Agentic SDLC delivery** -- not a priced feature; the delivery method
   used to build the other two, carried into this bid at no extra scope.

Minimal Identity (Entra ID sign-in, ownership checks) is included because
Features #1 and #2 don't work for real employees without it. It is not
counted as a fourth feature.

## Why

Bidding the full specification produces a large, generic estimate that
buries the client's actual reasons for saying yes. Scoping tightly to the
three features the client was pitched on makes the bid's cost and timeline
directly traceable to the value story, and gets a working pilot in front of
the client faster.

## What this removes from the bid (not from the spec)

Administration console, notifications, audit/reporting UI, multi-office
rollout, and the 5,000-user / 99.9%-availability scale targets. These remain
real, valuable parts of the client's full specification -- they are simply a
**future phase**, priced separately once the pilot proves the model. See
"Complete specification coverage" in the proposal for the full capability
list and each row's in/out-of-scope marking.

## Effort, timeline and price impact

Rebuilt bottom-up (team engaged x working days per feature, not the
inherited top-down planning number):

| | Before (full spec) | After (3 features) |
|---|---:|---:|
| Base person-days | 285 | 115 |
| Indicative envelope | 342 PD, €273,600 | 138 PD, €110,400 |
| Timeline | ~16-19 weeks | ~9-11 weeks |

The reduction is scope (fewer capability areas) plus parallel execution
(Features #1 and #2 built by different people at the same time), not a
change in day rate or a discount on the original estimate.

## Still open

- Requirement traceability only needs to cover the five in-scope capability
  rows for this bid; the deferred rows don't need FR/BR/QR mapping until
  they're actually scoped into a future phase.
- The half-day booking policy decision (`docs/decisions/0001-half-day-booking-policy.md`)
  still applies within Feature #2's scope.
- Headcount-per-feature assumptions in the proposal's Delivery phases table
  are indicative; validate with the actual delivery team before quoting a
  fixed price.
