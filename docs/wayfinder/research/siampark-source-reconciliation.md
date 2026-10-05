# Siampark source requirements reconciliation

Wayfinder research note for **Reconcile Siampark source requirements for demo relevance**.

This note reconciles the two Siampark source documents only. It does **not** decide the final demo domain model, OntOS reuse, screen set, workflow set, or implementation scope; those remain separate Wayfinder decisions.

## Primary sources

- **S1 — `SOUHRN_FUNKCNI_SPECIFIKACE_ERP_SIAMPARK.pdf`**, 16 pages, dated 26 Aug 2026.
- **S2 — `Zápis z úvodních jednání.pdf`**, 2 pages.

Page references below refer to the PDF page numbers in those source files.

## Resolution

The two documents are broadly compatible, but they have different authority and purpose:

1. **S2 is project/discovery context, not a detailed functional specification.** It establishes that Siampark wanted an ERP linked to third-party systems, explicitly mentions Evala and external payroll, records the need for accounting-process discovery, and records that this discovery did not complete. It also records a delivery-pressure context around the subsidy project. [S2 pp. 1–2]
2. **S1 is the functional capability inventory.** It deliberately expands a prior module list into business-purpose descriptions, but explicitly says that describing a capability does not automatically mean it must be activated, that specialist products should be preferred where appropriate, and that detailed accounting/tax/bank operations depend on the selected accounting system. [S1 pp. 4, 15–16]
3. Therefore the downstream demo specification must treat **S1 as a normalized catalogue of candidate business capabilities, not as a requirement to implement every bullet**. [S1 pp. 4, 15–16]
4. The unresolved facts in both sources must be separated from the demo's safe simplifications: actual process ownership, accounting-product choice, real data samples, mandatory management reports, external-product allocation, and final acceptance scenarios were not fully confirmed. [S1 pp. 1–4, 15–16; S2 pp. 1–2]

## Consolidated business capability groups

The source requirements can be normalized into the following groups. These groups are deliberately broader than the original module headings because several source sections describe the same underlying business object or workflow from different viewpoints.

### 1. Property, units and asset operations — high demo relevance

Siampark needs a unified operational view of properties, units, equipment/fixed assets, values, documents, lifecycle events, maintenance, engineering/permit processes, inventory checks, energy/media records, and investment planning. The source explicitly calls property/asset management one of the main operational areas. [S1 pp. 5–7]

For demo discovery, this is a **central business capability**, while detailed depreciation mechanics, tax accounting and automated meter ingestion are depth features, not separate top-level business areas. [S1 pp. 5–7]

### 2. Accommodation, reservations and long-term rentals — high demo relevance

The sources require short stays, long-term leases, occupancy/calendar visibility, links to units, parties, contracts, recurring obligations and operational tasks, plus possible external booking-platform connectivity. [S1 p. 11]

This capability should be treated as an operational use of the same property/unit and party data, not as an isolated duplicate property registry. [S1 p. 11]

### 3. Parties, contacts and commercial relationships — high demo relevance

The CRM section requires people/organizations, contact details, person-to-organization relationships, history of interactions, opportunities, responsible owners and search. Customer and supplier language also appears in purchasing, invoicing, accounting and property/energy contexts. [S1 pp. 5–13]

The repeated use of customer/supplier/contact terms is one cross-cutting identity concern, not evidence for separate identity models per module. The exact canonical OntOS mapping is intentionally left to the Party/Counterparty Wayfinder ticket. [S1 pp. 5, 7–10, 13]

### 4. Contracts, documents and media — high demo relevance

Contracts have parties, dates, status, responsible person, key terms, milestones and amendments. Documents/media attach to parties, contracts, properties, tasks and other records; selected documents may later be handed to a signature provider. [S1 pp. 11–12]

This is a cross-cutting capability, not a separate document copy inside each business module. [S1 pp. 11–12]

### 5. Tasks, maintenance, calendar and projects — high demo relevance

Tasks/ticketing recur in maintenance, security incidents, CRM and general planning. The source also requires a calendar view, project milestones, simple budgets, responsible people, capacity hints and project status. [S1 pp. 6, 11, 13–14]

The source itself favors a simple calendar/dashboard and lightweight planning rather than a sophisticated planning engine. [S1 p. 14]

### 6. Invoicing and operational receivables/payables view — high demo relevance, accounting boundary unresolved downstream

The source requires issued and received invoices, document states, attachments, links to party/contract/order/property, payment-status visibility, overdue items, reminders, basic invoice variants and possible recurring drafts. [S1 pp. 7–8]

However, posting, statutory accounting, bank operations, FX and accounting books are assigned to the selected accounting system. OntOS may prepare/hold operational billing facts and show returned accounting/payment state. [S1 pp. 8–10]

