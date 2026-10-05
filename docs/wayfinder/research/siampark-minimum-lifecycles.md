# Minimum lifecycle states for the Siampark demo

Wayfinder research note for **Define minimum lifecycle states and transitions for retained demo entities**.

## Governing rule

The demo needs only states that are visibly useful in presentation workflows. Do not introduce a generic workflow engine. Each owner enforces a small explicit lifecycle through Actions; derived conditions remain derived instead of becoming duplicate persisted states.

## Existing reused Resources

Party, Counterparty and Inventory Resources keep their existing OntOS lifecycles. This ticket does not redefine them.

## New demo entity lifecycles

### Property

States:
- `PLANNED`
- `ACTIVE`
- `INACTIVE`
- `DISPOSED`

Transitions:
- PLANNED → ACTIVE
- ACTIVE ↔ INACTIVE
- ACTIVE/INACTIVE → DISPOSED

“Sold” vs “liquidated” is a disposition reason/type, not another state.

### Unit

States:
- `ACTIVE`
- `OUT_OF_SERVICE`
- `RETIRED`

Transitions:
- ACTIVE ↔ OUT_OF_SERVICE
- ACTIVE/OUT_OF_SERVICE → RETIRED

Do **not** persist FREE / RESERVED / OCCUPIED as the Unit lifecycle. Those are occupancy/availability projections derived from Occupancy plus out-of-service state.

### Asset

States:
- `PLANNED`
- `ACTIVE`
- `OUT_OF_SERVICE`
- `DISPOSED`

Transitions:
- PLANNED → ACTIVE
- ACTIVE ↔ OUT_OF_SERVICE
- ACTIVE/OUT_OF_SERVICE → DISPOSED

Sale, liquidation or replacement are disposition reasons. Maintenance work remains Task state, not Asset state.

### Occupancy

One lifecycle works for both SHORT_STAY and LONG_TERM_LEASE in the demo:

- `DRAFT`
- `CONFIRMED`
- `ACTIVE`
- `COMPLETED`
- `CANCELLED`

Transitions:
- DRAFT → CONFIRMED
- DRAFT → CANCELLED
- CONFIRMED → ACTIVE
- CONFIRMED → CANCELLED
- ACTIVE → COMPLETED

For a long-term lease, “ACTIVE” means the lease/occupancy is in force. For a short stay, it means checked-in/current. Kind-specific wording may differ in UI without creating two state machines.

### Contract

States:
- `DRAFT`
- `ACTIVE`
- `TERMINATED`
- `EXPIRED`

Transitions:
- DRAFT → ACTIVE
- ACTIVE → TERMINATED
- ACTIVE → EXPIRED

“Expiring soon” is derived from end/notice date.

Electronic-signature progression is a separate signature/provider state, not a Contract lifecycle:
- NOT_SENT
- SENT
- WAITING
- SIGNED
- REFUSED

For the demo, a signed contract can activate through an explicit Action, but the signature provider does not own Contract state.

### Document Record

States:
- `DRAFT`
- `FINAL`
- `ARCHIVED`

Transitions:
- DRAFT → FINAL
- FINAL → ARCHIVED

Version/revision is document metadata/history, not a lifecycle state.

### Operational Invoice

Keep three independent concerns instead of one giant state enum.

#### Business document state
- `DRAFT`
- `APPROVED`
- `CANCELLED`

Transitions:
- DRAFT → APPROVED
- DRAFT/APPROVED → CANCELLED

#### Accounting sync state
- `NOT_SENT`
- `QUEUED`
- `SYNCED`
- `FAILED`

Demo transitions:
- NOT_SENT → QUEUED → SYNCED
- QUEUED → FAILED
- FAILED → QUEUED

These can be deterministic simulation states.

#### Payment state
- `UNPAID`
- `PARTIALLY_PAID`
- `PAID`

“Overdue” is **derived** from due date + non-paid status; do not store it as a separate independent lifecycle.

### Task

Use the source-compatible minimal flow:

- `NEW`
- `IN_PROGRESS`
- `WAITING`
- `DONE`
- `CANCELLED`

Transitions:
- NEW → IN_PROGRESS
- NEW → CANCELLED
- IN_PROGRESS ↔ WAITING
- IN_PROGRESS/WAITING → DONE
- IN_PROGRESS/WAITING → CANCELLED

No configurable workflow designer is needed.

### Financial Plan Entry

States:
- `PLANNED`
- `CONFIRMED`
- `CANCELLED`

Transitions:
- PLANNED → CONFIRMED
- PLANNED/CONFIRMED → CANCELLED

Actual/imported amount is a value/evidence field, not another lifecycle.

### Relationship Activity

No lifecycle state is required. A recorded NOTE/CALL/EMAIL/MEETING is an immutable historical activity; correction can be handled as edit/audit behavior if needed, not a workflow.

## Optional entity lifecycles

Only activate these if downstream scenario selection retains the entity.

### Opportunity
- NEW
- IN_PROGRESS
- CONFIRMED
- CLOSED
- CANCELLED

### Commercial Order
- DRAFT
- APPROVED
- ORDERED
- PARTIALLY_DELIVERED
- COMPLETED
- CANCELLED

### Project
- PLANNED
- ACTIVE
- PAUSED
- COMPLETED
- CANCELLED

### Integration run/log
No business lifecycle needed beyond a projection status such as QUEUED / SUCCESS / FAILED.

## Derived presentation states — never duplicate as independent truth

- Unit FREE / RESERVED / OCCUPIED
- Contract EXPIRING_SOON
- Invoice OVERDUE
- Asset INSPECTION_DUE
- Task DUE_SOON / OVERDUE
- Stock LOW
- Connector HEALTHY / DEGRADED based on last result

These can be computed from canonical facts and seeded data.

## Demo implementation rule

Only transitions used by the final presentation scenarios need working buttons/Actions. Other states may exist only as pre-seeded records so the UI can demonstrate filtering, exceptions and history.

## One-line decision

**Use small owner-specific lifecycles—Property/Unit/Asset, Occupancy, Contract, Document, Invoice, Task and Financial Plan Entry—with payment/sync/signature concerns separated from business state and all “overdue/occupied/expiring/low stock” conditions derived rather than persisted; no generic workflow engine is needed.**
