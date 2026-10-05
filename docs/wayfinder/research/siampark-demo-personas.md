# Siampark demo personas, scope and visible permission differences

Wayfinder research note for **Define demo personas, scope and visible permission differences**.

## Governing rule

The demo must reuse OntOS Principal / Tenant / Legal Entity / Permission boundaries, but it must not become a complete RBAC design. Only permission differences that create a clear presentation effect should be configured.

## Scope assumptions

### One OntOS Tenant

The presentation uses one OntOS Tenant representing the Siampark deployment/customer context.

No multi-tenant administration UI is needed.

### One managed Legal Entity

Use one active Legal Entity:

- **Siampark s.r.o.**

This is sufficient for the source requirements and avoids introducing intercompany/accounting-group complexity that does not improve the demo.

### External business subjects stay Party / Counterparty

Renters, customers, suppliers and contractors are not Principals merely because they exist in the ERP.

A person becomes a Principal only when they actually need authenticated application access.

## Minimal persona set

### 1. Management

Purpose:
- demonstrate overview, finance visibility and cross-domain drill-down.

Visible access:
- dashboard and reporting;
- properties/units/assets read;
- occupancies/contracts read;
- invoices/finance read;
- tasks/calendar read;
- contacts/counterparties read;
- integration-status read.

Minimal write capability:
- optionally approve an invoice or confirm one management-level action used by the golden path.

Avoid:
- full administrator/configuration UI;
- detailed permission editing;
- identity administration during the presentation.

### 2. Operations Manager

Purpose:
- primary interactive persona for the golden path.

Visible access:
- properties, units and assets;
- occupancies/rentals;
- contracts/documents;
- contacts/counterparties;
- tasks/maintenance/calendar;
- operational invoice creation/read;
- booking/accounting/signature integration status needed by owned workflows.

Writes:
- create/edit Occupancy;
- create/activate Contract where scenario requires;
- create/assign/complete Task;
- create operational Invoice draft;
- update operational Property/Asset state where scenario requires;
- record relationship activity.

This should be the default presenter account because it touches most of the demo without implying statutory-accounting authority.

### 3. Finance / Accounting Liaison

Purpose:
- show the boundary between operational ERP and specialist accounting.

Visible access:
- invoices;
- payment status;
- accounting-sync state/log;
- budgets / Financial Plan Entries;
- finance/reporting views;
- contracts and Counterparty data required by finance;
- read-only property/project context used for allocation.

Writes:
- approve operational Invoice;
- trigger/retry accounting handoff simulation;
- update/import simulated payment/accounting result if the presentation uses this Action.

Avoid:
- statutory posting/ledger actions because those do not exist inside OntOS.

### 4. External Agent / Sales Collaborator

Purpose:
- provide one highly visible restricted-access contrast.

Visible access:
- only assigned/allowed counterparties or relationship records;
- assigned Tasks/follow-ups;
- limited contract/opportunity context when required.

Explicitly hidden:
- finance;
- broad property portfolio;
- internal management dashboard;
- accounting integration;
- unrelated counterparties and tasks.

This persona is the strongest demonstration that business roles/relationships and application permissions are separate.

## How many accounts actually need to be demonstrated

Seed all four personas so the data model is believable, but only **two authentication contexts need to be visibly demonstrated**:

1. **Operations Manager** — broad operational access and golden-path interaction.
2. **External Agent** — restricted view proving authorization/scoping.

Management and Finance can exist as seeded accounts and be used only if a selected scenario needs them.

This gives visible authorization value without turning the presentation into an RBAC demo.

## Permission model for the demo

### Keep permission bundles coarse

Use a small fixed configuration aligned with existing OntOS permissions/scopes.

Conceptually:

- `management`
- `operations`
- `finance`
- `external_agent`

These names are demo configuration labels, not new canonical business-role Resources.

### Module-area access is enough for most distinctions

Use module/access permissions to control broad visibility:
- property;
- occupancy;
- agreements;
- work;
- billing-finance;
- relationships;
- integrations/dashboard.

### One resource-level restriction is enough to prove isolation

For External Agent, restrict the visible data set to assigned Counterparties/relationship activities/Tasks.

The demo does not need to demonstrate every possible row-level rule.

### Counterparty role is never permission

A Party being CUSTOMER or SUPPLIER does not grant a Principal access.

Likewise, a CONTACT_PERSON_OF relationship has no authorization meaning.

## Minimal visible authorization scenarios

### A. Navigation difference

Operations Manager sees the normal operational navigation.

External Agent sees only:
- Kontakty a vztahy;
- Moje úkoly;
- optionally a limited contract/opportunity link.

Finance, Integrations and property-wide views are absent.

### B. Search difference

Global search for a Counterparty visible to Operations succeeds.

The restricted External Agent either:
- sees only assigned Counterparties, or
- receives no result for an unrelated Counterparty.

### C. Direct-resource protection

If the External Agent attempts to open an unrelated ResourceRef, the application must not leak its detail.

A generic forbidden/not-found behavior is enough; no elaborate security error UI is required.

## What is intentionally not designed

- full role editor;
- permission matrix administration;
- multi-legal-entity switching;
- approval hierarchies;
- field-level permissions;
- configurable ABAC rules;
- temporary delegation;
- complete audit-admin UI;
- employee/HR organization tree.

## One-line decision

**Use one Tenant and one Siampark Legal Entity with four seeded personas—Management, Operations Manager, Finance Liaison and restricted External Agent—but visibly demonstrate only broad Operations access versus a narrowly scoped External Agent; reuse OntOS Principal/Permission boundaries, keep permissions coarse, and do not build a complete RBAC administration experience.**
