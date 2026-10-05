# Reusable OntOS capabilities already implemented in DEMO-Siampark

Wayfinder research note for **Inventory reusable OntOS capabilities already implemented in DEMO-Siampark**.

This note distinguishes accepted product concepts from code that is actually present in the target repository. It is an implementation inventory for later demo-scope decisions, not a proposal to reuse every available Commerce capability.

## Primary implementation sources

- repository tree under `app/verticals/`, `app/packages/`, `app/apps/shell-super-app/`
- `app/verticals/*/vertical.manifest.ts`
- `app/packages/core-runtime/`
- `app/apps/shell-super-app/api/modules/shell-resources.ts`
- `app/apps/shell-super-app/src/routes/[lang]/search/page.tsx`
- `app/apps/shell-super-app/src/routes/[lang]/resources/[moduleId]/[resourceType]/[resourceId]/page.tsx`
- `app/packages/email-delivery/src/server.ts`
- `app/packages/email-delivery/src/resend.ts`
- accepted product context in `docs/PRODUCT.md` and `docs/contexts/*` only where needed to interpret the implementation correctly

## Observed deployable verticals

The current `app/verticals/` tree contains these ten verticals:

1. `assortment` → `commerce.assortment`
2. `catalog` → `commerce.catalog`
3. `commerce-customer-context` → `commerce.customer-context`
4. `commerce-market-catalog` → `commerce.market-catalog`
5. `inventory` → `commerce.inventory`
6. `party-registry` → `party.registry`
7. `payment-term-catalog` → `payment.term-catalog`
8. `price-group-catalog` → `pricing.price-group-catalog`
9. `pricing` → `commerce.pricing`
10. `storefront-registry` → `commerce.storefront-registry`

There is **no implemented vertical** named Projects, Property/Assets, Contracts/Documents, Billing/Invoicing, Finance, Rentals/Accommodation or Security in the current `app/verticals/` inventory.

The repository does contain a Projects product context at `docs/contexts/projects/CONTEXT.md`, but there is no matching implemented Projects vertical in the current tree. Therefore Projects semantics are reusable design guidance, not reusable runtime code at this point.

## Capability inventory and demo reuse assessment

### A. Core runtime + Shell — directly reusable foundation

The repository already implements the shared platform mechanisms that a Siampark demo should not recreate:

- authenticated staff/Shell flow and trusted Principal/Tenant/Legal Entity context;
- module catalog/state/composition mechanics;
- declared Actions and Action authorization;
- permission/authorization infrastructure;
- governed reads;
- audit/data-access/event/outbox foundations;
- Core search projection/query runtime;
- generic Shell module routing;
- generic Shell search page;
- generic Shell resource-detail route.

Implementation evidence includes `app/packages/core-runtime/src/actions/`, `auth/`, `modules/`, `permissions/`, `reads/`, `search/` and the Shell routes/API under `app/apps/shell-super-app/`.

**Reuse conclusion:** the Siampark demo should be an Application Composition on top of this foundation, not a separate mini-app with a second auth, permission, search, routing or Action framework.

### B. Party Registry — strongest direct business reuse

`app/verticals/party-registry/vertical.manifest.ts` exposes real implemented Party/Counterparty capabilities.

#### Resources currently published

- Party
- Counterparty
- Counterparty Role Period
- Party Contact Point
- Party Official Identifier
- Party Relationship
- Party correction/match/merge-related resources
- Person and Organization Engagement Profiles
- Duplicate Candidate / Party Match Decision resources

#### State-changing Actions currently published

Examples include:

- create/update/archive/unarchive Party;
- add/update/end Contact Point;
- add/update/end Official Identifier;
- create/update/end Party Relationship;
- create Counterparty;
- add/end Counterparty Role;
- Party matching/correction/duplicate-resolution actions.

#### APIs currently published

Examples include:

- Party detail/match/contact points/identifier history;
- Counterparty read and role history;
- Party relationship detail;
- ARES lookup;
- person/organization engagement profile reads.

#### Existing presentation surface

Party Registry is the most presentation-ready vertical:
- it contributes a Shell navigation item;
- it contributes a real `/contacts` page;
- it contributes Party and Counterparty search providers.

**Reuse conclusion:** external people/organizations, customer/supplier commercial context, contacts and related search should reuse Party Registry rather than introducing Siampark-specific identity masters.

### C. Inventory — real backend capability, but not a ready-made Siampark screen

`app/verticals/inventory/vertical.manifest.ts` publishes substantial implemented stock behavior.

#### Resources include

- Stock Item
- Stock Location
- Stock Position
- Catalog-to-Stock Binding
- Inventory Reservation
- Reservation Confirmation
- Stock Sharing Eligibility
- Inventory Backend Configuration
- External Stock Correlation
- Inventory Source Conflict
- Commitment Protection

#### Actions include

- stock receipt;
- stock issue;
- stock position correction;
- inventory backend selection;
- catalog-to-stock binding management;
- external-stock correlation management;
- reservation/protection/recovery actions.

#### Important limitation

