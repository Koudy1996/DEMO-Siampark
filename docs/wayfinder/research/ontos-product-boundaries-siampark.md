# OntOS product boundaries for the Siampark demo

Wayfinder research note for **Establish OntOS product boundaries for the Siampark demo**.

This note records product and ownership constraints from the OntOS material that already exists inside `Koudy1996/DEMO-Siampark`. It does not decide the final Siampark domain model or module list.

## Primary sources

- **B1** — `docs/PRODUCT.md`
- **B2** — `docs/contexts/ontos/CONTEXT.md`
- **B3** — `docs/adr/0006-explicit-domain-tables-plus-resource-ref.md`
- **B4** — `docs/adr/0010-separate-business-ontology-and-authz-graph.md`
- **B5** — `docs/adr/0015-party-registry-owns-shared-identity.md`
- **B6** — `docs/adr/0018-party-registry-operational-boundaries.md`
- **B7** — `docs/adr/0019-explicit-action-authorization.md`
- **B8** — `app/docs/architecture/MICROVERTICALS.md`
- **B9** — `app/docs/architecture/ACTIONS.md`
- **B10** — `docs/adr/0020-governed-application-composition.md`
- **B11** — `docs/adr/0022-optional-provider-neutral-email-delivery.md`

## Resolution

### 1. Core and Shell are business-neutral; business semantics belong to modules

OntOS Core owns trusted identity/scope, module state, governed operations, authorization/policy boundaries, audit/evidence, events/outbox, search foundations and runtime composition. Foundational modules own shared business reality such as Party identity, while Business Modules own cohesive business capabilities and their lifecycles. Application Compositions assemble compatible modules for a coherent purpose. [B1; B2]

**Siampark consequence:** property, rental, contract, invoice, task or other Siampark business semantics must not be pushed into Core merely because they are cross-cutting in the demo. They need an owning business capability, or a thin presentation layer over an already-owned capability. [B1; B2]

### 2. OntOS is not an exhaustive generic ERP module catalogue

The product explicitly says unvalidated ERP module wishlists are discovery input, not automatic scope. Customer deployments provide evidence about needs but do not become hidden product forks. [B1]

**Siampark consequence:** the source document's module headings cannot be copied 1:1 into OntOS modules. The Wayfinder must first find real capability ownership and then choose the smallest composition that demonstrates the selected scenarios. [B1]

### 3. Module ownership is strict; co-location does not permit shared business implementation

A MicroVertical owns its domain model, schema/migrations, repositories, services, BFF boundary and UI. Other modules must not import its private implementation, repositories, policies or database, and cannot share its business transaction. Synchronous cross-module calls use published contracts; asynchronous communication uses published Outbox messages. [B8]

Cross-module references use `ResourceRef` values rather than direct foreign-key coupling or a central generic entity/relation registry. Relationships with business meaning belong to the module that owns that meaning. [B3]

**Siampark consequence:** a contract may reference a Party, Property or Task by ResourceRef, but it should not copy their canonical records or establish a generic Core relationship table just to simplify the demo. [B3; B8]

### 4. Persistent business state changes go through Actions

OntOS requires business state changes to be declared Actions with typed payload/result/error contracts, trusted scope, explicit authorization and owner-local business handling. CoreSDK applies scope, authorization, policy, evidence, transaction, event and outbox semantics. [B2; B9]

**Siampark consequence:** where the demo actually persists a business transition—e.g. change reservation state, create a contract, mark an invoice operationally paid, close a maintenance task—the owning module should expose a declared Action. A visual placeholder can be non-persistent, but it must not become an undocumented write path. [B2; B9]

### 5. Business ontology and authorization are separate

Business relationships stay canonical in module-owned business data; authorization relationships belong to SpiceDB. A Party Relationship, Counterparty Role, profile membership or selected context is explicitly **not** a Permission. [B2; B4]

**Siampark consequence:** being a tenant/customer/contact/manager in the business model does not automatically grant UI or Action access. Demo authorization can be minimal, but it must remain an explicit Principal + Permission/scope concern. [B2; B4]

### 6. Legal Entity, Party, Counterparty and Principal are different concepts

- **Legal Entity** is the Core-owned trusted scope for a managed operating/accounting company inside a Tenant. [B2; B6]
- **Party** is shared identity for an external real-world person or organization. [B5; B6]
- **Counterparty** is the durable commercial/contractual context connecting one Party to one Legal Entity; CUSTOMER and SUPPLIER are independent roles. [B5; B6]
- **Principal** is the authenticated/authorized actor identity and must not be used as a synonym for Party/person/account. [B2]
- “Customer” is not a canonical identity type; the intended Party/Counterparty/profile/account meaning must be qualified. [B2]

Party Registry is the System of Record for tenant-scoped shared person/organization identity outside managed Legal Entities. Other modules reference Party/Counterparty through public contracts rather than creating their own customer/contact identity masters. [B5; B6]

**Siampark consequence:** Siampark itself, when represented as the managed company/scope, is a Legal Entity; an external tenant, supplier, guest, contact person, contractor or other external organization/person is represented through Party/Counterparty semantics as appropriate. Application users remain Principals. [B2; B5; B6]

### 7. Search is a projection, not authority

Core Search is a rebuildable projection/query capability. Party Search does not own identity uniqueness or Party Matching, and search results do not become canonical facts. [B6]

