# Full solution proposal (draft)

**Camp step 1: "Cover the complete specification. Explain value, architecture,
delivery approach, team, timeline and price."**

This is working source material for slides 1, 3, 4, 8 and 9 of the ten-slide
deck -- not final slide copy. Source: `ZRS_Camp_2026_Smart_Office_Reviewed_Plan.md`
and `ZRS_Camp_Project_Task.pdf`. See "Boundaries and open items" at the bottom
before treating any figure here as final.

---

## Value

### **A smarter way to use the space you already have.**
Three things make this solution pay off for the client's office of about 200 employees:

**#1 — Stop paying for space nobody uses.**
Bookings without accepted check-in are released automatically at the agreed deadline, so unused desks and parking return for the next permitted booking. Occupancy sensing can help confirm use and flag mismatches. The pilot will measure how often released spaces are reused.

**#2 — Easy to book, two ways.**
A visual map of the office floor and parking lot lets employees see and pick the exact spot they want. A natural-language request through the company's own channels (Teams, Slack—"a desk and parking tomorrow afternoon") gets the same result faster, through the same validated booking service—and opens the door to automating the booking operation itself.

**#3 — A delivery model that de-risks the investment.**
Our POC is not just a demo—it shows an Agentic SDLC where every decision is traceable and human-approved before it ships: no ungoverned output, no surprises at review. It's why this went from brief to a working proof of concept in two days, and why the same team and process can take the solution from a two-day POC to a 5,000-employee platform without a rewrite, on a predictable budget and timeline.

### **The result**
**Less friction for employees. Better utilisation for the company. A delivery approach built to scale.**

The full solution will support this journey:

**Book → Check in → Use → Release → Rebook**

The POC demonstrates booking, check-in and automatic release. Immediate
same-day rebooking after a check-in deadline remains subject to the written
facilitator decision in `docs/decisions/0001-half-day-booking-policy.md`.

## Complete specification coverage