The current Inventory manifest contributes **no Shell page/navigation/search/resource-detail presentation surface**. Its semantics are also deliberately Commerce-oriented: Stock Items bind to exact Catalog selections and reservations serve Commerce commitment semantics.

**Reuse conclusion:** Inventory is a strong backend candidate for Siampark **operating materials/stock** only where those semantics genuinely fit. It is not a property/fixed-asset model and cannot be treated as a ready-made ERP inventory UI. The dedicated Wayfinder Inventory-vs-property decision must decide whether the demo should reuse this backend, build only a thin visual layer, or use a simpler demo-owned stock representation.

### D. Payment Term Catalog — small reusable backend capability

`app/verticals/payment-term-catalog/vertical.manifest.ts` implements:

- Payment Term and catalog-root Resources;
- create/correct/reconcile/retire payment-term Actions;
- current payment-terms and history APIs.

It contributes no current Shell UI.

**Reuse conclusion:** if the demo needs believable invoice/payment-term selection, this can provide canonical payment-term semantics, but it requires a thin presentation layer and should not be confused with payment settlement or accounting.

### E. Provider-neutral e-mail delivery — actually implemented shared package

`app/packages/email-delivery` is present in code, with:
- a provider-neutral `EmailDeliveryService` contract in `src/server.ts`;
- a concrete Resend adapter in `src/resend.ts`;
- typed invalid/rejected/unavailable/indeterminate outcomes;
- optional idempotency key support.

The adapter deliberately treats provider acceptance as submission acceptance, not inbox-delivery proof.

**Reuse conclusion:** if a selected demo workflow really sends an e-mail, the repository already has a technical sending seam. The owning Siampark business module must still own message meaning/template/authorization/workflow. If presentation value is satisfied by a fake “sent” state, later scope classification may still choose simulation instead of real delivery.

### F. Shell search — directly reusable presentation capability, but only from contributing modules

The Shell already implements a generic search page that aggregates module-provided search contributions and routes results through ResourceRefs to generic resource pages.

Currently Party Registry contributes Party/Counterparty search. Other Siampark demo modules would need to publish their own search descriptors/contributions before they appear in global search.

**Reuse conclusion:** do not build a second global-search shell. Reuse Shell search and add only the minimum module-owned search providers required by selected scenarios.

### G. Shell generic resource detail — reusable framework with an important media limitation

The Shell has a generic resource-detail route and server resolution logic. It can resolve a module-provided detail API and optionally timeline contributions when a module declares the relevant Shell contribution.

However, current generic media attachment is **not implemented**: `attachShellMedia` in `app/apps/shell-super-app/api/modules/shell-resources.ts` returns `outcome: 'unavailable'`.

**Reuse conclusion:** generic detail framing/timeline plumbing is reusable, but a Siampark “documents attached everywhere” experience is not already solved by the Shell. The demo will need either:
- a very thin Siampark/document capability,
- a module-owned simple attachment implementation,
- or a convincing placeholder/simulation depending on selected scenarios.

### H. Catalog — implemented and rich, but primarily Commerce semantics

`commerce.catalog` has extensive Product/Variant/Brand/Category/Attribute/Package/Media Actions, Resources and APIs. Its current Shell contribution is a catalog widget, not a general ERP page.

**Reuse conclusion:** Catalog can be reused for genuine products/services or for Inventory's required catalog semantics where that meaning fits. It must **not** be repurposed to represent real estate, fixed assets, contracts or arbitrary Siampark records merely because it is already implemented.

### I. Pricing — implemented, but Commerce-specific

`commerce.pricing` implements Price and Commercial Fee Resources plus price, fee, quotation, quantity-tier, discount and currency-support behavior. It has no current Shell page contribution.

**Reuse conclusion:** use only if a retained presentation scenario needs real Commerce pricing semantics. For a simple rent amount, invoice amount or manually entered service price, importing the full Commerce pricing model may add more complexity than value.

### J. Commerce Customer Context — implemented, but not a general CRM replacement

`commerce.customer-context` includes Retail Customer Profiles, Counterparty Purchasing Profiles, customer groups, saved addresses, payment-term/price-group assignments, purchase limits, approvals and order-history APIs.

It has no current Shell page contribution.

**Reuse conclusion:** this is useful for B2B/B2C purchasing semantics, not as a substitute for Siampark's general contacts/CRM, tenancy, property or contract model. Reuse only if a chosen scenario genuinely needs Commerce purchasing behavior.

### K. Assortment / Market Catalog / Price Group Catalog / Storefront Registry — implemented but low direct Siampark relevance

These verticals are real and reusable inside a Commerce application composition, but their ownership semantics are channel/catalog/storefront/market/price-selection concerns.

**Reuse conclusion:** do not force them into the Siampark ERP demo merely to maximize code reuse. “Maximum reuse” means reusing semantically correct capabilities, not increasing the number of installed modules.

## Important capability gaps for the Siampark demo

The current repository does **not** provide ready-to-use implemented owners for these source-backed Siampark areas:

### Property / units / fixed assets

No property/fixed-asset vertical exists. This requires a new thin demo capability or another explicit owner decision.

### Accommodation / rentals / reservations

No accommodation/rental vertical exists. Commerce Inventory Reservation is a stock-obligation concept and is not a room/lease reservation model.

