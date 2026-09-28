import { defineScopedRoutine } from '@app/core-runtime';
import type { OperationalScope, ReadServiceFactory } from '@app/core-runtime';
import { DateTime, Effect, Option, Schema } from 'effect';
import { and, eq } from 'drizzle-orm';
import {
  admissionSetEntries,
  admissionSets,
  closedBoundaries,
  closedBoundaryEndFacts,
  collectionRevisions,
} from '../database/schema.ts';
import type {
  CreateClosedAssortmentBoundaryPayload,
  EndClosedAssortmentBoundaryPayload,
  ReplaceClosedAssortmentBoundaryPayload,
} from '../../shared/actions/boundary-administration.ts';
import {
  boundaryAdmissionEvidence,
  boundaryMeaningFingerprint,
  collectionRevisionRef,
} from '../actions/boundary-administration-support.ts';
import type { BoundaryAdmissionEvidence } from '../actions/boundary-administration-support.ts';
import { AssortmentPolicyPersistenceUnavailable } from '../../shared/domain/policy-errors.ts';

type Failure = InstanceType<typeof AssortmentPolicyPersistenceUnavailable>;
type ScopedTransaction = Parameters<ReadServiceFactory<Readonly<Record<string, never>>>>[0];
type Common = Readonly<{
  actionInvocationId: string;
  actorPrincipalId: string;
  legalEntityId: string;
  tenantId: string;
}>;
type Conflict = Readonly<{
  readonly conflict: 'IDEMPOTENCY_REUSED' | 'CONCURRENT_OVERLAP' | 'LIFECYCLE';
  readonly kind: 'conflict';
}>;
type NotFound = Readonly<{ readonly kind: 'not_found' }>;
type Stale = Readonly<{ readonly kind: 'stale_basis' }>;
export type BoundaryOutcome =
  | Readonly<{
      readonly admissionSet: PersistedAdmissionSetEvidence;
      readonly boundaryId: string;
      readonly created: boolean;
    }>
  | Conflict
  | NotFound
  | Stale;
export type EndBoundaryOutcome = Readonly<{ readonly ended: boolean }> | Conflict | NotFound | Stale;
export type ReplaceBoundaryOutcome =
  | Readonly<{ readonly createdBoundaryId: string; readonly replaced: boolean }>
  | Conflict
  | NotFound
  | Stale;
export interface BoundaryAdministrationService {
  readonly create: (input: CreateClosedAssortmentBoundaryPayload & Common) => Effect.Effect<BoundaryOutcome, Failure>;
  readonly end: (input: EndClosedAssortmentBoundaryPayload & Common) => Effect.Effect<EndBoundaryOutcome, Failure>;
  readonly replace: (
    input: ReplaceClosedAssortmentBoundaryPayload & Common,
  ) => Effect.Effect<ReplaceBoundaryOutcome, Failure>;
}
const unavailable = () =>
  new AssortmentPolicyPersistenceUnavailable({
    code: 'assortment_policy_persistence_unavailable',
    reason: 'Assortment boundary persistence is unavailable',
  });
const notFound = () => ({ kind: 'not_found' as const });
const lockClosedBoundaryScope = defineScopedRoutine({
  name: 'lock_closed_assortment_boundary_scope',
  ownerModuleKey: 'commerce.assortment',
  parameters: [
    { source: 'tenantId', type: 'uuid' },
    { source: 'legalEntityId', type: 'uuid' },
    { source: 'input', type: 'text' },
    { source: 'input', type: 'text' },
    { source: 'input', type: 'text' },
    { source: 'input', type: 'text' },
  ],
  resultSchema: Schema.Struct({ locked: Schema.Boolean }),
  routineKey: 'boundary.lock-scope',
  schema: 'assortment',
});
const db = <Value, FailureError>(effect: Effect.Effect<Value, FailureError>) =>
  effect.pipe(
    Effect.mapError((failure) => {
      void failure;
      return unavailable();
    }),
  );
