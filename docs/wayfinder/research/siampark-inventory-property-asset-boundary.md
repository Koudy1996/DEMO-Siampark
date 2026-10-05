# Siampark Inventory vs property / asset boundary

Wayfinder research note for **Decide the Inventory vs property/asset boundary for Siampark**.

## Primary sources

- `SOUHRN_FUNKCNI_SPECIFIKACE_ERP_SIAMPARK.pdf` pp. 4–7, 11
- `docs/contexts/inventory/CONTEXT.md`
- `app/verticals/inventory/vertical.manifest.ts`
- `docs/PRODUCT.md`
- `docs/adr/0006-explicit-domain-tables-plus-resource-ref.md`

## Resolution

OntOS Inventory and Siampark property/fixed-asset management are **different domains** and must not be collapsed merely to maximize reuse.

### Existing Inventory meaning

The accepted Inventory model owns:

- Stock Item — one immutable stock meaning tied to an exact Catalog Selection;
- Stock Location — one operational stock scope;
- Stock Position — quantity of one Stock Item in one Stock Location;
- Stock Receipt / Issue / Correction;
- catalog-to-stock binding;
- external stock correlation and selected inventory backend;
- Commerce inventory reservations/commitment protection.

This is quantity/stock authority, not real-estate or fixed-asset lifecycle.

### Siampark property/asset meaning

The source requires:

- properties/buildings;
- units within properties;
- individually tracked fixed assets/equipment;
- location and technical data;
- acquisition/activation/disposal lifecycle;
- operational/current/accounting-reference values;
- maintenance and inspections;
- technical/legal documentation;
- ownership/building-permit history;
- energy/media points;
- investment planning;
- property/unit use in rental/accommodation scenarios.

These concepts need a separate minimal property/asset owner.

## Boundary decisions

### Property is not a Stock Item or Stock Location

A building/property is a durable business Resource with its own identity, technical/legal facts and lifecycle. It must not be represented as a Catalog Product, Stock Item or Stock Location.

### Unit is not an Inventory Location

A room/apartment/commercial unit is part of a property and participates in rental/occupancy/reservation logic. It is not the same thing as a stock location.

A future stock location may **reference** a property/unit through ResourceRef when stock is physically stored there, but the identities stay separate.

### Fixed Asset / Equipment is not the same as stock quantity

An installed boiler, camera, HVAC unit, vehicle or other individually managed equipment item has a lifecycle, responsible person, maintenance history, documents and potentially financial reference values. It belongs to the property/asset capability.

Consumable material, spare parts and fungible operating stock belong to Inventory.

### The same physical kind may cross the boundary over time

Example:
- three boxed replacement pumps in storage → Inventory Stock Item/Position quantity;
- one pump installed in Building A and now individually maintained → Asset/Equipment Resource.

The demo does not need to implement a sophisticated conversion workflow unless a selected scenario requires it. It only needs the domains to stay conceptually distinct.

### Asset inventory check is not stock inventory

Siampark's “inventarizace majetku” means confirming the existence/state of individually tracked assets. OntOS Inventory quantity reconciliation means stock quantity authority. They are different processes.

### Room/property reservation must not reuse Inventory Reservation

`commerce.inventory.InventoryReservation` is a provisional stock obligation for a Commerce Order commitment attempt. It must **not** represent a hotel room booking, apartment reservation or lease.

Accommodation/rental reservations need their own lightweight domain model.

## Reuse recommendation

### Reuse existing Inventory for

Only source-backed operating stock such as:

- consumables;
- maintenance material;
- spare parts;
- packaged operating supplies;
- optionally uninstalled replaceable equipment while held as stock.

Use Stock Receipt/Issue/Correction where the semantics fit.

### Do not reuse Inventory for

- real estate;
- property units;
- fixed assets already tracked individually;
- rental availability/occupancy;
- maintenance task lifecycle;
- asset depreciation/value history;
- contract/document ownership;
- room/lease reservations.

## Important implementation constraint

Current Inventory is implementation-rich but presentation-poor:
- backend Resources/Actions exist;
- no current Shell page/navigation/search contribution is published;
- Stock Item semantics are Catalog-backed.

Therefore downstream demo scope has three legitimate choices for operating stock:

1. reuse Inventory backend + a thin demo UI;
2. show only a small Inventory-backed view if a scenario genuinely needs stock movement;
3. omit/placeholder stock if it does not improve the golden path.

The choice belongs to later scenario/scope-classification tickets.

## Minimal new property/asset capability implied by this boundary

The later domain-model ticket should expect, at minimum, separate concepts for:

- Property;
- Unit;
- Asset/Equipment;
- Asset placement/reference to Property/Unit;
- operational lifecycle/status;
- maintenance/document/value references.

Exact entity count and fields remain for the domain-model ticket.

## Cross-module references

- Asset/Equipment may reference Party/Counterparty for supplier/owner/service provider.
- Asset may reference Property/Unit.
- Stock Location may reference a Property/Unit only as placement context, never as identity.
- Maintenance Task may reference Asset and/or Property/Unit.
- Contract/Invoice may reference Asset/Property/Unit when business meaning requires it.

These links should use ResourceRefs/public contracts rather than shared tables.

## One-line decision

**Use existing OntOS Inventory only for real quantity-based operating stock and materials; create a separate minimal property/unit/asset capability for Siampark real estate and individually managed equipment; never use Commerce Inventory Reservation for room/lease booking, and connect the domains only through explicit ResourceRefs where needed.**
