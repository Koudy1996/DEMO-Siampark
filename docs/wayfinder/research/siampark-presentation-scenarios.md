# Siampark presentation scenarios and golden path

Wayfinder research note for **Choose 5–15 presentation scenarios and the golden path**.

## Selection result

Use **10 presentation scenarios**. One is the primary golden path; the remaining nine are shorter demonstrations or drill-downs that reuse the same canonical data.

The scenarios deliberately avoid full stock/order/accounting/project engines.

## Golden path — Scenario 1

### Long-term rental: from customer to active unit and first paid/synced invoice

**Primary persona:** Operations Manager

**Business story:** Siampark takes an available unit, links it to a known customer, prepares the agreement, activates occupancy, creates the first invoice, hands it to accounting and then sees the operational result reflected back in the ERP.

**What it proves**
- Party Registry reuse;
- Counterparty CUSTOMER relationship;
- Property and Unit;
- Contract and Document;
- signature simulation;
- Occupancy;
- Operational Invoice;
- accounting connector simulation;
- calendar/dashboard projections;
- cross-module ResourceRefs.

**Minimum presentation sequence**
1. Start on Dashboard and open an available Unit from a property occupancy warning/opportunity.
2. Select an existing CUSTOMER Counterparty from Party Registry search.
3. Create a LONG_TERM_LEASE Occupancy draft for the Unit.
4. Create/link the Contract and show a prepared Document; simulate signature and activate the Contract.
5. Confirm/start the Occupancy; Unit availability changes through the derived occupancy projection.
6. Create the first rent Invoice, approve it and trigger simulated accounting synchronization.
7. Show returned external reference/payment state and return to Dashboard/Property detail, where occupancy and finance summaries now reflect the story.

**Design target:** this path should be executable without navigating through unrelated administration/configuration.

## Supporting scenarios

### Scenario 2 — Short-stay booking imported from external channel

**Primary persona:** Operations Manager

1. Open Integrations/Bookings and trigger/open a simulated channel sync.
2. Inspect one imported booking with external ID.
3. Resolve booker Counterparty and target Unit.
4. Confirm Occupancy.
5. Show it in occupancy/calendar.
6. Optionally show confirmation-email state.

**Proves:** external booking seam, short-stay Occupancy, calendar, Party reuse.

### Scenario 3 — Asset maintenance incident

**Primary persona:** Operations Manager

1. Open Property/Asset detail showing an issue.
2. Create a linked maintenance Task.
3. Assign an internal Principal and optional service-supplier Counterparty.
4. Move Task to IN_PROGRESS and then DONE.
5. Show seeded service-report Document and Asset history/condition.

**Proves:** Property/Asset, work management, supplier linkage, document/history integration.

### Scenario 4 — Contract expiry and renewal

**Primary persona:** Operations Manager

1. Dashboard/calendar highlights an expiring Contract.
2. Open Contract and create a renewal Task.
3. Add/show amendment Document.
4. Simulate signature.
5. Close the renewal Task and show renewed/active agreement context.

**Proves:** derived deadline, Contract, Task, Document, signature seam.

### Scenario 5 — Received supplier invoice allocated to property

**Primary persona:** Finance Liaison or Operations Manager

1. Open/create a received Invoice from a SUPPLIER Counterparty.
2. Link it to Property/Asset and optional service Contract.
3. Approve it.
4. Trigger simulated accounting handoff.
5. Show the amount in a property cost / plan-vs-actual view.

**Proves:** supplier Counterparty, operational AP view, property cost context, external accounting boundary.

### Scenario 6 — Overdue customer invoice becomes paid after external sync

**Primary persona:** Finance Liaison

1. Finance list shows a derived OVERDUE customer Invoice.
2. Open Invoice and optionally record a reminder.
3. Open/trigger accounting/bank sync simulation.
4. Apply seeded payment confirmation.
5. Payment state becomes PAID and the overdue projection clears.