const subjectKey = (input: CreateClosedAssortmentBoundaryPayload) =>
  input.subject.kind === 'COUNTERPARTY'
    ? { id: input.subject.counterpartyRef.resourceId, kind: input.subject.kind }
    : { id: input.subject.profileRef.resourceId, kind: input.subject.kind };
export const boundaryRef = (tenantId: string, resourceId: string) => ({
  moduleId: 'commerce.assortment' as const,
  resourceId,
  resourceType: 'commerce.assortment.closed-assortment-boundary' as const,
  tenantId,
});
type PersistedAdmissionSetEvidence = BoundaryAdmissionEvidence &
  Readonly<{
    readonly collectionRevisionRef: ReturnType<typeof collectionRevisionRef>;
  }>;

const persistedAdmissionSetEvidence = (
  tenantId: string,
  revision: Readonly<{
    readonly collectionKind: string;
    readonly collectionRevisionId: string;
    readonly completeness: string;
    readonly contentHash: string;
    readonly memberCount: number;
  }>,
  admissionSet: Readonly<{ readonly setKind: string }>,
): PersistedAdmissionSetEvidence | undefined => {
  if (
    revision.collectionKind !== 'CLOSED_BOUNDARY_ADMISSION_SET' ||
    revision.completeness !== 'COMPLETE' ||
    !/^[0-9a-f]{64}$/u.test(revision.contentHash) ||
    !Number.isInteger(revision.memberCount) ||
    revision.memberCount < 0 ||
    (admissionSet.setKind !== 'EMPTY' && admissionSet.setKind !== 'ENTRIES') ||
    (admissionSet.setKind === 'EMPTY' && revision.memberCount !== 0) ||
    (admissionSet.setKind === 'ENTRIES' && revision.memberCount === 0)
  ) {
    return undefined;
  }
  return {
    collectionRevisionRef: collectionRevisionRef(tenantId, revision.collectionRevisionId),
    contentHash: revision.contentHash,
    memberCount: revision.memberCount,
    setKind: admissionSet.setKind,
  };
};
const lock = (tx: ScopedTransaction, key: readonly [string, string, string, string]) =>
  db(tx.invoke(lockClosedBoundaryScope, key)).pipe(
    Effect.flatMap((rows) => (rows[0]?.locked === true ? Effect.succeed(true) : Effect.fail(unavailable()))),
  );
const entryTarget = (entry: CreateClosedAssortmentBoundaryPayload['admissionSet']['entries'][number]) => {
  if (entry.kind === 'ALL') {
    return { id: null, moduleId: null, type: null };
  }
  if (entry.kind === 'CATEGORY') {
    return {
      id: entry.categoryRef.resourceId,
      moduleId: entry.categoryRef.moduleId,
      type: entry.categoryRef.resourceType,
    };
  }
  if (entry.kind === 'PRODUCT') {
    return {
      id: entry.productRef.resourceId,
      moduleId: entry.productRef.moduleId,
      type: entry.productRef.resourceType,
    };
  }
  if (entry.kind === 'VARIANT') {
    return {
      id: entry.variantRef.resourceId,
      moduleId: entry.variantRef.moduleId,
      type: entry.variantRef.resourceType,
    };
  }
  const ref = entry.packageOptionRef;
  return { id: ref.resourceId, moduleId: ref.moduleId, type: ref.resourceType };
};
export const matchesBoundaryCreateReplay = (
  row: Readonly<{ actor: string; provenance: string; reason: string; semanticFingerprint: string }>,
  input: CreateClosedAssortmentBoundaryPayload & Common,
): boolean =>
  row.actor === input.actorPrincipalId &&
  row.provenance === input.provenanceRef &&
  row.reason === input.reason &&
  row.semanticFingerprint === boundaryMeaningFingerprint(input);