### Contracts

No contract-management vertical exists.

### General document management

Catalog has catalog-media behavior, and Shell has generic resource-detail media affordance plumbing, but generic Shell media attachment is currently unavailable. There is no general document-management vertical.

### Tasks / ticketing / projects / calendar

Projects semantics exist in documentation only; there is no implemented Projects vertical in the current `app/verticals/` tree.

### Invoicing / billing / receivables / operational payments

No implemented billing/invoice vertical exists. Commerce Customer Context contains an `InvoiceRecipientResolutionApi`, but that is only recipient-resolution support and does not constitute an invoice system.

### Finance / budgets / management reporting

No dedicated finance/controlling vertical exists.

### Notification center / generic internal chat

E-mail delivery exists as infrastructure, but there is no general notification-center or internal-chat business capability visible in the current vertical inventory.

### Generic Connector Registry / integration hub

The product language defines Connector Registry and Integration Route concepts, and Inventory implements a stock-specific External Stock Correlation. The current `app/verticals/` inventory does not contain a generic connector-registry vertical.

**Implication:** external accounting/bank/booking/payroll/signature integrations should be represented through explicit demo seams/states rather than assuming there is already a generic integration application to configure.

## Reuse matrix for later Wayfinder decisions

| Siampark need | Current reusable OntOS capability | Reuse level |
|---|---|---|
| External persons/organizations | Party Registry | **Direct** |
| Customer/supplier context | Counterparty + roles | **Direct** |
| Contact details / ARES lookup | Party Contact Points / ARES API | **Direct** |
| User login, tenant/legal-entity context | Shell/Core auth + Principal bindings | **Direct** |
| Authorization and state-change mechanics | Core permissions + Actions | **Direct** |
| Global search framework | Shell search + module search contributions | **Direct framework** |
| Generic resource detail framing | Shell resource-detail route | **Direct framework** |
| Operating-material stock | `commerce.inventory` | **Conditional backend reuse** |
| Payment terms | Payment Term Catalog | **Conditional backend reuse** |
| E-mail submission | `@app/email-delivery` | **Direct infrastructure** |
| Product/service catalogue | `commerce.catalog` | **Conditional semantic reuse** |
| Commerce prices/quotations | `commerce.pricing` | **Conditional semantic reuse** |
| B2B/B2C purchasing profile/approval | `commerce.customer-context` | **Conditional semantic reuse** |
| Property/unit/fixed asset | none | **New thin demo capability needed** |
| Rental/accommodation | none | **New thin demo capability needed** |
| Contract management | none | **New thin demo capability needed** |
| General documents/attachments | no complete generic implementation | **Thin implementation or simulation** |
| Tasks/projects/calendar | docs only, no runtime vertical | **New thin demo capability or implementation from Projects semantics** |
| Invoicing/billing | none | **New thin demo capability / external handoff** |
| Finance/controlling | none | **Thin presentation/reporting layer** |
| Accounting engine | intentionally external | **Do not implement** |
| Bank/payroll/booking/signature connectors | no complete ready-made generic connector app | **Simulation/explicit seam** |

## Presentation-readiness findings

1. **Party Registry is the only clearly presentation-ready business vertical for Siampark** because it already contributes navigation, a Contacts page and search.
2. **Inventory is implementation-rich but presentation-poor** for this use case: useful backend behavior exists, but there is no existing Shell page contribution.
3. **Most Commerce verticals expose contracts and Actions but no ready-made staff page**, so “reuse” often means keeping the backend owner while adding a thin presentation surface.
4. **The Shell is highly reusable** for authentication, composition, routing, search and resource-detail framing.
5. **Documents are a real gap** for the requested ERP story because the generic Shell attachment operation is currently unavailable.
6. **Projects is a semantic target, not an implemented reusable module** in this repository.
7. **No existing vertical should be bent into a different domain simply to avoid a small Siampark/demo module.**

## Guidance to downstream Wayfinder tickets

- Start every domain decision with Party Registry/Core/Shell reuse, because those are clear wins.
- For Inventory, Payment Terms, Catalog and Pricing, compare semantic fit and demo complexity before selecting reuse.
- Treat property, rentals, contracts, documents, tasks/projects, invoicing and finance as candidate **thin Siampark/demo modules or views**, not missing production systems to rebuild.
- Prefer Shell-native navigation/search/resource detail contributions for new demo capabilities instead of inventing a separate app shell.
- Keep external accounting as the authority; any billing/finance capability created for the demo must stop at operational facts and handoff/status visibility.
- Treat media/document attachment as an explicit scope decision because the Shell's current generic attachment action is a stub.
- Do not assume “documented OntOS concept” equals “implemented capability”.

## One-line decision

**DEMO-Siampark already contains a strong reusable platform foundation plus a presentation-ready Party Registry and several real Commerce backends, but most Siampark-specific ERP capabilities—property, rentals, contracts, documents, tasks/projects, invoicing and finance—are not implemented verticals today; they should therefore be specified as the thinnest demo-owned capabilities/views necessary, while semantically correct existing owners are reused rather than renamed or duplicated.**