**Proves:** payment visibility without bank/accounting engine, derived state, integration handoff.

### Scenario 7 — CRM follow-up without a full CRM pipeline

**Primary persona:** Operations Manager / External Agent

1. Open a Counterparty.
2. Record CALL / MEETING / NOTE Relationship Activity.
3. Create a linked follow-up Task.
4. Assign Principal + due date.
5. Show it under My Tasks/calendar.

**Proves:** Party Registry + lightweight relationship history + work management.

### Scenario 8 — Management dashboard drill-down

**Primary persona:** Management

1. Open Dashboard.
2. Review occupancy, open tasks, expiring contracts, unpaid invoices and simple plan-vs-actual.
3. Click one warning/KPI.
4. Drill to canonical business record.
5. Return to overview after another scenario changes the source state.

**Proves:** ERP cohesion and reporting-as-projection.

### Scenario 9 — Restricted External Agent

**Primary persona:** External Agent

1. Switch/login to External Agent.
2. Show reduced navigation.
3. Search/open one assigned Counterparty and Task.
4. Search for an unrelated Counterparty and show no accessible result.
5. Attempt/open an unrelated direct Resource link and receive non-disclosing denial/not-found.

**Proves:** real OntOS Principal/Permission reuse and scope separation.

### Scenario 10 — Integration failure and deterministic recovery

**Primary persona:** Operations Manager / Finance Liaison

1. Open Integrations status.
2. Show one failed simulated accounting or booking sync.
3. Open its linked business record / sync detail.
4. Retry the integration.
5. Show deterministic success receipt/external ID/log entry.

**Proves:** credible external-system boundary without live provider dependency.

## Scenarios intentionally not selected

### Full warehouse/stock scenario
Not selected for the minimum presentation. Although Inventory exists, the presentation cost of Catalog-backed stock semantics and missing staff UI is high relative to the main Siampark property/rental story.

### Full quotation → order → delivery → invoice
Not selected. It adds several records/screens and is less central than property/rental/finance workflows.

### CRM opportunity/pipeline
Not selected. Source marks pipeline as later/optional; Relationship Activity + Task demonstrates enough CRM behavior.

### Project portfolio management
Not selected. Task workflows provide the needed planning behavior.

### Energy/meter automation
Not selected. Seeded property values are sufficient.

### Internal chat
Not selected. Contextual activities/comments provide adequate demonstration value.

## Scenario coverage matrix

| Capability | Scenarios |
|---|---|
| Party / Counterparty | 1, 2, 3, 5, 6, 7, 9 |
| Property / Unit | 1, 2, 3, 5, 8 |
| Asset | 3, 5 |
| Occupancy | 1, 2, 8 |
| Contract | 1, 4, 5 |
| Document | 1, 3, 4 |
| Operational Invoice | 1, 5, 6, 8 |
| Financial planning/reporting | 5, 8 |
| Task / calendar | 3, 4, 7, 8, 9 |
| Relationship Activity | 7 |
| Accounting simulation | 1, 5, 6, 10 |
| Booking simulation | 2, 10 |
| Signature simulation | 1, 4 |
| Permissions | 9 |
| Dashboard/reporting | 1, 8 |

## Presentation choreography

A coherent presentation can reuse one dataset and move through:

1. Management/Operations Dashboard.
2. Golden path long-term rental.
3. Asset-maintenance example in the same property.
4. Supplier/customer finance examples.
5. Contract deadline.
6. Restricted External Agent.
7. Integrations status as the closing proof that external boundaries are understood.

The remaining scenarios can be used selectively depending on audience interest.

## One-line decision

**Support ten coherent scenarios with long-term rental as the golden path; this single path demonstrates Party, Property/Unit, Contract/Document, Occupancy, Invoice and accounting simulation, while nine short scenarios cover booking, maintenance, contract renewal, supplier/customer finance, CRM follow-up, dashboarding, permissions and integration recovery without expanding into stock/order/accounting/project depth.**
