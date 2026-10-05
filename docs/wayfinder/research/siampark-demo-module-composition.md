# Logical Siampark demo modules and Application Composition

Wayfinder research note for **Choose the logical demo modules and application composition**.

This decision separates **business ownership modules**, **reused OntOS modules**, and **presentation compositions/views**. It does not define final screens.

## Composition principles

- Reuse existing modules only when semantics match.
- Every persisted business fact has one owner.
- A navigation area does not have to equal one technical module.
- Dashboard/report/calendar/integration-status surfaces may aggregate public APIs without becoming new systems of record.
- Cross-module ResourceRefs do not automatically create hard module dependencies.
- Keep the number of new demo modules small enough for rapid implementation but not so small that unrelated ownership collapses into one “ERP” bucket.

## Required reused platform

### Core + Shell
Always reused:
- authentication;
- Principal/Tenant/Legal Entity context;
- permissions;
- Actions/governed reads;
- module composition/state;
- global search framework;
- routing/resource detail framing.

### Party Registry
Required reused business capability:
- Party;
- Counterparty;
- CUSTOMER/SUPPLIER roles;
- contact points/relationships;
- Contacts page/search;
- ARES seam.

## Proposed thin Siampark business modules

### 1. `siampark.property` — Property & Assets

Owns:
- Property
- Unit
- Asset

Purpose:
- real-estate/unit registry;
- asset/equipment placement and lifecycle;
- property/asset reference values;
- security devices as Asset category;
- property technical overview.

Does not own:
- occupancy/rental;
- maintenance Task state;
- accounting depreciation;
- supplier/customer identity.

### 2. `siampark.occupancy` — Stays & Rentals

Owns:
- Occupancy

Purpose:
- short stay + long-term lease occupancy lifecycle;
- unit availability projection;
- external booking correlation/sync state;
- occupancy calendar data.

References:
- Unit;
- customer Counterparty;
- optional Contract.

Does not own:
- Property/Unit identity;
- Party identity;
- Contract file;
- Commerce Inventory Reservation.

### 3. `siampark.agreements` — Contracts & Documents

Owns:
- Contract
- Document Record

Purpose:
- contract terms/status/milestones;
- document metadata/version/reference;
- signature-provider simulation;
- document links to other Resources.

This is intentionally one thin capability for the demo so every business module does not invent its own attachment store.

### 4. `siampark.work` — Tasks & Work Planning

Owns:
- Task
- optional Project only if later scenarios retain it

Purpose:
- maintenance;
- incidents;
- inspections;
- CRM follow-ups;
- internal tickets;
- read-only calendar projection from work dates.

Aligned to OntOS Projects semantics, but implemented as a minimal slice because no reusable Projects vertical exists.

### 5. `siampark.billing-finance` — Operational Billing & Management Finance

Owns:
- Operational Invoice
- Financial Plan Entry

Purpose:
- issued/received billing facts;
- payment-status visibility;
- accounting handoff/sync state;
- budget/plan/expected cash-flow;
- plan-vs-actual management views.

Does not own:
- statutory ledger/posting;
- authoritative bank matching;
- tax/FX/depreciation/closing/payroll.

### 6. `siampark.relationships` — CRM Relationship Activity

Owns:
- Relationship Activity
- optional Opportunity if retained later

Purpose:
- notes/calls/e-mails/meetings around Party/Counterparty;
- lightweight relationship history;
- optional opportunity presentation.

Does not own:
- person/organization/contact master identity;
- purchasing Customer profiles from Commerce.

## Conditional existing modules

### `commerce.inventory`

Install/use only if a selected scenario includes real stock/material movement.

If used, expected composition also needs the Catalog semantics required for Catalog-to-Stock binding.

Do not activate merely because the source lists “Sklad”.

### `commerce.catalog`

Use only as a real product/material catalogue dependency or product/service story. Never use for Property, Unit or Asset just to reuse code.

### `payment.term-catalog`

Use if the invoice story benefits from canonical selectable payment terms.

### `commerce.pricing`

Use only if a selected scenario actually demonstrates quotation/price-rule semantics. Manual/simple operational invoice amounts do not justify the whole pricing domain.

### Other Commerce verticals

Assortment, Market Catalog, Storefront Registry, Price Group Catalog and Commerce Customer Context should remain outside the default Siampark ERP composition unless a specific scenario proves their semantic need.

## Presentation-only compositions / views — not data owners

### Dashboard / Management overview

Aggregates public reads from:
- Property/Asset;
- Occupancy;
- Billing/Finance;
- Work;
- Party/Relationships.

May show KPIs, alerts and links. Owns no canonical KPI source data.

### Unified calendar

Aggregates:
- Task due dates;
- Occupancy date ranges;
- Contract deadlines;
- Asset inspection dates.

Read-only in the basic demo. Editing happens in the owning record.

### Integrations status

Aggregates connector states from:
- accounting;
- booking;
- e-mail;
- signature;
- ARES;
- optional payroll.

Owns no business facts.

### Reporting

Reports are module/public-read projections, not another master data module.

### Global search

Reuse Shell search. New modules publish only the search contributions required by selected scenarios.

## Suggested presentation navigation

Navigation should be understandable to a business audience, not mirror internal module IDs.

1. **Přehled**
2. **Nemovitosti a majetek**
3. **Pobyty a pronájmy**
4. **Kontakty a vztahy**
5. **Smlouvy a dokumenty**
6. **Finance**
7. **Úkoly a kalendář**
8. **Integrace**
9. **Sklad** — only if retained

These are presentation areas; each may combine several module-owned reads.

## Dependency guidance

- `party.registry` is the shared identity foundation for relationships, occupancy, agreements and billing.
- `siampark.occupancy` references Property/Unit and Counterparty; use ResourceRefs/public reads rather than shared tables.
- `siampark.work` should be highly decoupled: Tasks hold ResourceRefs and do not need hard dependencies on every possible target module.
- `siampark.agreements` similarly stores typed ResourceRefs for contract/document targets.
- `siampark.billing-finance` may reference Contract/Property/Project context without taking ownership.
- optional Inventory remains a separate existing owner.

## What not to create

- one monolithic `siampark.erp` module owning everything;
- a second customer/contact module;
- an Auth/users business module;
- an Accounting module pretending to be statutory accounting;
- a generic workflow engine;
- a generic integration hub solely for the demo;
- separate technical modules for Dashboard, Calendar or “Reports” if they only compose existing reads.

## One-line decision

**Compose the demo from Core/Shell + Party Registry plus six thin business owners—Property, Occupancy, Agreements/Documents, Work, Billing/Finance and Relationships—while Dashboard, Calendar, Reporting and Integrations are presentation compositions over public reads; Inventory/Catalog/Payment Terms and other Commerce modules are installed only when a selected scenario genuinely needs their semantics.**
