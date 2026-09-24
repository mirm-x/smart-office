# ZRS Camp 2026: Reviewed Smart Office proposal and POC plan

**Team working plan · 24 September 2026 · Review of Day 1 risks incorporated**

## At a glance

- **The offer:** A complete desk and parking booking system for a company with about 200 employees, 150 desks and 30 parking spaces. The design must support multiple offices and at least 5,000 users.
- **The camp POC:** Demonstrate three connected functions: **booking (FR-03), check-in (FR-08) and automatic release (FR-09)**.
- **The new booking choice:** Employees can select **morning half-day, afternoon half-day or full day**. This extends the supplied specification, which originally calls for working-day bookings.
- **The submission:** No more than **10 proposal slides**, plus the repository, run instructions and POC access or a backup recording, by **14:00 on Day 2**.
- **The central message:** A timely check-in protects a reservation. A no-show releases it after the relevant deadline so someone else can book the space.
- **The first decision:** Get a written facilitator answer on half-day bookings, overlapping employee limits and same-day rebooking before committing to the segment-based booking model.

---

## 1. The client story

> Employees can book a desk or parking space for the morning, afternoon or full working day. They can check in when they arrive, knowing the reservation will stay theirs for that period. If they do not check in by the agreed deadline, the space returns to availability. A conversational assistant makes booking easier; occupancy signals and clear indicators help people and administrators spot exceptions. Corporate sign-in connects actions to verified employees. The POC demonstrates the booking lifecycle and the human-supervised agent workflow we would use for full delivery.

Measure the value during a pilot through booking completion, no-show releases, released spaces that are booked again, employee complaints and sensor/booking mismatches. Establish a baseline before promising percentage improvements.

**Important wording:** Automatic release applies to **no-shows after the configured deadline**. A checked-in employee keeps the space for their booked period, including a temporary absence. A sensor reading alone does not identify the employee or cancel their booking.

## 2. Booking policy for the proposal

The three user choices are **morning half-day, afternoon half-day and full day**. These first-office times are **proposed defaults for the POC**, because the source specification does not define half-day hours.

| Choice | Reserved period | App check-in window | No-show release |
|---|---|---|---|
| **Morning** | 09:00–13:00 | 09:00 to before 10:00 | From 10:00 |
| **Afternoon** | 13:00–17:00 | 13:00 to before 14:00 | From 14:00 |
| **Full day** | 09:00–17:00 | 09:00 to before 10:00 | From 10:00 |

All dates and times use the office's named local time zone, initially `Europe/Belgrade`. The complete system lets an administrator configure office hours, deadlines and accepted check-in methods by office and resource type.

**Overlap and limits**

- A full-day booking occupies both morning and afternoon. A morning booking and an afternoon booking for the same resource may belong to different employees.
- One employee may hold **one desk and one parking space in each overlapping period**. They may use different desks in morning and afternoon. A full-day booking counts against both periods.
- Desk and parking requested together use the same date and time choice. Both bookings succeed or neither does.
- Booking is allowed for a working date up to 14 calendar days ahead. The POC calendar uses Monday to Friday; office holidays and exceptions are agreed during full delivery.
- Active, unavailable and maintenance resource states are enforced by the server.

These overlap rules intentionally adapt the original specification's **BR-01 day-only booking** and **BR-02 daily employee limit**. **The product lead must get a written facilitator decision before the team builds the segment-based data model.** Save the answer in a short decision record that can be used on slide 10. Ask whether half-day booking *replaces* or *extends* the original day-only rule and whether employee limits apply per overlapping period. If the change is declined, build the original full-day flow and present half-day booking as a separately scoped option; continue setup and client-story work while the decision is pending.

**Bookings after a check-in deadline**

- Propose **“Book and check in now”** for a released space while the requested period is still running. Booking and accepted app check-in happen in one transaction. Include this policy in the same written facilitator decision: it is necessary for the same-day rebooking demonstration.
- A morning booking cannot start at or after 13:00; an afternoon booking cannot start at or after 17:00.
- Between 10:00 and 13:00, a new booking covering both remaining periods can be checked in immediately; a polished **“remaining day”** label is later work. From 13:00 onward, offer the afternoon choice only.
- A late check-in for an *old, released* booking never restores it. The employee must make a new booking if the space is still available.

