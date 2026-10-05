# Canonical minimum Siampark demo domain model

Wayfinder research note for **Define the canonical minimum Siampark demo domain model**.

This is a domain-boundary decision, not the final implementation specification. Lifecycle states, module composition, screens, scenario selection and MUST HAVE/SIMULATION classification remain downstream tickets.

## Primary sources and upstream constraints

- `SOUHRN_FUNKCNI_SPECIFIKACE_ERP_SIAMPARK.pdf`
- `Zápis z úvodních jednání.pdf`
- `docs/PRODUCT.md`
- `docs/contexts/ontos/CONTEXT.md`
- `docs/contexts/projects/CONTEXT.md`
- `docs/contexts/inventory/CONTEXT.md`
- Party Registry ADRs and current Party Registry implementation
- previous Wayfinder decisions on source reconciliation, Party/Counterparty, Inventory/property, Projects/tasks and accounting/finance boundaries

## Modeling rules

1. One real business fact has one canonical owner.
2. Cross-module references use ResourceRefs/public contracts, not copied master records.
3. Do not create a generic Customer, Supplier, Person, Employee or User business master.
4. Do not model a business relationship as a permission.
5. Do not turn every source heading into an entity.
6. Prefer one entity with a type/kind when two source concepts share identity/lifecycle sufficiently for the demo.
7. Do not create entities only to power a report; reports are projections over owned facts.
8. External sync states/correlations are integration metadata, not replacement business entities.

## Existing canonical Resources to reuse

### Core

#### Legal Entity
The managed Siampark operating/accounting company and trusted scope.

#### Principal
Authenticated internal/external system actor used for assignment, Actions, audit and permissions.

### Party Registry

#### Party
External PERSON or ORGANIZATION identity.

#### Counterparty
Commercial/contractual context between Party and Siampark Legal Entity.

#### Counterparty Role Period
Existing CUSTOMER / SUPPLIER role lifecycle.

#### Contact Point / Official Identifier / Party Relationship
Shared contact/identity/relationship facts. Contact person relationships remain here.

### Existing optional backend Resources

#### Stock Item / Stock Location / Stock Position
Use only if operating-material Inventory is retained in the selected scenarios.

#### Payment Term
Use only if invoice/payment-term selection adds presentation value.

## New thin canonical demo entities

### 1. Property

Represents one managed real-estate object/building/site.

Minimum meaning:
- stable identity;
- name/display label;
- structured address/location;
- property type;
- basic technical summary;
- responsible PrincipalRef;
- acquisition/reference value fields if needed;
- current operational state fields;
- optional external/reference identifiers.

Owns no customer identity, accounting ledger or task lifecycle.

### 2. Unit

Represents one usable/subdivided unit inside a Property: apartment, room, office, commercial unit or other rentable/operational space.

Minimum meaning:
- PropertyRef;
- unit number/name;
- unit type;
- capacity/size/basic technical attributes;
- basic operational availability flag only where not derived from Occupancy.

**Important:** occupancy should normally be derived from Occupancy records rather than maintained as duplicate canonical state.

### 3. Asset

Represents one individually managed durable item/equipment/fixed asset.

Minimum meaning:
- name / asset tag;
- category;
- optional serial number;
- PropertyRef and optional UnitRef for placement;
- acquisition date/value;
- current/reference value + as-of date where useful;
- responsible PrincipalRef;
- optional supplier CounterpartyRef;
- basic operational condition/status;
- optional accounting-system correlation.

Security devices are Asset category/type, not a separate SecurityDevice entity.

### 4. Occupancy

One minimal entity for planned/actual use of a Unit by an external customer/renter.

`kind` distinguishes:
- `SHORT_STAY`
- `LONG_TERM_LEASE`

Minimum meaning:
- UnitRef;
- customer CounterpartyRef;
- start/end;
- party/person count where useful;
- kind;
- status (defined later);
- optional ContractRef;
- optional external booking correlation;
- simple price/financial summary only if needed for presentation.

This entity deliberately avoids separate duplicated RoomReservation and LeaseOccupancy masters. If later lifecycle research proves the two need incompatible behavior, they may split; the demo starts unified.

### 5. Contract

Represents the business agreement/contract record, distinct from its file.

Minimum meaning:
- contract type;
- one or more CounterpartyRefs as external parties;
- start/end;
- key amount/periodic amount where relevant;
- notice/renewal date;
- responsible PrincipalRef;
- status (later ticket);
- typed context ResourceRefs, e.g. Property/Unit/Asset/Project;
- primary DocumentRef and optional additional DocumentRefs.

A Contract is not the PDF file and does not copy Party master data.

### 6. Document Record

Represents business-document metadata and attachment/reference state.

Minimum meaning:
- title/file name;
- document type;
- version label or revision;
- created/effective date;
- responsible PrincipalRef or creator;
- one primary target ResourceRef plus optional related ResourceRefs;
- storage/reference placeholder;
- optional signature-provider state/correlation.

The demo may seed file links/placeholders because generic Shell media attachment is not currently implemented.

### 7. Operational Invoice

Represents OntOS-owned billing/operational invoice facts, not statutory posting.

Minimum meaning:
- direction: issued / received;
- CounterpartyRef;
- issue date / due date;
- amount / currency;
- optional PaymentTermRef;
- operational status;
- payment status;
- optional ContractRef;
- contextual ResourceRefs such as Property/Unit/Project/Order;
- external accounting reference;
- accounting sync state;
- optional DocumentRef.

Do **not** add ledger account, posting entries, VAT-engine state, FX-posting state or statutory-book ownership.

### 8. Task

