# Minimum high-value Siampark demo workflows

Wayfinder research note for **Choose the minimum high-value demo workflows**.

## Selection rule

A demo workflow is valuable when it:
- demonstrates a real source-backed Siampark business capability;
- crosses several canonical entities/modules so the ERP feels integrated;
- can be completed or explained in a few steps;
- avoids production-only depth;
- reuses existing OntOS capabilities where they add value.

The demo does not need to support every source process end-to-end.

## Primary workflows

### Workflow A — Long-term rental from Counterparty to first invoice

**Presentation value: very high.**

Demonstrates:
- Party / Counterparty reuse;
- Property and Unit;
- Contract + Document;
- signature simulation;
- Occupancy;
- Operational Invoice;
- accounting handoff;
- dashboard/calendar consequences.

Minimum flow:
1. Find or select an existing CUSTOMER Counterparty.
2. Open an available Unit and start a LONG_TERM_LEASE Occupancy.
3. Create/attach the lease Contract, simulate signature and activate it.
4. Confirm/start Occupancy.
5. Create and approve the first rent Invoice.
6. Trigger simulated accounting sync and show returned sync/payment state.
7. Return to Property/Dashboard and show the changed occupancy/finance context.

This is the strongest candidate for the later **golden path**.

### Workflow B — Short-stay booking imported from external channel

**Presentation value: high.**

Demonstrates:
- simulated booking integration;
- Unit occupancy/availability;
- Party/Counterparty;
- calendar;
- customer communication.

Minimum flow:
1. Trigger or open a simulated booking-channel sync.
2. Show one imported booking with external correlation ID.
3. Resolve/select the booker Party/Counterparty and Unit.
4. Confirm Occupancy.
5. Show the stay in the occupancy/calendar view.
6. Optionally simulate a confirmation e-mail.

Do not implement a real booking API.

### Workflow C — Property/asset maintenance incident

**Presentation value: high.**

Demonstrates:
- Property / Unit / Asset;
- Task work management;
- Principal assignment;
- supplier Counterparty;
- Document/history linkage.

Minimum flow:
1. Open a Property/Asset with a reported problem.
2. Create a maintenance Task from that context.
3. Assign internal responsible Principal and optional supplier Counterparty.
4. Move Task through IN_PROGRESS to DONE.
5. Attach/show a seeded service report Document and updated Asset condition/history.

No separate maintenance engine is needed.

### Workflow D — Received supplier invoice tied to property cost

**Presentation value: high.**

Demonstrates:
- Supplier Counterparty;
- Operational Invoice;
- Property/Asset cost context;
- accounting handoff;
- management finance.

Minimum flow:
1. Open/create a received Invoice from an existing SUPPLIER Counterparty.
2. Link it to Property/Asset and optionally Contract.
3. Approve it.
4. Trigger simulated accounting sync.
5. Show it in property cost / plan-vs-actual view.

Do not post it to a local ledger.

### Workflow E — Contract approaching expiry and renewal

**Presentation value: medium/high.**

Demonstrates:
- Contract lifecycle;
- derived expiring-soon state;
- Task/calendar;
- Document amendment;
- signature simulation.

Minimum flow:
1. Dashboard/calendar highlights an expiring Contract.
2. Open Contract and create a renewal Task.
3. Add/update amendment Document metadata.
4. Simulate signature.
5. Activate/record renewed agreement state or close the Task.

No generic workflow engine is required.

### Workflow F — Overdue invoice and external payment confirmation

**Presentation value: medium/high.**

Demonstrates:
- derived overdue state;
- invoice/payment status;
- reminder;
- accounting/bank boundary;
- integration simulation.

Minimum flow:
1. Finance list shows an unpaid overdue Invoice.
2. Open detail and optionally record/send a reminder.
3. Trigger/open simulated accounting/bank sync.
4. Apply seeded payment confirmation.
5. Invoice becomes PAID and disappears from overdue projection.

Authoritative bank matching remains external.

### Workflow G — Relationship follow-up becomes work

**Presentation value: medium.**

Demonstrates:
- Party Registry;
- Relationship Activity;
- Task;
- contextual links.

Minimum flow:
1. Open Counterparty.
2. Record CALL/MEETING/NOTE activity.
3. Create linked follow-up Task.
4. Assign responsible Principal and due date.
5. Show Task in My Tasks/calendar.

This is enough to demonstrate lightweight CRM without building a pipeline.

### Workflow H — Management overview and drill-down

**Presentation value: high but read-focused.**

Demonstrates the system as one ERP rather than isolated forms.

Minimum flow:
1. Open dashboard.
2. Show occupancy, open tasks, contract deadlines, unpaid invoices and plan-vs-actual summary.
3. Drill into one warning/KPI.
4. Reach the canonical Property/Contract/Invoice/Task record.
5. Return to overview after the underlying workflow changes.

Dashboard owns no source facts.

### Workflow I — Restricted external-agent view

**Presentation value: medium/high because it proves platform reuse.**

Demonstrates:
- Principal authorization;
- scoped navigation/search;
- no data leakage.

Minimum flow:
1. Switch/login as External Agent.
2. Show reduced navigation.
3. Search and open an assigned Counterparty/Task.
4. Search for unrelated Counterparty and show no accessible result.
5. Return to Operations persona.

This is deliberately short.

### Workflow J — Integration health / failure recovery simulation

**Presentation value: medium.**

Demonstrates realistic system boundaries without implementing integrations.

Minimum flow:
1. Open Integrations status.
2. Show accounting, booking, e-mail, signature and ARES state.
3. Open one failed simulated sync.
4. Retry it.
5. Show deterministic success receipt/log and linked business record.

No central integration system of record is introduced.

## Workflows intentionally not selected as primary

### Full purchase/sales quotation → order → delivery → invoice
Source-backed, but adds several entities and UI surfaces that overlap less with the property/rental story. Keep outside the minimum demo unless later scope selection finds it more valuable than one selected workflow.

### Full stock/material workflow
Existing Inventory backend is reusable, but requires extra presentation work and Commerce/Catalog semantics. Do not make it part of the primary presentation unless a later scope decision explicitly chooses it.

### Full CRM pipeline
The source calls it later/optional. Relationship Activity + follow-up Task is enough.

### Full project management
Task/work management is enough for the main story. Add Project only if a selected scenario needs portfolio/project-level milestones/budget.

### Energy meter workflow
Use seeded values or a property summary; real meter ingestion does not improve the minimum demo sufficiently.

### Internal chat
Low value relative to implementation complexity; contextual notes/activity are enough.

## Presentation sequencing guidance

The workflows should not be demonstrated as ten disconnected mini-products.

A persuasive sequence is:

1. **Dashboard** establishes the portfolio/business state.
2. **Long-term rental golden flow** changes Party → Unit → Contract → Occupancy → Invoice.
3. **Maintenance flow** proves operations/tasks/assets.
4. **Finance/accounting sync** proves specialist-system boundary.
5. **External-agent view** proves platform authorization.
6. Optional short booking/integration-health examples fill remaining stakeholder interest.

## One-line decision

**The demo should center on a long-term-rental workflow and support a small family of cross-module flows—short-stay booking, asset maintenance, supplier/customer invoices, contract renewal, relationship follow-up, management drill-down, restricted access and simulated integration recovery—while full stock, order management, CRM pipeline, project management, energy automation and chat stay outside the primary workflow set.**