## 3. Two-day POC

Build one complete journey: employee A books a desk and parking space; they check in to the desk; the parking booking receives no check-in and is released. If the facilitator accepts immediate same-day rebooking, employee B books the freed space. If that rule is declined, show release and the next booking permitted by the agreed policy. Demonstrate morning/afternoon coexistence and full-day overlap only if the half-day change is approved; otherwise use the original full-day journey.

The POC uses synthetic employees and one Serbian office. It may **simulate** corporate sign-in, sensor readings and LED indicators, as the camp brief permits. An approved AI service can power the conversational interface if access is ready. Otherwise, show a clearly labelled guided-chat prototype and demonstrate actual booking through the standard UI. Do not describe simulated identity, occupancy or AI as live integration.

### Camp acceptance: the short list

The written brief asks for a **focused POC**, so the team will not treat every full-system edge case as a Day 2 demo requirement. Keep the three selected functions. Implement database-backed conflict protection; verify it with a focused check even if the audience does not watch concurrent requests live.

**Must demonstrate by Day 2**

1. **Booking (FR-03):** An employee sees suitable desks/parking and books a desk, parking space or both. If half-day booking is approved, they can select morning, afternoon or full day; morning and afternoon can coexist while full day conflicts with either. If declined, demonstrate full-day booking. Confirmation shows the approved date, period, resource and status.
2. **Check-in (FR-08):** The booking owner checks in during the applicable approved window. A timely check-in changes that booking to **checked in** and protects it for its booked period. Desk and parking check-ins are independent.
3. **Automatic release (FR-09):** Without accepted check-in, the worker releases the booking at the approved deadline. If immediate same-day rebooking is approved, a second employee books through **“Book and check in now.”** Otherwise, show the released status and the next booking allowed by the agreed policy. A booking with timely check-in remains active.

**Focused checks before making those claims**

1. Two concurrent employees requesting the same resource and overlapping period result in one success and one conflict; the database enforces this outcome.
2. One employee cannot hold two active desks or two active parking spaces in an overlapping period. Morning and afternoon bookings that do not overlap are allowed if the half-day rule was approved.
3. A combined desk-plus-parking request creates both bookings or neither when one resource is unavailable.
4. Check-in at the deadline is late. Another employee cannot check in to a booking they do not own, and a late event cannot restore a released booking.
5. Repeating the release worker produces no second state change or audit action. A checked-in full-day booking stays protected for both halves.

**Follow-up acceptance for full delivery, or camp stretch work after the demo is safe**

- Polished **“remaining day”** wording and repeated-request handling after ambiguous network responses.
- Worker restart recovery and a direct check-in-versus-release race test.
- Sensor-occupied exception screens, stale-reading handling and false-reading correction.
- Wider time-zone and holiday tests, plus full administration and notification paths.

The POC must still enforce the booking rules in its server and database. The follow-up list identifies additional proof and presentation polish. **Once the must-demo flow and focused checks pass, freeze the POC and spend the remaining time on evidence, the recording and the client proposal.** Use a clearly labelled shortened deadline in the demo; show the normal policy defaults above in the proposal.

## 4. Technical solution and full-delivery boundary

The POC uses a small **Next.js/TypeScript** application, **PostgreSQL** and a release worker. Model each resource/date as morning and afternoon claims; a full-day booking claims both. Database constraints enforce active overlaps for resources and employees. Transactional operations handle combined desk/parking requests, check-in and release. Use office-local dates and a named time zone; store actual deadlines as instants.

For full delivery, extend this one application with Microsoft Entra ID, administration, policies, audit and reporting, notifications, multiple-office support, operational monitoring and a documented check-in event interface. Use separate development, test and production environments, automated quality/security checks and human production approval.