Thin implementation aligned with OntOS Projects semantics.

Minimum meaning:
- title;
- short description;
- type/category;
- status;
- priority;
- due date/date range;
- assignee PrincipalRef;
- typed context ResourceRefs to Property/Unit/Asset/Party/Counterparty/Contract/Occupancy/etc.;
- short comment/history surface.

Maintenance job, inspection, incident, CRM follow-up and internal ticket are Task types/contexts, not separate engines.

### 9. Financial Plan Entry

Small management-planning fact, not accounting.

Minimum meaning:
- one target/context ResourceRef;
- period/date;
- direction: expected income / expense;
- planned amount;
- optional imported/confirmed actual amount;
- probability/scenario only if needed;
- short note.

This supports budgets, expected cash-flow and plan-vs-actual without building a ledger.

### 10. Relationship Activity

Minimal CRM/history record when the demo needs visible relationship history.

Minimum meaning:
- PartyRef or CounterpartyRef;
- type: NOTE / CALL / EMAIL / MEETING;
- occurredAt;
- actor PrincipalRef;
- short summary;
- optional related ResourceRef such as Contract/Occupancy/Opportunity.

This is contextual engagement history, not Party identity.

## Scenario-conditional entities — do not include by default unless downstream tickets prove presentation value

### Opportunity
Needed only if the demo shows a real CRM opportunity/pipeline flow. Pipeline is already marked later/optional in the source.

### Commercial Order
Needed only if the purchase/sales quotation → order → delivery → invoice chain is selected for presentation.

### Project
Needed only if a scenario requires project-level status, milestones, budget and evaluation beyond ordinary Tasks.

### Utility Reading / Meter
Needed only if energy/media monitoring becomes a selected scenario. Otherwise show seeded current values on Property/Unit.

### Payment Observation
Needed only if the presentation must show multiple individual payments/matching events. Otherwise payment state/last confirmed payment remains on Operational Invoice.

### Integration Run / Sync Log
Useful as presentation metadata, but not a core business entity. It may live as a lightweight integration projection/log.

## Explicit non-entities

These source terms must **not** become new master entities in the canonical demo model:

- Customer → Party/Counterparty role/context
- Supplier → Party/Counterparty role/context
- Contact person → Party + Party Relationship
- Internal employee/responsible person → Principal for assignment/access
- Security device → Asset category
- Calendar event → derived view of dates from owned records
- Dashboard/report → projection
- Payment status → Invoice attribute unless Payment Observation is scenario-selected
- Accounting posting / ledger row → external accounting fact, not OntOS entity
- Sync status → integration metadata
- Occupancy status of Unit → derived from Occupancy where possible
- Asset location → reference to Property/Unit, not a generic Location master
- generic Entity/Relation record → forbidden by OntOS ownership model

## Core relationship graph

```text
Legal Entity (Siampark)
  |
  +-- Counterparty -- Party
  |       |
  |       +-- Contract
  |       +-- Occupancy
  |       +-- Operational Invoice
  |       +-- Relationship Activity
  |
Property
  |
  +-- Unit
  |    |
  |    +-- Occupancy -- Counterparty
  |    +-- Asset
  |
  +-- Asset

Contract
  +-- Counterparty(s)
  +-- context ResourceRefs -> Property / Unit / Asset / optional Project
  +-- Document Record(s)

Operational Invoice
  +-- Counterparty
  +-- optional Contract
  +-- context ResourceRefs -> Property / Unit / optional Project / optional Order
  +-- external accounting correlation

Task
  +-- assignee Principal
  +-- context ResourceRefs -> any relevant business Resource

Financial Plan Entry
  +-- context ResourceRef -> Property / Contract / optional Project / other supported scope

Stock Location (if Inventory selected)
  +-- optional placement ResourceRef -> Property / Unit
```

No generic relation table is required.

## Minimal traceability to source capability groups

| Source capability | Canonical model support |
|---|---|
| Property / units / assets | Property, Unit, Asset |
| Accommodation / rentals | Occupancy + Contract + Counterparty |
| CRM / contacts | Party Registry + Relationship Activity; Opportunity optional |
| Contracts / documents | Contract + Document Record |
| Maintenance / ticketing / calendar | Task; calendar derived from dates |
| Invoicing / payment visibility | Operational Invoice |
| Finance / budget / cash-flow | Financial Plan Entry + imported invoice/payment actuals |
| Inventory / materials | existing Inventory Resources, conditional |
| Purchase/sales flow | Commercial Order optional |
| Security systems evidence | Asset + Task + Document Record |
| Reporting/search | projections over all Resources |
| Users/access | Principal/Core permissions |
| Integrations | correlations/status at module seams, not replacement domain entities |

## Why this is minimal

- It reuses all shared identity rather than creating CRM/customer duplicates.
- Property and Unit are separated only because unit-level occupancy/rental requires stable identity.
- Asset stays separate from stock because its lifecycle is individual, not quantity-based.
- One Occupancy entity covers short and long use until lifecycle evidence proves a split is necessary.
- Task absorbs maintenance/incident/follow-up work.
- Financial Plan Entry supports management finance without accounting.
- Document Record separates file/document metadata from Contract and other business records.
- Optional source areas remain optional entities rather than contaminating the core model.

## One-line decision

**The minimum canonical demo model reuses Core + Party Registry and adds only Property, Unit, Asset, Occupancy, Contract, Document Record, Operational Invoice, Task, Financial Plan Entry and Relationship Activity; Inventory/Payment Terms are reused conditionally, while Opportunity, Commercial Order, Project, Utility Reading and Payment Observation remain scenario-driven extensions.**