**Siampark consequence:** the demo may aggressively reuse search for presentation, but search must not become the source of truth for linking or creating domain records. [B6]

### 8. Statutory accounting stays outside OntOS

The top-level product boundary is explicit: statutory accounting remains in specialist accounting systems. OntOS may own operational evidence, billing facts, approvals and explicit integration handoffs. [B1]

**Siampark consequence:** the demo may own operational invoice records/facts, approval state, due dates, cost allocation context, imported payment/accounting statuses and management views, but must not invent a parallel statutory ledger, posting engine, closing logic, tax engine or bank-accounting authority. [B1]

### 9. Integrations preserve fact ownership

The OntOS vocabulary distinguishes:
- **External Business System** — live upstream/downstream system exchanging business facts;
- **External Evidence Provider** — external source of observations;
- **Connector Registry** — correlation between an OntOS Resource and provider-issued identifiers; the mapping does not transfer fact ownership;
- **Integration Route** — configured exchange path for one external system and fact family. [B2]

Party Registry makes the rule concrete: external evidence does not write canonical Party state directly; accepted evidence is applied through Party Registry Actions. [B6]

**Siampark consequence:** an accounting, bank, booking, payroll, signature or other external product must be modeled as an explicit boundary with declared direction and fact ownership. Simulated sync states/logs are fine for the presentation, but they must not imply that a connector owns Siampark's canonical operational entities. [B2; B6]

### 10. Application Composition, not customer-specific forks, is the assembly model

An Application Composition is a dependency-closed graph of compatible modules serving a coherent purpose. Runtime composition is governed; a customer configuration may select modules, policies, settings and integration routes but may not silently fork Core or hide customer code behind an existing implementation identity. [B2; B10]

**Siampark consequence:** the ERP demo should be specified as a small composition of reused OntOS capabilities plus clearly named Siampark/demo capabilities. Do not patch unrelated existing modules with customer-only meanings simply to avoid adding a thin demo module. [B2; B10]

### 11. Authentication is Shell/Core; do not create a Siampark “users module” for credentials

Staff authentication is a Shell/Core capability. The Shell owns credentials/sessions; Core owns Principal bindings and trusted principal/tenant resolution. Selecting a tenant or legal entity in a session does not itself grant permission. [B8; B9]

**Siampark consequence:** reuse the existing authentication/scope model and define only the minimal demo personas/permissions needed to show meaningful differences. Do not build another credential or user-identity lifecycle in a Siampark module. [B8; B9]

### 12. Shared infrastructure may be reused, but must not become a business-logic back door

Stable contracts and genuinely cross-cutting infrastructure may live in shared packages, but shared packages may not become a way to share module-specific business logic/persistence. The provider-neutral e-mail capability is an example: it only submits a server-owned message; the owning business workflow retains message meaning, authorization, template and durable intent. [B8; B11]

**Siampark consequence:** e-mail delivery can be a shared technical seam, while “send rental reminder”, “send invoice”, or “send contract notice” remains behavior owned by the relevant business capability. [B11]

## Siampark modeling guardrails produced by this decision

1. **Do not create a generic Customer entity.** Resolve customer/supplier/contact/tenant/guest meanings to Party, Counterparty, Party Relationship, contextual profile or another explicit owner. [B2; B5; B6]
2. **Do not use Principal as a business person/contact entity.** Principals are actors for authentication/authorization. [B2]
3. **Do not model Siampark's managed company as an ordinary external Party by default.** The managed operating company is a Legal Entity scope. [B6]
4. **Do not put property, contracts, invoices, tasks or rentals into Core.** They require business ownership. [B1; B8]
5. **Do not use business relationships as permissions.** Demo access rules remain explicit Principal permissions/scopes. [B2; B4]
6. **Do not create cross-module shared tables or direct private imports.** Use public contracts and ResourceRefs. [B3; B8]
7. **Do not create a parallel accounting engine.** Own operational facts only; display/import/export specialist-accounting facts through explicit integration boundaries. [B1]
8. **Do not let external connectors mutate canonical domain state directly.** External observations/handoffs pass through named routes and owner Actions. [B2; B6]
9. **Do not create a generic workflow engine for the demo.** Each retained capability owns its own minimum lifecycle; cross-capability orchestration should be explicit and thin. [B1]
10. **Do not force reuse when semantics do not match.** Reuse means reusing the correct owner/contract, not renaming unrelated Commerce concepts to look like property-management concepts. [B1; B8]

## What this ticket intentionally does not decide

- Exact Party/Counterparty mapping for each Siampark actor → dedicated Wayfinder ticket.
- Whether stock/equipment should use `commerce.inventory` → dedicated Inventory-vs-property ticket.
- Exact set of new Siampark/demo modules → domain-model/application-composition tickets.
- Exact accounting data exchanged → accounting/integration tickets.
- Exact permission matrix → personas/scope ticket.
- Exact screen set → screens/navigation ticket.

## One-line decision

**The Siampark demo must stay inside OntOS ownership rules: Core/Shell provide neutral runtime guarantees; shared identity comes from Party Registry; each new business fact has one module owner and cross-module ResourceRefs; persistent writes use Actions; permissions stay separate from business relationships; statutory accounting stays external; and integrations preserve owner authority through explicit routes rather than becoming new systems of record.**
