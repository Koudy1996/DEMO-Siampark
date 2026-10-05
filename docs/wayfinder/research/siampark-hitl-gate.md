# Siampark HITL gate — unresolved business decisions

Wayfinder research note for **Identify unresolved business decisions that truly require HITL**.

## Decision standard

A HITL question exists only when:
1. the documents and repository cannot answer it;
2. the answer materially changes the presentation demo;
3. choosing the simplest safe demo assumption would be materially misleading.

The Destination explicitly authorizes a fast presentation demo, synthetic data, simulations, placeholders and omission of production depth.

## Result

**No currently known unresolved question requires blocking HITL to reach the Wayfinder Destination.**

The remaining source ambiguities can all be resolved safely through explicit demo assumptions and later agent decisions without pretending they are production truth.

## Previously unresolved source questions and disposition

### Which source functions Siampark really uses

**Disposition:** no HITL required for the demo.

Later workflow/scenario/scope tickets choose only capabilities that strengthen the presentation. Unselected source functions become PLACEHOLDER or OUT OF SCOPE.

Production adoption would require client confirmation, but production adoption is outside this Destination.

### Who owns each real business process

**Disposition:** no HITL required for the demo.

The personas ticket can define a minimal fictional-but-credible responsibility set such as management, operations and accounting/external-accounting roles. The demo does not claim this is Siampark's final organization model.

### Which accounting system is authoritative

**Disposition:** no HITL required.

Use a provider-neutral “Accounting System” integration seam. Do not hard-code Evala/i6/another product as authoritative.

### Which booking/payroll/signature/bank providers are used

**Disposition:** no HITL required.

Use provider-neutral connector seams and deterministic simulations. Name a provider only if later presentation requirements explicitly demand branding.

### Missing real data samples

**Disposition:** no HITL required.

Use a coherent synthetic demo dataset. The Destination explicitly allows prepared data and does not require production migration.

### Exact management KPIs/reports

**Disposition:** no HITL required.

The scenario/screens tickets should choose a small set of KPIs that expose the selected demo story: occupancy, open tasks, upcoming deadlines, invoice/payment status, property/asset values and plan-vs-actual as appropriate.

Do not claim these are the final production reporting requirements.

### Exact acceptance scenarios / authorized approver

**Disposition:** no HITL required.

Wayfinder itself will define presentation scenarios and golden path. Formal client acceptance is outside this presentation-demo Destination.

### Electronic signature provider

**Disposition:** no HITL required.

Simulate a generic provider with SENT / WAITING / SIGNED / REFUSED states.

### CRM pipeline

**Disposition:** no HITL required.

It is explicitly later/optional in the source. Keep Opportunity scenario-conditional; if not selected, omit it.

### Energy/meter automation

**Disposition:** no HITL required.

Use seeded current readings/costs or omit the capability. Real meter integration requires production discovery and is outside the demo.

### Inventory depth

**Disposition:** no HITL required.

The later scenario/scope ticket can decide whether stock movements add presentation value. If not, Inventory remains omitted or placeholder.

## Conditional questions that would become HITL only if the Destination changes

These are **not current tickets** and should not block Wayfinder:

1. “Must the demo be accepted as a formal contractual/dotation deliverable rather than a presentation prototype?”
2. “Must a specific named accounting/booking/payroll/signature product be shown as the authoritative production integration?”
3. “Must the demo reproduce Siampark's real production workflows/data rather than a coherent synthetic story?”
4. “Is any source module contractually mandatory to demonstrate regardless of presentation value?”

If the user changes the Destination in one of these directions, open fresh HITL/grilling tickets.

## Fog-of-war impact

The map can clear the generic fog item “precise HITL business questions after research”. No blocking human decision is currently known.

Other fog areas such as exact report selection or external payload detail are now ordinary downstream demo-design decisions, not human gates.

## One-line decision

**Under the explicitly presentation-only Potemkin-village Destination, no unresolved source ambiguity currently requires HITL: provider choices stay neutral, data is synthetic, KPI/scenario selection is agent-decided, and production-process confirmation remains outside scope unless the Destination is later changed.**