**Conversational booking:** The assistant can interpret a request such as “parking and a desk tomorrow afternoon,” ask for missing information and propose available options. It shows the final choice and asks for confirmation. The same server booking service validates and creates the booking; the assistant has no route around permissions or limits.

**Sensors and LEDs:** Occupancy is stored separately from booking rights and employee identity. A simulated sensor/indicator panel supports the POC. For full delivery, choose desk and parking devices through a site pilot. An indicator shows **bookable, reserved, in use or needs review**, with text in the app as well as color. Stale readings and occupied-without-booking mismatches trigger review. Device accuracy, update delay, installation and false readings are pilot acceptance items.

**Identity:** Use a clearly labelled synthetic identity adapter in the POC unless an approved Entra test tenant is ready. In full delivery, Entra sign-in and server-side ownership/admin checks are an early integration milestone. Account sign-in establishes identity; an app check-in establishes the employee's declared arrival.

**Scale and operations:** The target is multiple offices and at least 5,000 users. Full delivery must prove its agreed peak workload, release timing, backup restoration and rollback. Proposed starting targets are 99.9% monthly availability, recovery point within 15 minutes and recovery within four hours; these need discovery and operational validation before commitment.

## 5. Agentic SDLC and six-person team

The team should show **actual handoffs and human decisions**, using the workflow from the preparation presentation:

**Brief → agent refinement → human acceptance criteria → agent plan → human design approval → implementation → independent checks/review → correction → human acceptance**

Each agent task states its requirement, input material, allowed tools, expected artifact, acceptance checks and human owner. Failed checks return to implementation; disputed requirements return to the product owner. Keep one real example from the half-day change, including the approved overlap rule, plan, implementation, check result and human acceptance.

| Human owner | Main responsibility |
|---|---|
| Product/proposal lead | Client story, facilitator questions, scope, assumptions, slides and price |
| Technical lead | Interfaces, architecture, integration and technical decisions |
| Frontend engineer | Booking/check-in screens, conversational interface and accessibility |
| Backend engineer | Database constraints, booking, check-in and release |
| QA/evidence lead | Acceptance checks, edge cases, review evidence and demo recording |
| Platform/integration engineer | Local setup, worker, synthetic data, device simulation and run instructions |

Use concise versioned project files for requirements, decisions, evidence and handoffs. Keep agent guidance in a small `AGENTS.md`. A fresh agent session should be able to find the current agreed rule and next task from these files. Sally and Graph RAG in the preparation deck are examples, not required components of this new product.

## 6. Camp schedule and submission

| When | Team outcome |
|---|---|
| **Before build work** | Confirm the team's repository location and contents. If it has no application scaffold, create one Next.js/TypeScript app, dependency lockfile, Compose database, migration/seed path, `AGENTS.md` and README. Prove one teammate can start it before splitting file ownership. |
| **Day 1, first hour** | Obtain a written facilitator decision on half-day slots, overlapping employee limits and **“Book and check in now.”** Record the answer and the full-day fallback. Confirm approved AI access, assign owners and start the slide outline. |
| **Day 1, middle** | If the half-day change is accepted, implement segment-aware booking, then check-in and automatic release. Otherwise, implement the original full-day rules. Agree interfaces for chat and sensor simulation. |
| **Day 1, by 16:00** | Run the basic end-to-end POC, record initial checks and draft the client story and estimate. |
| **Day 2, morning** | Resolve core failures and run the focused checks above. Add chat/device demonstration only after the booking journey is reliable; capture evidence. |
| **Day 2, by 12:00** | Freeze features and capture the backup recording. |
| **Day 2, 12:00–13:30** | Finish the slides, verify claims and costs, rehearse and check repository access and run instructions. |
| **Day 2, 14:00** | Submit the final proposal, repository, instructions and POC access or recording. |

**Current setup finding:** Docker Compose is installed and the Docker engine responded with version **29.8.0** at this review. Confirm that the actual PostgreSQL service starts from Compose before build time. No matching Smart Office repository was found in the expected local Projects or Downloads locations; the team's shared repository may be elsewhere, so confirm its path and contents before claiming it is empty.

