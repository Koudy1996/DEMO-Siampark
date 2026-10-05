# Siampark Projects / task-planning reuse boundary

Wayfinder research note for **Decide the Projects and task-planning reuse boundary for Siampark**.

## Primary sources

- `SOUHRN_FUNKCNI_SPECIFIKACE_ERP_SIAMPARK.pdf` pp. 6, 11, 13–15
- `docs/contexts/projects/CONTEXT.md`
- current repository tree under `app/verticals/`
- `docs/PRODUCT.md`

## Resolution

The Siampark source has a strong work-management need, and OntOS already has accepted **Projects** semantics, but the target repository currently has **no implemented Projects vertical**. Therefore this is conceptual/model reuse plus a thin demo implementation, not direct runtime reuse.

## Source needs that map naturally to Projects concepts

The source repeatedly requires:

- task/ticket title and description;
- status;
- priority;
- due date;
- responsible person;
- links to property, asset, client, contract, document or other records;
- state/history/comments;
- maintenance and inspection work;
- incidents from security/equipment;
- CRM follow-up tasks;
- calendar visibility;
- project work split into stages/tasks;
- basic project status/milestones and responsible people.

The Projects context defines reusable Task / Task Collection / Task Property / Task View semantics and specifically supports:
- Status Task Property;
- Person Task Property referencing Principals;
- Date / Date Range;
- Files & Media references;
- flexible property schemas and saved views;
- task change history.

## Boundary decisions

### 1. Operational tasks should follow Projects Task semantics

Maintenance jobs, internal tickets, inspection reminders, CRM follow-ups and incident-remediation work are all variants of one Task concept rather than separate task engines.

For the demo, the thin work-management capability should preserve Projects vocabulary and behavior wherever practical.

### 2. Responsible internal person is a Principal

The Projects Person Task Property references Principals, matching the OntOS identity boundary. Task assignment must not create a duplicate employee/contact Party model.

### 3. Task links to business objects are contextual references

A Task may reference Property, Unit, Asset, Contract, Party/Counterparty, Reservation or other Resources through explicit references. Those linked resources remain owned by their modules.

### 4. Calendar is primarily a view/projection, not a second event system

The Siampark source explicitly says the basic calendar can be a read-only dashboard where the source date is edited in the owning agenda.

Therefore the demo calendar should aggregate due dates / stay dates / contract milestones / inspections from owned records. It should not require a generic calendar-event lifecycle unless a chosen scenario needs direct calendar editing.

### 5. Maintenance and incidents do not need separate workflow engines

An equipment fault, maintenance request or inspection can create/use a Task with a type/category and link back to the owning Asset/Property. The Asset domain owns asset state; the work-management capability owns the Task state.

### 6. “Project” is not automatically identical to Task Collection

The Projects context defines Task Collection as a schema-owning set of Tasks. Siampark's source-level “project” also asks for project status, milestones, budget/time/people planning and evaluation.

Those meanings are not fully defined by the current Task Collection semantics.

**Safe demo boundary:**
- use Task/Task Collection semantics for work execution;
- add a separate thin Project aggregate only if later selected scenarios need project-level status/budget/milestones;
- otherwise do not invent a Project entity just because the source has a project-management heading.

### 7. Capacity planning should be shallow

The source asks for a simple view of assigned workload, not workforce scheduling or HR accounting. A presentation-only workload summary derived from assigned Tasks is enough unless a later scenario proves otherwise.

### 8. Notifications are not owned by Projects as a generic platform

A task assignment or due date may trigger a notification/e-mail, but the owning workflow decides the event and meaning. Shared e-mail infrastructure can deliver it. The demo does not need a generic notification engine to establish task semantics.

## Current implementation reality

The repository contains:
- `docs/contexts/projects/CONTEXT.md` with accepted semantics;
- no `app/verticals/projects` implementation.

Therefore downstream specification must not say “reuse the existing Projects module” as if it were implemented. It should say:

> implement the minimum Siampark work-management slice aligned with OntOS Projects semantics, or defer it until a reusable Projects vertical exists.

## Minimum thin demo work-management slice

If retained by scenarios, the minimal capability should support:

- Task;
- title;
- status;
- priority;
- due date/date range;
- assignee Principal;
- one or more typed ResourceRefs to business context;
- short description/comment/history;
- list/filter views;
- read-only calendar projection of relevant dates.

Optional only if scenario-selected:
- Task Collection schema editing;
- custom properties;
- multiple saved views;
- project aggregate;
- workload/capacity dashboard;
- file/media attachment.

## Recommended demo views

Not final screen decisions, but the capability can be convincingly exposed through:
- “Tasks” list with filters;
- task detail;
- property/asset detail showing linked tasks;
- read-only calendar aggregated from task/contract/rental dates.

## One-line decision

**Reuse OntOS Projects semantics, not nonexistent runtime code: model Siampark maintenance, incidents, follow-ups and internal work as one Task capability aligned with Task/Task Collection concepts; keep calendar as a derived read-only view; introduce a separate Project aggregate only if later demo scenarios need true project-level status/budget/milestones.**
