# Siampark accounting and finance boundary

Wayfinder research note for **Define the accounting and finance boundary between OntOS and specialist systems**.

## Primary sources

- `SOUHRN_FUNKCNI_SPECIFIKACE_ERP_SIAMPARK.pdf` pp. 5–10, 12, 15–16
- `Zápis z úvodních jednání.pdf` pp. 1–2
- `docs/PRODUCT.md`
- `docs/contexts/ontos/CONTEXT.md`

## Resolution

The source documents and OntOS product boundary agree on the governing rule:

> **OntOS may own operational commercial/financial facts and management views, but statutory accounting authority remains in a specialist accounting system.**

The Siampark demo therefore needs a credible operational finance surface and connector handoff, not an accounting engine.

## OntOS-owned / demo-owned operational facts

The demo may legitimately own and persist:

### Invoice / billing facts

- issued vs received document direction;
- document number/label;
- Counterparty;
- issue date / due date;
- amount/currency;
- contract/order/property/unit/project references;
- operational document status;
- attachment/reference metadata;
- approval state;
- reminder state;
- external accounting correlation/reference;
- sync/handoff state.

These are operational billing/document facts, not journal postings.

### Payment visibility

The demo may show:

- unpaid / partially paid / paid;
- overdue state;
- last confirmed payment/accounting update;
- imported/confirmed payment amount/date;
- source of the status (accounting system / bank / manual demo fixture).

For production, the authoritative settlement/payment-matching logic belongs to the responsible external accounting/bank process unless separately proven otherwise.

### Budgets and management planning

OntOS may own:

- budget/plan by property, project, activity or period;
- planned income/expense;
- expected cash movement;
- simple probability or scenario field;
- planned vs actual comparison;
- management variance/comment;
- operational cost allocation dimension/reference.

These are management facts, not statutory books.

### Property/asset financial reference values

The property/asset capability may retain:

- acquisition value;
- current/market/reference value;
- date of valuation;
- expected/residual value where useful for operations;
- externally sourced accounting/tax book value as read-only/reference data.

The external accounting system remains authoritative for accounting/tax depreciation and postings.

### Approval / handoff evidence

OntOS may own approval status and the fact that an operational document was handed to the external accounting process, including a simulated connector state in the demo.

## Specialist accounting-system responsibilities

The demo must **not** plan its own authoritative implementation for:

- double-entry ledger;
- journal / general ledger;
- chart of accounts;
- posting rules;
- statutory receivable/payable books;
- authoritative bank statement processing;
- authoritative payment matching;
- cashbox accounting;
- FX gains/losses and currency accounting;
- VAT/tax determination and statutory tax processing;
- accounting depreciation and tax depreciation engine;
- accounting treatment of asset capitalization/disposal;
- period closing / year-end closing;
- balance sheet / P&L / trial balance generation from a local ledger;
- payroll accounting;
- statutory accounting evidence and compliance logic.

Those capabilities may be **displayed as imported/simulated results** if presentation value warrants it.

## Important source tension resolved

S1 contains a detailed “Accounting system” section listing the capabilities above, but it explicitly says:

- the accounting module is a specialist agenda;
- the preferred solution is an external verified accounting product connected to OntOS;
- OntOS should not create parallel accounting;
- accounting, tax and banking details depend on the selected system.

Therefore the detailed accounting list is an **external-system capability requirement / integration context**, not a mandate to implement it inside Siampark's OntOS demo.

## Accounting-product choice

The sources do not establish one final authoritative product:

- S2 says Evala should be evaluated and its role confirmed;
- S1's discovery history mentions i6 and another foreign system;
- S1's functional section deliberately uses “selected accounting system”.

**Demo decision:** use a provider-neutral “Accounting System” connector/handoff concept until a separate HITL decision explicitly requires naming one product. The UI may show a demo provider label if useful, but domain ownership must not depend on it.

## Bank boundary

The source asks for bank integration and payment matching, but places bank operations in the accounting system.

For the demo:
- show a fake/imported bank/accounting synchronization state;
- optionally show a small list of imported payment observations;
- derive visible invoice payment status from seeded connector data;
- do not implement real bank API/OAuth/import/reconciliation.

## Payroll boundary

Payroll is explicitly external in S2 and HR/payroll is excluded from the source's simple HR planning section.

For the demo:
- at most show “Payroll system — connected/sync OK” as an integration placeholder if presentation value exists;
- no payroll calculation, payslip, attendance or statutory payroll logic.

## Management reporting boundary

Management dashboards may combine:

- OntOS-owned operational facts;
- planned budgets;
- imported/simulated accounting actuals;
- payment statuses;
- property/contract/task context.

Every financial metric should have an understandable source. The demo can use pre-seeded accounting snapshots rather than implementing accounting calculations.

## Minimal credible demo finance model

Downstream domain modeling can remain small:

### Operational Invoice

Likely fields:
- direction;
- counterpartyRef;
- contract/property/project refs;
- issue/due dates;
- amount/currency;
- operational status;
- payment status;
- external accounting ref;
- accounting sync status.

### Financial Plan / Budget item

Likely fields:
- scope/resourceRef;
- period/date;
- type (income/expense);
- planned amount;
- actual/imported amount where appropriate;
- short note.

### Integration status

Provider-neutral state such as:
- not_sent;
- queued;
- synced;
- sync_failed;
- requires_attention.

Exact names remain for the domain/state tickets.

## What the demo may simulate convincingly

- “Send invoice to accounting” Action → instant/scheduled fake sync status;
- accounting reference ID;
- imported payment matched to invoice;
- imported P&L/expense summary by property;
- bank sync log;
- depreciation value returned from accounting;
- payroll connector health;
- accounting export/import history.

These are presentation simulations, not hidden accounting implementations.

## One-line decision

**Siampark OntOS owns operational invoices, approvals, payment-status visibility, budgets/plans and management reporting context; the specialist accounting system owns ledgers, postings, tax/FX/depreciation, authoritative bank/payment matching, closing and payroll, with the demo showing only explicit handoffs and seeded/simulated returned statuses or summaries.**
