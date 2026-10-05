# Siampark Party / Counterparty mapping

Wayfinder research note for **Map Siampark people and organizations to Party / Counterparty without duplicate identity models**.

## Primary sources

- `SOUHRN_FUNKCNI_SPECIFIKACE_ERP_SIAMPARK.pdf` (especially pp. 5–15)
- `docs/contexts/ontos/CONTEXT.md`
- `docs/adr/0015-party-registry-owns-shared-identity.md`
- `docs/adr/0018-party-registry-operational-boundaries.md`
- `app/verticals/party-registry/vertical.manifest.ts`

## Resolution

### Identity rules

1. **The managed Siampark company is a Core Legal Entity, not an ordinary Party.**
   A Legal Entity is the trusted operating/accounting-company scope inside the OntOS Tenant. Party Registry must not automatically mirror it as an ORGANIZATION Party.

2. **External real-world people and organizations are Parties.**
   This includes renters/guests where individual identity matters, suppliers, contractors, external owners, accounting firms and contact persons.

3. **Commercial/contractual relationship to Siampark is a Counterparty context.**
   Counterparty is `Party × Legal Entity`. The existing role types CUSTOMER and SUPPLIER are sufficient for the demo's ordinary customer/renter and supplier/contractor relationships.

4. **Application users are Principals, not Party substitutes.**
   Internal responsible persons, task assignees and authenticated staff are referenced as Principals for action/audit/assignment purposes. A Principal may also correspond to a real-world person, but the business person/contact identity and authenticated actor identity are separate concepts.

5. **Party Relationships represent real-world relationships, not authorization.**
   The existing `CONTACT_PERSON_OF` relationship is the correct model for a person who is the contact person of an external organization. It must not grant system permissions.

6. **The word “tenant” must be disambiguated.**
   - OntOS **Tenant** = platform/customer isolation boundary.
   - Siampark **nájemce / renter / tenant of a property** = external Party and normally Counterparty CUSTOMER in the rental context.
   These must never share one identity type.

## Source concept mapping

| Siampark source term / role | Canonical mapping for demo | Notes |
|---|---|---|
| Siampark s.r.o. as operating company | Core `Legal Entity` | Managed company/scope, not Party |
| Customer / client | `Party` + `Counterparty` with CUSTOMER role when commercial relationship exists | Avoid generic Customer entity |
| Long-term renter / nájemce | `Party` + CUSTOMER Counterparty | Lease itself belongs to rental/contract capability |
| Short-stay booking customer / booker | `Party` + CUSTOMER Counterparty | Other occupants need not all become Parties unless a scenario requires identity |
| Additional guest/occupant | Party only if individually relevant; otherwise reservation occupant data | Simplest credible demo path |
| Supplier | `Party` + SUPPLIER Counterparty | Organization or person |
| Service contractor / maintenance vendor | `Party` + SUPPLIER Counterparty | Service contract/work order belongs elsewhere |
| External accounting company | `Party` + SUPPLIER Counterparty if contractual relationship is shown | Individual accountant user remains Principal if they log in |
| Contact person at supplier/customer organization | PERSON Party + `CONTACT_PERSON_OF` Party Relationship | Organization itself is ORGANIZATION Party |
| External property owner | Party; Counterparty if Siampark has a contractual/commercial relationship | Property ownership fact belongs to property domain |
| Internal staff member / responsible person | Principal | Do not create duplicate Party merely for assignment |
| External salesperson with system access | Principal for access; Party only if separate business identity is needed | Access != business relationship |
| Booking platform / bank / accounting software | External Business System, not Party | A vendor Party may exist separately only if a contract scenario needs it |

## Important modeling consequences

### One shared identity, many contexts

The same external organization can be a supplier, customer and contact-bearing organization without separate records. One Party may have both CUSTOMER and SUPPLIER Counterparty roles, and roles are time-bounded independently.

### Contacts/CRM must sit on Party Registry, not replace it

The source CRM asks for people, organizations, contact details, relationships, search and archive behavior. Those identity facts are already owned by Party Registry. Any future CRM-specific notes, activities or opportunities must reference Party/Counterparty rather than re-own identity.

### Rental and contract modules reference Party/Counterparty

A lease, reservation, invoice, contract, maintenance order or sales document should carry PartyRef/CounterpartyRef as appropriate. They should not copy customer/supplier master data as canonical state.

### Historical documents may snapshot accepted contact/address facts

Party Registry owns current identity/contact facts, but a completed invoice/contract/reservation may retain the exact accepted address/name snapshot it used. Later Party correction must not rewrite the historical document.

## Minimal demo behavior that can be reused directly

Party Registry already publishes:

- Party create/update/archive;
- contact points;
- official identifiers;
- Party Relationships;
- Counterparty create;
- CUSTOMER/SUPPLIER role lifecycle;
- Party/Counterparty reads and search;
- ARES lookup;
- a Contacts page and Shell search contributions.

Therefore the demo should **not** create a Siampark-specific customer/supplier master.

## Safe simplifications for the demo

- Use a small seeded set of PERSON and ORGANIZATION Parties.
- Give each commercially relevant Party a Counterparty for Siampark's Legal Entity.
- Use CUSTOMER/SUPPLIER only; do not invent extra generic roles unless a selected scenario proves the need.
- Represent internal responsible staff as Principals.
- For short-stay groups, model only the booker as Party unless individual guest identity adds presentation value.
- Keep external systems out of Party Registry.

## One-line decision

**Siampark's external people and organizations use the existing Party Registry; commercial/contractual relationships use Counterparty with CUSTOMER/SUPPLIER roles; internal users/assignees use Principals; Siampark itself is the managed Legal Entity; and property renters, guests, contacts and vendors must not create parallel customer/contact identity models.**