### 7. Financial planning, budgets and management overview — medium/high demo relevance

The source requires planned versus actual values, expected receipts/payments, cash-flow projection, budget by property/centre/activity, simple variance views and project finance. It explicitly says this finance layer should not replace accounting. [S1 p. 10]

For demo discovery, these are primarily **management views over operational and imported/confirmed financial facts**, not evidence for a second accounting engine. [S1 p. 10]

### 8. Inventory and operating materials — medium relevance pending scenario selection

The source includes stock movements, min/max levels, consumption, batches/serials, material planning, lead times and links to purchasing, invoices, tasks and maintenance. [S1 pp. 4–5]

The core business need is evidence of operating materials/equipment and their movements. Optimization, MRP-like planning and full batch/serial sophistication are deeper production concerns unless a selected presentation scenario specifically needs them. [S1 pp. 4–5]

### 9. Purchasing and selling document flow — medium relevance pending scenario selection

The source describes sales and purchase orders, simple states, open orders and a chain such as quotation → order → delivery → invoice. [S1 pp. 5, 8]

For demo discovery, the important requirement is the **traceable business chain and data reuse between records**, not a complete order-management suite. [S1 pp. 5, 8]

### 10. Reporting, dashboarding, search and filtering — high cross-cutting presentation relevance

Reporting is explicitly cross-cutting and should draw from confirmed data in other modules rather than create another system of record. The source also requires dashboards, property statistics, accounting-derived data, project/task views, CRM views, exports, global search and consistent filters. [S1 pp. 12–13]

This is strongly presentation-relevant because it exposes value from other capabilities, but exact management KPIs were never fully confirmed. [S1 pp. 2, 12]

### 11. Users, access and notifications — minimum credible cross-cutting capability

The source expects per-user accounts, role-based area access, activation/deactivation, restricted external-team access, basic history and in-system/e-mail notifications. [S1 pp. 14–15]

For the demo, this establishes the need to show credible identity/scope differences, but not to design a complete enterprise RBAC or notification platform. [S1 pp. 14–15]

### 12. Security-system evidence — low/conditional demo relevance

The original requirement is interpreted in S1 as **evidence and service oversight for existing physical security devices**, not as building a security system. It consists of device records, service dates, documents, state and an incident/task handoff. [S1 p. 11]

Unless a selected scenario needs it, this is naturally suited to a thin example or placeholder rather than a major demo module. [S1 p. 11]

### 13. External integrations — cross-cutting seam, real integrations not required for the demo

The sources mention or imply accounting systems, Evala, payroll, bank data, reservation platforms, e-mail, electronic signature and other providers. S2 records Evala as something to evaluate, not as a final locked target, and payroll as an external-system need. [S2 p. 1]

S1 repeatedly prefers specialist systems and simple integration over reimplementation, and makes several integrations conditional on confirmed products/APIs. [S1 pp. 4, 8–12]

## Repeated or overlapping requirements that must not become duplicate models

### Customer / supplier / contact identity

Customer/supplier concepts appear in sales, invoices, accounting, energy, CRM, rentals and contracts. These are overlapping roles/views of people or organizations. The source does not justify separate identity masters for each area. [S1 pp. 5–13]

### Property / unit / asset / equipment

Property and unit are central operational subjects. Equipment/fixed assets can be located in them; accommodation and security records also refer back to the same units/objects. These should be resolved into one coherent property/asset boundary downstream instead of independent registries. [S1 pp. 5–7, 11]

### Invoice / receivable / payable / payment / accounting record

The same financial event is viewed from invoicing, finance and accounting sections. The source distinguishes operational document/payment visibility from statutory accounting ownership. These sections overlap and must not create duplicate financial truth. [S1 pp. 7–10]

### Task / maintenance / incident / project activity

Tasks are referenced from assets, maintenance, security, CRM and project management. They are one work-management concern with different contexts, not separate task engines. [S1 pp. 6, 11, 13–14]

### Contract / document / attachment

Contracts are domain records while their files and related technical/legal documents are stored through the cross-cutting document capability. Modules may reference them, but should not own independent copies. [S1 pp. 6, 11–12]

### Reporting

Asset reports, finance reports, accounting reports, task/project reports and CRM statistics are views over owned facts. S1 explicitly says reporting should not create an additional standalone evidence store. [S1 pp. 7, 9–10, 12, 14]

### Communication and notification

CRM activities, accommodation messages, internal chat, e-mail delivery and system notifications overlap as communication surfaces, but the source does not require one generalized communication platform. [S1 pp. 11–15]

## Conflicts and tensions

### Accounting-product identity is unresolved, not truly contradictory

S2 says Evala had to be evaluated and its role confirmed. S1's discovery history mentions i6 and another foreign solution, while the functional section deliberately refers to a future “selected accounting system.” No source establishes one final accounting product. [S2 p. 1; S1 pp. 2, 8–10]

