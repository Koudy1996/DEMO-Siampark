# Siampark external integration seams and demo simulations

Wayfinder research note for **Define external integration seams and demo simulations**.

## Primary sources

- `SOUHRN_FUNKCNI_SPECIFIKACE_ERP_SIAMPARK.pdf` pp. 2–3, 6–12, 15–16
- `Zápis z úvodních jednání.pdf` pp. 1–2
- `docs/contexts/ontos/CONTEXT.md`
- `docs/adr/0018-party-registry-operational-boundaries.md`
- `docs/adr/0022-optional-provider-neutral-email-delivery.md`
- `app/packages/email-delivery/`
- `app/verticals/party-registry/vertical.manifest.ts`
- current `app/verticals/` inventory

## Governing integration rule

An external system never becomes the implicit owner of unrelated OntOS facts. Each integration is a named route at the boundary of the module that owns the exchanged fact family. Provider identifiers/correlations do not transfer business ownership.

The current repository does not contain a ready-made generic Connector Registry vertical. Therefore the demo should not invent a large central integration platform. Use thin owner-local connector seams plus, optionally, one aggregated **Integrations** status screen.

## Integration matrix

### 1. Accounting system — provider-neutral until explicitly selected

**Source status:** Evala is mentioned as a candidate to evaluate; other accounting systems are also mentioned in later discovery. No final authoritative product is fixed.

**Owner boundary:** Operational Invoice / Finance / Asset capabilities ↔ External Accounting System.

**Outbound from OntOS**
- approved operational invoice/billing facts;
- Counterparty identification/snapshot required by the accounting export;
- amount, currency, dates;
- cost/property/project dimension references where supported;
- asset/accounting handoff facts when relevant.

**Inbound to OntOS**
- external accounting document/reference ID;
- accepted/rejected/sync state;
- posting/accounting processing status;
- confirmed payment status/amount/date where available;
- imported management actuals or accounting summaries;
- accounting/tax book value/depreciation result where useful to asset display.

**Demo simulation**
- seeded provider-neutral connector card;
- “Send to accounting” Action;
- fake transition `queued → synced` or `failed`;
- generated external ID;
- pre-seeded returned payment/accounting status;
- small fake sync log.

**Do not implement**
- ledger/posting engine;
- accounting credentials/API;
- statutory accounting reconciliation.

### 2. Bank — normally behind accounting for this demo

The Siampark source places bank operations/payment matching in the accounting process.

**Preferred boundary:** Bank ↔ External Accounting System ↔ OntOS operational payment visibility.

**Inbound to OntOS**
- only confirmed/imported payment observations or payment status needed by Invoice/reporting.

**Outbound from OntOS**
- none required for the presentation.

**Demo simulation**
- “Last bank/accounting sync” timestamp;
- seeded incoming payment rows;
- invoice payment status updated from simulated external evidence.

**Do not implement**
- bank OAuth/API;
- statement import;
- authoritative matching;
- payment initiation.

### 3. Payroll system — placeholder seam only

Payroll is explicitly external and the source does not define the concrete system or data contract.

**Boundary:** HR/work context ↔ External Payroll System.

**Demo data contract**
- no production payload is required;
- if shown, only a generic export batch reference and returned processing state/summary.

**Demo simulation**
- connector card “Payroll — synced”;
- optional fake last export run and record count.

**Do not implement**
- payroll calculation;
- payslips;
- attendance;
- statutory payroll logic.

### 4. Reservation / booking platform

**Owner boundary:** Siampark Occupancy/Rental capability ↔ External Booking Platform.

**Inbound to OntOS**
- external booking ID;
- selected unit/listing correlation;
- dates;
- booking customer/booker reference or bounded identity evidence;
- party size;
- booking/cancellation/change state;
- external price summary where needed.

**Outbound from OntOS**
- unit availability/block periods;
- confirmed/cancelled state where the provider contract supports it;
- optional acknowledgement/reference.

**Demo simulation**
- pre-seeded bookings with external IDs;
- fake “Sync booking channel” Action;
- visible sync status/log;
- one conflict/error example;
- no network call.

### 5. E-mail delivery

A provider-neutral email package with a Resend adapter already exists.

**Owner boundary:** owning business workflow → `@app/email-delivery` → provider.

**Outbound**
- recipient;
- subject;
- text/HTML body;
- optional idempotency key.

**Inbound**
- provider submission acceptance ID or typed failure/indeterminate outcome.

**Important semantic boundary**
Provider acceptance is not proof of inbox delivery.

**Demo options**
- easiest: simulate “sent” and store timestamp;
- stronger: actually reuse `EmailDeliveryService` if a selected scenario benefits from a real submission.

No generic notification platform is required.

### 6. Electronic-signature provider

**Owner boundary:** Contract/Document capability ↔ Signature Provider.

**Outbound**
- document reference/content;
- signer identity/contact;
- signing request correlation;
- callback/reference metadata.

**Inbound**
- request ID;
- state such as sent / waiting / signed / refused;
- signed-document reference.

**Demo simulation**
- button “Send for signature”;
- immediate fake provider request ID;
- seeded state progression;
- pre-seeded signed PDF/reference.

**Do not implement**
- cryptographic signature;
- provider authentication/webhooks.

### 7. ARES

Party Registry already exposes ARES lookup behavior and accepted OntOS semantics define ARES as external evidence, not identity authority.

**Owner boundary:** Party Registry ↔ ARES External Evidence Provider.

**Outbound**
- ICO lookup.

**Inbound**
- bounded normalized organization evidence / candidate prefill.

**Application**
- no direct external mutation of Party state;
- accepted evidence is applied through Party Registry Actions.

**Demo recommendation**
This is the one integration that can be shown using an existing real OntOS seam if desired; otherwise seeded lookup results are still acceptable.

### 8. SMS / messaging

The accommodation source mentions e-mail or SMS communication, but no SMS implementation/provider is established.

**Boundary:** owning workflow ↔ optional external messaging provider.

**Demo decision**
Placeholder only unless a later scenario explicitly values SMS. A message template + “SMS connector not configured” state is enough.

### 9. Physical security systems

The source explicitly interprets security as evidence/oversight of existing devices, not building or integrating a physical security platform.

**Demo decision**
No physical security connector is required. Security devices can exist as Asset/Equipment records with service state and linked Tasks.

## Optional integrations status page

A single presentation screen may aggregate:
- connector name/type;
- owner capability;
- mode (simulated / configured);
- last sync;
- direction;
- state;
- last result/error;
- “sync now” demo Action where useful.

This screen is a **projection/status composition**. It is not the owner of invoice, booking, party or asset facts.

## Standard demo simulation pattern

For every simulated integration:

1. keep the domain record canonical in its owning module;
2. store/display an external correlation ID;
3. expose a small sync state;
4. allow one deliberate demo Action such as “Send” or “Sync”;
5. write a fake but deterministic log/receipt;
6. optionally apply one seeded inbound result;
7. include one pre-seeded failure state for realism;
8. never require credentials, OAuth, webhooks or real external availability.

## One-line decision

**Use owner-local, provider-neutral integration seams rather than a new central integration platform: accounting/bank/payroll/booking/signature are simulated with explicit correlations and sync states, e-mail may reuse the existing delivery package, ARES may reuse Party Registry's existing evidence seam, and no real external connector is required to make the demo credible.**