The client's system specification is broader than the three POC functions;
the full offer covers all of it. Grouped by capability area (see "Boundaries"
for how this maps to the spec's exact FR/BR/QR numbering):

| Capability area | What it covers | POC status |
|---|---|---|
| Resource booking | Desk + parking booking via a visual map of the office floor and parking lot, morning/afternoon/full-day choice (pending facilitator decision), combined atomic requests, 14-day horizon | **Built** (FR-03); POC offers a specific-space picker on an illustrative synthetic layout or automatic assignment, plus cancellation before check-in. A site-accurate floor plan is full-delivery scope. |
| Check-in & automatic release | App check-in within a deadline protects a booking; a no-show releases it for someone else | **Built** (FR-08, FR-09) |
| Conversational booking | A faster, complementary path to the same map-based booking: natural-language request ("parking and a desk tomorrow afternoon") through Teams/Slack, routed through the same validated booking service; opens the door to automating the booking operation | Guided-chat prototype or live AI service, labelled accordingly |
| Occupancy sensing & indicators | Desk/parking presence sensors, LED status (bookable / reserved / in use / needs review), usage evidence and exceptions on mismatch | Simulated in the POC |
| Identity | Corporate sign-in ties every action to a verified employee | Synthetic adapter in the POC; Microsoft Entra ID in full delivery |
| Administration | Office hours, deadlines, check-in methods, resource states, configurable per office/resource type | Full-delivery scope |
| Audit & reporting | Full audit trail of booking/check-in/release events (already logged in the POC's `audit_log` table); utilization and no-show reporting | Data captured in POC; reporting UI is full-delivery scope |
| Multi-office & scale | Design for multiple offices and 5,000+ users from one Serbian-office pilot | Architected for, not load-tested, in the POC |
| Security, privacy, reliability | Access control, data protection, availability/recovery targets | Full-delivery scope, see Architecture |

## Architecture

**Target architecture for full delivery** extends the POC's Next.js/TypeScript
application rather than replacing it:

- **Booking core** (proven in the POC): resources modelled as morning/afternoon
  claims, with database constraints -- not just application code -- enforcing
  that no resource or employee holds two active overlapping claims, regardless
  of which surface (map UI, chat) created the request. This is the
  load-bearing design decision behind the "trustworthy booking" promise.
- **Identity**: Microsoft Entra ID for sign-in; server-side ownership and
  admin checks on every action (an employee sign-in establishes identity, an
  app check-in establishes declared arrival -- kept as two distinct events).
- **Occupancy**: sensor/LED readings stored as a signal separate from booking
  rights. A sensor never cancels a booking by itself; a mismatch (occupied
  without a booking, or a stale reading) raises a review exception instead of
  an automatic action.
- **Administration, notifications, audit/reporting**: new modules on the same
  application, not a rewrite.
- **Operations**: separate development, test and production environments;
  automated quality/security checks in CI; human approval gate before
  production release; a documented check-in event interface so sensor
  vendors integrate against a stable contract.
- **Data & integrations**: PostgreSQL as the system of record; Entra ID for
  identity; an approved AI service for the conversational assistant; a
  device/gateway integration layer for sensors and LEDs, chosen through a
  site pilot rather than committed to upfront.
- **Scale targets (proposed, to validate in discovery):** multiple offices,
  5,000+ users, 99.9% monthly availability, 15-minute recovery point, 4-hour
  recovery time. These need a real peak-workload and operational validation
  pass before they become a commitment.
- **Security & privacy**: booking data reveals who sits where -- treat it as
  sensitive personal data, with access scoped to the employee, their manager
  chain where relevant, and admins; no client data, credentials or licences
  used anywhere in build or demo (POC uses only synthetic data throughout).

## Delivery approach

The engagement follows the same Agentic SDLC used to build the POC, scaled up
(see `AGENTS.md` and the SDLC-for-full-delivery narrative for the full
version):

```
Brief -> agent refinement -> human acceptance criteria -> agent plan
      -> human design approval -> implementation -> independent checks/review
      -> correction -> human acceptance
```

Full delivery adds: CI/CD automation around this loop, security/dependency
scanning agents, an observability/incident-triage agent for production, and a
governance gate (human release approval) at every deployment -- not just at
the end of a feature. Client involvement happens at defined points: office
hours/policy configuration in discovery, design approval on architecture and
the booking-policy decision record, and acceptance review at the end of each
phase below.

**Delivery phases** (from the roadmap; person-days at €800/day):

| Phase | Focus | Person-days |
|---|---|---:|
| Discovery | Requirements, UX, site/tenant assessment | 20 |
| Core booking | Booking, policy rules, administration, audit, chat | 105 |
| Integration | Entra ID, notifications, devices/LEDs, multiple offices | 85 |
| Hardening | Security, privacy, accessibility, scale, recovery, device validation | 55 |
| Pilot | Acceptance, training, handover | 20 |

## Team

The camp team's role model carries directly into the delivery engagement --
the same six functions, staffed to the phase's workload:

| Role | Responsibility |
|---|---|
| Product/proposal lead | Client story, requirements, scope, client-facing decisions and reporting |
| Technical lead | Interfaces, architecture, integration and technical decisions |
| Frontend engineer | Booking/check-in screens, conversational interface, accessibility |
| Backend engineer | Database, booking, check-in, release, administration logic |
| QA/evidence lead | Acceptance criteria, testing, release evidence |
| Platform/integration engineer | Environments, CI/CD, device/sensor integration, operations |

Governance: a joint steering point at the end of each delivery phase, with the
client reviewing acceptance evidence before the next phase's budget is
released.

## Timeline

**About 16 weeks baseline, up to 19 weeks with contingency**, sequenced as:
Discovery -> Core booking -> Integration -> Hardening -> Pilot (phases can
overlap where scope allows, e.g. hardening work starting once core booking is
stable). Exact scheduling depends on Entra tenant and device-vendor
availability, confirmed in Discovery.

## Price

| Item | Person-days | Cost at €800/day |
|---|---:|---:|
| Base software estimate | 285 | €228,000 |
| 20% contingency | 57 | €45,600 |
| **Indicative software envelope** | **342** | **€273,600** |

If the facilitator declines the half-day booking amendment, the baseline
drops by its provisional 20 person-days: **265 base + 53 contingency = 318
person-days, €254,400** at the same rate.

**Shown separately, not included above:**
- Cloud hosting allowance: **€600-1,200/month** (unvalidated placeholder; excludes AI consumption and device costs).
- Desk/parking sensors, LEDs, gateways, installation, calibration, licences and maintenance for up to 150 desk and 30 parking sensor points -- **requires a supplier-backed quote before it can be presented as a total.**
- AI service consumption for the conversational assistant, once usage patterns are known.

This is an indicative fictional bid estimate for the camp, not a fixed-price
commitment.

---

## Boundaries and open items

- This draft is built from `ZRS_Camp_2026_Smart_Office_Reviewed_Plan.md` and
  the project task brief. The client's full **Smart Office System
  Specification** (19 functional requirements, 9 business rules, 14 quality
  requirements) is referenced by the plan but was not available when this
  draft was written -- the capability table above groups by area rather than
  citing FR/BR/QR numbers beyond the three the POC implements (FR-03, FR-08,
  FR-09). Before the deck is finalised, reconcile this draft against the
  actual specification and produce the requirement traceability matrix the
  plan calls for (kept in the repository, not on a slide).
- The half-day booking policy is **still pending a written facilitator
  decision** -- see `docs/decisions/0001-half-day-booking-policy.md`. Both the
  capability table and the price table above already carry the fallback if
  it's declined; update the "Value" and "Complete specification coverage"
  sections' wording (morning/afternoon vs. full-day-only) once the decision
  lands.
- Team member names, exact roadmap dates and Entra/AI tenant specifics are
  intentionally left generic/placeholder -- fill in once confirmed with the
  facilitator and the team.