**Consequence:** downstream work must specify a provider-neutral accounting handoff/simulation unless a human later fixes a concrete product.

### Extensive accounting wishlist versus “do not build parallel accounting”

S1 lists double-entry accounting, journals, ledgers, bank operations, depreciation, closing and statutory reports, but explicitly frames these as capabilities expected from a specialist accounting product and says OntOS should not create parallel accounting. [S1 pp. 8–10]

**Consequence:** this is a scope tension resolved by source intent: the accounting wishlist defines external-system expectations and integration/reporting needs, not a mandate to implement those accounting internals in OntOS.

### Detailed module list versus unconfirmed actual use

S1 explicitly says a described function does not automatically have to be activated and ends by stating that actual use of the functions still needs confirmation. [S1 pp. 4, 15–16]

**Consequence:** the module list is discovery input, not the final demo menu.

### Delivery pressure versus incomplete discovery

S2 records a subsidy-driven priority window to 31 Dec 2026 while also recording that the intended process discovery with accountants did not complete. S1 repeats that key data/process/acceptance questions remained open. [S2 pp. 1–2; S1 pp. 1–4]

**Consequence:** the demo should prefer safe, explicit simplifications over pretending that missing production-process detail was confirmed.

## Open questions that the sources themselves do not settle

These are facts, not automatically HITL tickets yet; later research should decide whether a safe demo assumption is enough.

- Which listed functions Siampark really uses in daily operation. [S1 pp. 15–16]
- Who owns/approves each business process. [S1 pp. 1–4, 15–16]
- Which accounting system is authoritative and which other existing systems remain. [S1 pp. 2–3, 15–16; S2 p. 1]
- Exact bank/accounting/payroll/reservation integration products and supported interfaces. [S1 pp. 2–3, 8–12; S2 p. 1]
- Real data samples and migration/source-data shape. [S1 pp. 1–4, 15–16]
- Mandatory management reports/KPIs and their exact sources. [S1 p. 2, p. 12, pp. 15–16]
- Final process acceptance scenarios and authorized approvers. [S1 pp. 1–4, 15–16]
- Whether optional signature workflow is wanted and which provider would own it. [S1 p. 12]
- Whether the later CRM pipeline extension has presentation value now. [S1 p. 13]
- Whether automatic energy/meter integrations have a confirmed source and business value. [S1 p. 6]

## Production-depth detail that should not drive the demo by default

These items remain valid production concepts but should not force architecture or implementation unless a selected presentation scenario needs them:

- statutory double-entry engine, journals/ledgers, closing operations and statutory accounting reports; [S1 pp. 8–10]
- tax correctness, FX accounting, cashbox processing and legal-interest calculation; [S1 pp. 8–10]
- full depreciation engine with multiple methods, tax/accounting variants and partial depreciation; [S1 pp. 5–7, 9]
- real bank import/payment matching and production reconciliation; [S1 p. 9]
- full material planning, stock optimization and broad batch/serial lifecycle; [S1 pp. 4–5]
- sophisticated recurring/bulk financial automation; [S1 p. 8]
- real reservation-platform synchronization; [S1 p. 11]
- real electronic-signature integration; [S1 p. 12]
- a generalized internal-chat platform; [S1 p. 12]
- complete RBAC, notification preferences and production-grade audit coverage; [S1 pp. 14–15]
- automated energy-meter collection or complex energy calculations; [S1 p. 6]
- any complete production-data migration before real source samples exist. [S1 pp. 1–4, 15–16]

## Guidance to downstream Wayfinder tickets

1. Start from the consolidated capability groups above rather than the original headings.
2. Treat property/unit/asset operations, parties, contracts/documents, tasks/planning, rentals, operational billing/finance visibility, reporting/search and minimum identity/access as the strongest source-backed demo candidates.
3. Treat inventory, purchase/sales flow and security evidence as scenario-dependent candidates rather than automatic top-level demo modules.
4. Keep statutory accounting, payroll and specialist financial processing external; downstream tickets may decide what operational facts/statuses OntOS owns and what it only displays.
5. Do not promote an unresolved vendor name into domain ownership.
6. Resolve every repeated concept through one canonical owner before designing screens or demo data.
7. Use the unresolved-source list as input to the HITL-identification ticket, but ask a human only where the answer materially changes the presentation and cannot be safely simplified.

## One-line decision

**The two Siampark documents collapse into a smaller set of cross-linked business capabilities; S1 is a candidate capability inventory rather than an implementation checklist, S2 supplies unresolved integration/discovery context, and detailed statutory-accounting/integration mechanics must not drive the demo unless a selected presentation scenario truly needs them.**