export const matchesBoundaryEndReplay = (
  row: Readonly<{
    actor: string;
    basisFingerprint: string;
    boundaryId: string;
    effectiveAt: Date;
    provenance: string;
    reason: string;
  }>,
  input: EndClosedAssortmentBoundaryPayload & Common,
): boolean =>
  row.actor === input.actorPrincipalId &&
  row.basisFingerprint === input.expectedBasisFingerprint &&
  row.boundaryId === input.boundaryRef.resourceId &&
  row.effectiveAt.getTime() === DateTime.toDateUtc(input.effectiveAt).getTime() &&
  row.provenance === input.provenanceRef &&
  row.reason === input.reason;
type ScopeRow = Readonly<{ marketResourceId: string | null; storefrontResourceId: string | null }>;
type ExistingScopeRow = ScopeRow & Readonly<{ boundaryId: string }>;
const narrower = (left: ScopeRow, right: ScopeRow): boolean => {
  const leftAdds =
    (left.marketResourceId !== null && right.marketResourceId === null) ||
    (left.storefrontResourceId !== null && right.storefrontResourceId === null);
  return (
    leftAdds &&
    (right.marketResourceId === null || right.marketResourceId === left.marketResourceId) &&
    (right.storefrontResourceId === null || right.storefrontResourceId === left.storefrontResourceId)
  );
};
const overlapConflict = (left: ScopeRow, right: ScopeRow): boolean =>
  !(
    (left.marketResourceId !== null &&
      right.marketResourceId !== null &&
      left.marketResourceId !== right.marketResourceId) ||
    (left.storefrontResourceId !== null &&
      right.storefrontResourceId !== null &&
      left.storefrontResourceId !== right.storefrontResourceId)
  ) &&
  ((left.marketResourceId === right.marketResourceId && left.storefrontResourceId === right.storefrontResourceId) ||
    (!narrower(left, right) && !narrower(right, left)));
export const boundaryScopeConflict = overlapConflict;
export const boundaryIntervalsOverlap = (existingEnd: number | undefined, proposedStart: number): boolean =>
  existingEnd === undefined || existingEnd > proposedStart;

const loadPersistedAdmissionSetEvidence = (
  tx: ScopedTransaction,
  tenantId: string,
  legalEntityId: string,
  boundaryId: string,
): Effect.Effect<PersistedAdmissionSetEvidence, Failure> =>
  Effect.all(
    [
      db(
        tx
          .select({
            collectionKind: collectionRevisions.collectionKind,
            collectionRevisionId: collectionRevisions.collectionRevisionId,
            completeness: collectionRevisions.completeness,
            contentHash: collectionRevisions.contentHash,
            memberCount: collectionRevisions.memberCount,
          })
          .from(collectionRevisions)
          .where(
            and(
              eq(collectionRevisions.tenantId, tenantId),
              eq(collectionRevisions.legalEntityId, legalEntityId),
              eq(collectionRevisions.aggregateId, boundaryId),
            ),
          )
          .limit(1),
      ),
      db(
        tx
          .select({ setKind: admissionSets.setKind })
          .from(admissionSets)
          .where(
            and(
              eq(admissionSets.tenantId, tenantId),
              eq(admissionSets.legalEntityId, legalEntityId),
              eq(admissionSets.closedBoundaryId, boundaryId),
            ),
          )
          .limit(1),
      ),
    ],
    { concurrency: 2 },
  ).pipe(
    Effect.flatMap(([revision, admissionSet]) => {
      const evidence =
        revision[0] === undefined || admissionSet[0] === undefined
          ? undefined
          : persistedAdmissionSetEvidence(tenantId, revision[0], admissionSet[0]);
      return evidence === undefined ? Effect.fail(unavailable()) : Effect.succeed(evidence);
    }),
  );