## 7. Full project roadmap and indicative commercials

The full offer must account for all **19 functional requirements, 9 business rules and 14 quality requirements**. Maintain a supporting requirement matrix showing each item's phase, owner, acceptance criterion and evidence status. Record the half-day changes explicitly against the original business rules.

The previous planning estimate was 265 person-days for the specified solution plus conversational booking and one sensor/LED integration path. Add a provisional **20 person-days** for half-day rules, screens, administration and overlap testing.

| Delivery phase | Person-days | Cost at €800/day |
|---|---:|---:|
| Discovery, requirements, UX and site/tenant assessment | 20 | €16,000 |
| Booking, half-day rules, administration, audit and chat | 105 | €84,000 |
| Entra, notifications, devices, LEDs and multiple offices | 85 | €68,000 |
| Security, privacy, accessibility, scale, recovery and device validation | 55 | €44,000 |
| Pilot, acceptance, training and handover | 20 | €16,000 |
| **Base software estimate** | **285** | **€228,000** |
| **20% contingency** | **57** | **€45,600** |
| **Indicative software envelope** | **342** | **€273,600** |

Plan **about 16 weeks baseline, up to 19 weeks with contingency**. This is an indicative fictional bid estimate, not a fixed-price commitment.

If the facilitator declines half-day booking, remove its provisional 20 person-days from the baseline: **265 base + 53 contingency = 318 person-days, or €254,400** at the same rate. Update the deck and acceptance examples to the approved full-day policy.

Show third-party costs separately on the commercial slide. The starting cloud allowance of **€600–€1,200/month** is unvalidated and excludes AI consumption and device costs. Obtain an indicative bill of quantities for up to **150 desk sensor points, 30 parking sensor points**, indicators, gateways, installation, calibration, licences and maintenance. Check existing Microsoft and approved AI entitlements. Do not present a hardware-inclusive total without a supplier-backed allowance or quote.

## 8. Ten-slide client presentation

1. **Executive Summary:** Need, recommendation, value, schedule and indicative price.
2. **Client Challenge and Success:** Uneven demand, no-shows, booking confidence and proposed measures.
3. **Complete Solution:** Employee/admin journeys; the approved booking choices (show half-day as a proposed option until accepted); chat, sensors, LEDs and SSO.
4. **Architecture:** Booking and occupancy as separate signals; identity, database, worker, integrations and operations.
5. **POC Scope:** FR-03, FR-08 and FR-09, the approved booking policy and the short must-demo criteria.
6. **POC Results and Actual SDLC:** Observed outcomes, simulations, workflow diagram and one real handoff example.
7. **SDLC for Full Delivery:** How the workflow expands to security, integration, deployment, operation and human release approval.
8. **Delivery Plan and Team:** Phases, milestones, ownership, client input and acceptance points.
9. **Commercial Offer:** Person-days, €800 rate, contingency, third-party costs and assumptions.
10. **Risks and Next Steps:** Written half-day and late-rebooking decision, tenant/tool access, device procurement and pilot.

Keep the deck client-focused. Put detailed tests, technical decisions, memory research and the 42-item traceability matrix in supporting repository material. Label every result **demonstrated, simulated or planned**. Export and visually check the presentation, then verify the repository, run instructions and recording before submission.

---

### Source material and change status

- `ZRS_Camp_Specification.pdf`: Complete client requirements. Its BR-01 and BR-02 still describe day-only bookings and a daily limit.
- `ZRS_Camp_Project_Task.pdf`: Deliverables, ten-slide limit, €800/person-day rate, judging and Day 2 deadline.
- `ZRSCamp26-HackathonPrep 1 (1).pptx`: Approved camp tooling and guidance for a human-supervised Agentic SDLC.
- **Latest team requirement in this conversation:** Morning half-day, afternoon half-day and full-day booking, with matching check-in windows and automatic release. This is the proposed amendment to confirm with the facilitator.