const resolveCreateReplay = Effect.fn('BoundaryAdministrationService.resolveCreateReplay')(
  function* resolveCreateReplayEffect(tx: ScopedTransaction, input: CreateClosedAssortmentBoundaryPayload & Common) {
    const replay = yield* db(
      tx
        .select({
          actor: closedBoundaries.actorPrincipalId,
          id: closedBoundaries.closedBoundaryId,
          provenance: closedBoundaries.provenanceRef,
          reason: closedBoundaries.reason,
          semanticFingerprint: closedBoundaries.semanticFingerprint,
        })
        .from(closedBoundaries)
        .where(
          and(
            eq(closedBoundaries.tenantId, input.tenantId),
            eq(closedBoundaries.legalEntityId, input.legalEntityId),
            eq(closedBoundaries.idempotencyKey, input.actionInvocationId),
          ),
        )
        .limit(1),
    );
    const [row] = replay;
    if (row === undefined) {
      return Option.none<BoundaryOutcome>();
    }
    if (!matchesBoundaryCreateReplay(row, input)) {
      return Option.some<BoundaryOutcome>({ conflict: 'IDEMPOTENCY_REUSED' as const, kind: 'conflict' as const });
    }
    const admissionSet = yield* loadPersistedAdmissionSetEvidence(tx, input.tenantId, input.legalEntityId, row.id);
    return Option.some<BoundaryOutcome>({ admissionSet, boundaryId: row.id, created: false });
  },
);

const hasCreateBoundaryOverlap = (
  existing: readonly ExistingScopeRow[],
  ended: readonly Readonly<{ readonly boundaryId: string; readonly effectiveAt: Date }>[],
  proposedScope: ScopeRow,
  proposedAt: number,
): boolean => {
  const endAt = new Map(ended.map((row) => [row.boundaryId, row.effectiveAt]));
  return existing.some((row) => {
    const existingEnd = endAt.get(row.boundaryId)?.getTime();
    return boundaryIntervalsOverlap(existingEnd, proposedAt) && overlapConflict(row, proposedScope);
  });
};

const persistCreatedBoundary = Effect.fn('BoundaryAdministrationService.persistCreatedBoundary')(
  function* persistCreatedBoundaryEffect(
    tx: ScopedTransaction,
    input: CreateClosedAssortmentBoundaryPayload & Common,
    evidence: BoundaryAdmissionEvidence,
  ) {
    const subject = subjectKey(input);
    const rows = yield* db(
      tx
        .insert(closedBoundaries)
        .values({
          actionInvocationId: input.actionInvocationId,
          actorPrincipalId: input.actorPrincipalId,
          channelResourceId: input.commercialScope.channelRef.resourceId,
          effectiveFrom: DateTime.toDateUtc(input.effectiveFrom),
          idempotencyKey: input.actionInvocationId,
          legalEntityId: input.legalEntityId,
          marketResourceId: input.commercialScope.commerceMarketRef?.resourceId ?? null,
          provenanceRef: input.provenanceRef,
          purpose: input.decisionPurpose,
          reason: input.reason,
          semanticFingerprint: boundaryMeaningFingerprint(input),
          storefrontResourceId: input.commercialScope.storefrontRef?.resourceId ?? null,
          subjectKind: subject.kind,
          subjectResourceId: subject.id,
          tenantId: input.tenantId,
        })
        .returning({ id: closedBoundaries.closedBoundaryId }),
    );
    const boundaryId = rows[0]?.id;
    if (boundaryId === undefined) {
      return yield* unavailable();
    }
    const revisionRows = yield* db(
      tx
        .insert(collectionRevisions)
        .values({
          actionInvocationId: input.actionInvocationId,
          actorPrincipalId: input.actorPrincipalId,
          aggregateId: boundaryId,
          collectionKind: 'CLOSED_BOUNDARY_ADMISSION_SET',
          completeness: 'COMPLETE',
          contentHash: evidence.contentHash,
          idempotencyKey: input.actionInvocationId,
          legalEntityId: input.legalEntityId,
          memberCount: evidence.memberCount,
          provenanceRef: input.provenanceRef,
          purpose: input.decisionPurpose,
          reason: input.reason,
          revision: 1,
          tenantId: input.tenantId,
        })
        .returning({ id: collectionRevisions.collectionRevisionId }),
    );
    const collectionRevisionId = revisionRows[0]?.id;
    if (collectionRevisionId === undefined) {
      return yield* unavailable();
    }
    const setRows = yield* db(
      tx
        .insert(admissionSets)
        .values({
          actionInvocationId: input.actionInvocationId,
          actorPrincipalId: input.actorPrincipalId,
          closedBoundaryId: boundaryId,
          collectionRevisionId,
          idempotencyKey: input.actionInvocationId,
          legalEntityId: input.legalEntityId,
          provenanceRef: input.provenanceRef,
          purpose: input.decisionPurpose,
          reason: input.reason,
          setKind: evidence.setKind,
          tenantId: input.tenantId,
        })
        .returning({ id: admissionSets.admissionSetId }),
    );
    const setId = setRows[0]?.id;
    if (setId === undefined) {
      return yield* unavailable();
    }
    if (input.admissionSet.entries.length > 0) {
      yield* db(
        tx.insert(admissionSetEntries).values(
          input.admissionSet.entries.map((entry, ordinal) => {
            const target = entryTarget(entry);
            return {
              actionInvocationId: input.actionInvocationId,
              actorPrincipalId: input.actorPrincipalId,
              admissionSetId: setId,
              coverageKind: entry.kind,
              idempotencyKey: input.actionInvocationId,
              legalEntityId: input.legalEntityId,
              ordinal,
              provenanceRef: input.provenanceRef,
              reason: input.reason,
              targetOwnerModuleId: target.moduleId,
              targetResourceId: target.id,
              targetResourceType: target.type,
              tenantId: input.tenantId,
            };
          }),
        ),
      );
    }
    return {
      admissionSet: { ...evidence, collectionRevisionRef: collectionRevisionRef(input.tenantId, collectionRevisionId) },
      boundaryId,
      created: true,
    };
  },
);

export const boundaryAdministrationPersistenceForScope = (
  tx: ScopedTransaction,
  _scope: OperationalScope,
): BoundaryAdministrationService => {
  const create: BoundaryAdministrationService['create'] = Effect.fn('boundaryAdministration.create')(function* create(
    input: CreateClosedAssortmentBoundaryPayload & Common,
  ) {
    const subject = subjectKey(input);
    yield* lock(tx, [subject.kind, subject.id, input.decisionPurpose, input.commercialScope.channelRef.resourceId]);
    const replayOutcome = yield* resolveCreateReplay(tx, input);
    if (Option.isSome(replayOutcome)) {
      return replayOutcome.value;
    }
    const evidence = boundaryAdmissionEvidence(input);
    const existing = yield* db(
      tx
        .select({
          boundaryId: closedBoundaries.closedBoundaryId,
          effectiveFrom: closedBoundaries.effectiveFrom,
          marketResourceId: closedBoundaries.marketResourceId,
          storefrontResourceId: closedBoundaries.storefrontResourceId,
        })
        .from(closedBoundaries)
        .where(
          and(
            eq(closedBoundaries.tenantId, input.tenantId),
            eq(closedBoundaries.legalEntityId, input.legalEntityId),
            eq(closedBoundaries.subjectKind, subject.kind),
            eq(closedBoundaries.subjectResourceId, subject.id),
            eq(closedBoundaries.purpose, input.decisionPurpose),
            eq(closedBoundaries.channelResourceId, input.commercialScope.channelRef.resourceId),
          ),
        ),
    );
    const ended = yield* Effect.succeed(existing).pipe(
      Effect.flatMap(() =>
        db(
          tx
            .select({
              boundaryId: closedBoundaryEndFacts.closedBoundaryId,
              effectiveAt: closedBoundaryEndFacts.effectiveAt,
            })
            .from(closedBoundaryEndFacts)
            .where(
              and(
                eq(closedBoundaryEndFacts.tenantId, input.tenantId),
                eq(closedBoundaryEndFacts.legalEntityId, input.legalEntityId),
              ),
            ),
        ),
      ),
    );
    const proposedScope = {
      marketResourceId: input.commercialScope.commerceMarketRef?.resourceId ?? null,
      storefrontResourceId: input.commercialScope.storefrontRef?.resourceId ?? null,
    };
    const proposedAt = DateTime.toDateUtc(input.effectiveFrom).getTime();
    if (hasCreateBoundaryOverlap(existing, ended, proposedScope, proposedAt)) {
      return { conflict: 'CONCURRENT_OVERLAP', kind: 'conflict' } as const;
    }
    return yield* persistCreatedBoundary(tx, input, evidence);
  });
  const end: BoundaryAdministrationService['end'] = Effect.fn('boundaryAdministration.end')(function* end(
    input: EndClosedAssortmentBoundaryPayload & Common,
  ) {
    const replay = yield* db(
      tx
        .select({
          actor: closedBoundaryEndFacts.actorPrincipalId,
          basisFingerprint: closedBoundaryEndFacts.basisFingerprint,
          boundaryId: closedBoundaryEndFacts.closedBoundaryId,
          effectiveAt: closedBoundaryEndFacts.effectiveAt,
          provenance: closedBoundaryEndFacts.provenanceRef,
          reason: closedBoundaryEndFacts.reason,
        })
        .from(closedBoundaryEndFacts)
        .where(
          and(
            eq(closedBoundaryEndFacts.tenantId, input.tenantId),
            eq(closedBoundaryEndFacts.legalEntityId, input.legalEntityId),
            eq(closedBoundaryEndFacts.idempotencyKey, input.actionInvocationId),
          ),
        )
        .limit(1),
    );
    if (replay[0] !== undefined) {
      return replay[0].actor === input.actorPrincipalId &&
        replay[0].provenance === input.provenanceRef &&
        replay[0].reason === input.reason &&
        replay[0].basisFingerprint === input.expectedBasisFingerprint &&
        replay[0].boundaryId === input.boundaryRef.resourceId &&
        replay[0].effectiveAt.getTime() === DateTime.toDateUtc(input.effectiveAt).getTime()
        ? { ended: false }
        : { conflict: 'IDEMPOTENCY_REUSED' as const, kind: 'conflict' as const };
    }
    const boundary = yield* db(
      tx
        .select({
          channel: closedBoundaries.channelResourceId,
          purpose: closedBoundaries.purpose,
          semanticFingerprint: closedBoundaries.semanticFingerprint,
          subjectKind: closedBoundaries.subjectKind,
          subjectResourceId: closedBoundaries.subjectResourceId,
        })
        .from(closedBoundaries)
        .where(
          and(
            eq(closedBoundaries.tenantId, input.tenantId),
            eq(closedBoundaries.legalEntityId, input.legalEntityId),
            eq(closedBoundaries.closedBoundaryId, input.boundaryRef.resourceId),
          ),
        )
        .limit(1),
    );
    if (boundary[0] === undefined) {
      return notFound();
    }
    if (boundary[0].semanticFingerprint !== input.expectedBasisFingerprint) {
      return { kind: 'stale_basis' };
    }
    yield* lock(tx, [boundary[0].subjectKind, boundary[0].subjectResourceId, boundary[0].purpose, boundary[0].channel]);
    const alreadyEnded = yield* db(
      tx
        .select({ id: closedBoundaryEndFacts.closedBoundaryEndFactId })
        .from(closedBoundaryEndFacts)
        .where(
          and(
            eq(closedBoundaryEndFacts.tenantId, input.tenantId),
            eq(closedBoundaryEndFacts.legalEntityId, input.legalEntityId),
            eq(closedBoundaryEndFacts.closedBoundaryId, input.boundaryRef.resourceId),
          ),
        )
        .limit(1),
    );
    if (alreadyEnded[0] !== undefined) {
      return { conflict: 'LIFECYCLE', kind: 'conflict' };
    }
    const rows = yield* db(
      tx
        .insert(closedBoundaryEndFacts)
        .values({
          actionInvocationId: input.actionInvocationId,
          actorPrincipalId: input.actorPrincipalId,
          basisFingerprint: input.expectedBasisFingerprint,
          closedBoundaryId: input.boundaryRef.resourceId,
          effectiveAt: DateTime.toDateUtc(input.effectiveAt),
          idempotencyKey: input.actionInvocationId,
          legalEntityId: input.legalEntityId,
          provenanceRef: input.provenanceRef,
          reason: input.reason,
          tenantId: input.tenantId,
        })
        .returning({ id: closedBoundaryEndFacts.closedBoundaryEndFactId }),
    );
    return { ended: rows[0] !== undefined };
  });
  const replace: BoundaryAdministrationService['replace'] = Effect.fn('boundaryAdministration.replace')(
    function* replace(input: ReplaceClosedAssortmentBoundaryPayload & Common) {
      const proposed = {
        ...input,
        admissionSet: input.proposedAdmissionSet,
        commercialScope: input.proposedCommercialScope,
        decisionPurpose: input.proposedDecisionPurpose,
        effectiveFrom: input.proposedEffectiveFrom,
        subject: input.proposedSubject,
      };
      const replay = yield* db(
        tx
          .select({
            actor: closedBoundaries.actorPrincipalId,
            id: closedBoundaries.closedBoundaryId,
            provenance: closedBoundaries.provenanceRef,
            reason: closedBoundaries.reason,
            semanticFingerprint: closedBoundaries.semanticFingerprint,
          })
          .from(closedBoundaries)
          .where(
            and(
              eq(closedBoundaries.tenantId, input.tenantId),
              eq(closedBoundaries.legalEntityId, input.legalEntityId),
              eq(closedBoundaries.idempotencyKey, input.actionInvocationId),
            ),
          )
          .limit(1),
      );
      if (replay[0] !== undefined) {
        const oldEnd = yield* db(
          tx
            .select({
              actor: closedBoundaryEndFacts.actorPrincipalId,
              basisFingerprint: closedBoundaryEndFacts.basisFingerprint,
              boundaryId: closedBoundaryEndFacts.closedBoundaryId,
              effectiveAt: closedBoundaryEndFacts.effectiveAt,
              provenance: closedBoundaryEndFacts.provenanceRef,
              reason: closedBoundaryEndFacts.reason,
            })
            .from(closedBoundaryEndFacts)
            .where(
              and(
                eq(closedBoundaryEndFacts.tenantId, input.tenantId),
                eq(closedBoundaryEndFacts.legalEntityId, input.legalEntityId),
                eq(closedBoundaryEndFacts.idempotencyKey, input.actionInvocationId),
              ),
            )
            .limit(1),
        );
        const [endFact] = oldEnd;
        const exact =
          endFact !== undefined &&
          replay[0].actor === input.actorPrincipalId &&
          replay[0].provenance === input.provenanceRef &&
          replay[0].reason === input.reason &&
          replay[0].semanticFingerprint === boundaryMeaningFingerprint(proposed) &&
          endFact.actor === input.actorPrincipalId &&
          endFact.provenance === input.provenanceRef &&
          endFact.reason === input.reason &&
          endFact.boundaryId === input.existingBoundaryRef.resourceId &&
          endFact.basisFingerprint === input.expectedExistingBasisFingerprint &&
          endFact.effectiveAt.getTime() === DateTime.toDateUtc(input.effectiveAt).getTime();
        return exact
          ? { createdBoundaryId: replay[0].id, replaced: false }
          : { conflict: 'IDEMPOTENCY_REUSED' as const, kind: 'conflict' as const };
      }
      const ended = yield* end({
        ...input,
        boundaryRef: input.existingBoundaryRef,
        expectedBasisFingerprint: input.expectedExistingBasisFingerprint,
      });
      if ('kind' in ended) {
        return ended;
      }
      const created = yield* create(proposed);
      if ('kind' in created) {
        return created;
      }
      return { createdBoundaryId: created.boundaryId, replaced: true };
    },
  );
  return { create, end, replace };
};
export const boundaryAdministrationService = (tx: ScopedTransaction, scope: OperationalScope) =>
  Effect.succeed(boundaryAdministrationPersistenceForScope(tx, scope));
