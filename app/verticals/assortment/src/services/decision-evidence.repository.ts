/* oxlint-disable anti-slop-effect/no-service-constructor-imports -- The owner-local transaction factory composes explicit source and repository seams; expires: 2027-09-23. */
import type { OperationalScope, ScopedTransactionExecutor } from '@app/core-runtime';
import { DateTime, Effect, Result, Schema } from 'effect';
import { and, eq } from 'drizzle-orm';
import {
  AssortmentDecisionEvidenceSchema,
  AssortmentDecisionRequestSchema,
  AssortmentGovernedDecisionSchema,
  AssortmentDependencyFailureError,
  AssortmentOwnerModuleIdSchema,
} from '../../shared/domain/decision-contracts.ts';
import type {
  AssortmentDecisionEvidence,
  AssortmentDecisionRequest,
  AssortmentGovernedDecision,
  AssortmentOwnerResourceRef,
} from '../../shared/domain/decision-contracts.ts';
import { AssortmentConsumerDecisionEvidenceReferenceSchema } from '../../shared/domain/consumer-evidence.ts';
import type {
  AssortmentDecisionEvidenceStore,
  AssortmentOwnedPurchaseConstituentDecision,
  AssortmentOwnedVisibilityDecision,
} from '../../shared/domain/ports/decision-evaluation.ts';
import {
  makeAssortmentDecisionEvaluation,
  makeUnavailableAssortmentDecisionSource,
} from '../../shared/domain/ports/decision-evaluation.ts';
import type { AssortmentOwnerFailure } from '../../shared/domain/ports/owner-evidence.ts';
import { assortmentMeaningFingerprint } from './policy-administration.service.ts';
import { decisionEvidence } from '../database/schema.ts';

const DecisionJsonCodec = Schema.toCodecJson(AssortmentGovernedDecisionSchema);
const RequestJsonCodec = Schema.toCodecJson(AssortmentDecisionRequestSchema);
const MODULE_ID = 'commerce.assortment' as const;
const EVIDENCE_RESOURCE_TYPE = 'commerce.assortment.decision-evidence' as const;

export type AssortmentPersistedDecisionEvidence = Readonly<{
  readonly evidence: AssortmentDecisionEvidence;
  readonly outcome: 'ELIGIBLE' | 'INELIGIBLE';
  readonly request: AssortmentDecisionRequest;
}>;

const ownerModuleId = Result.getOrThrow(Schema.decodeResult(AssortmentOwnerModuleIdSchema)(MODULE_ID));

const unavailable = (cause?: unknown): InstanceType<typeof AssortmentDependencyFailureError> => {
  const failure = new AssortmentDependencyFailureError({
    code: 'DEPENDENCY_FAILURE',
    ownerModuleId,
    retryable: true,
    safeReasonCode: 'DEPENDENCY_UNAVAILABLE',
  });
  if (cause !== undefined) {
    Object.defineProperty(failure, 'cause', { configurable: true, value: cause });
  }
  return failure;
};

export const assortmentDecisionRequestFingerprint = (request: AssortmentDecisionRequest): string => {
  const normalized = {
    ...request,
    trustedContext: {
      ...request.trustedContext,
      operationTime: DateTime.formatIso(request.trustedContext.operationTime),
    },
  };
  return assortmentMeaningFingerprint(normalized);
};

const isScopedRequest = (request: AssortmentDecisionRequest, scope: OperationalScope): boolean =>
  scope.legalEntityId !== undefined &&
  request.trustedContext.tenantId === scope.tenantId &&
  request.trustedContext.sellingLegalEntityRef.resourceId === scope.legalEntityId &&
  request.trustedContext.sellingLegalEntityRef.tenantId === scope.tenantId;

const decisionEvidenceReference = (tenantId: string, resourceId: string) => ({
  evidenceRef: {
    moduleId: MODULE_ID,
    resourceId,
    resourceType: EVIDENCE_RESOURCE_TYPE,
    tenantId,
  },
  ownerModuleId: 'commerce.assortment',
});

type PersistableDecision = AssortmentOwnedPurchaseConstituentDecision | AssortmentOwnedVisibilityDecision;

const requestOf = (input: PersistableDecision): AssortmentDecisionRequest => input.request;

const evidenceOf = (input: PersistableDecision): AssortmentGovernedDecision => input.decision;

const encodeDecision = (decision: AssortmentGovernedDecision) =>
  Schema.encodeUnknownEffect(DecisionJsonCodec)(decision).pipe(
    // oxlint-disable-next-line effect-native/no-json-schema-as-document-contract -- JSONB is opaque only after the governed codec validated the evidence.
    Effect.flatMap((value) => Schema.decodeEffect(Schema.Json)(value)),
    Effect.mapError(unavailable),
  );

const encodeRequest = (request: AssortmentDecisionRequest) =>
  Schema.encodeUnknownEffect(RequestJsonCodec)(request).pipe(
    // oxlint-disable-next-line effect-native/no-json-schema-as-document-contract -- JSONB is opaque only after the governed codec validated the request.
    Effect.flatMap((value) => Schema.decodeEffect(Schema.Json)(value)),
    Effect.mapError(unavailable),
  );

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- JSONB is parsed at this repository boundary.
const decodeDecision = (value: unknown) =>
  Schema.decodeUnknownEffect(DecisionJsonCodec)(value).pipe(Effect.mapError(unavailable));

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- JSONB is parsed at this repository boundary.
const decodeRequest = (value: unknown) =>
  Schema.decodeUnknownEffect(RequestJsonCodec)(value).pipe(Effect.mapError(unavailable));

const storedEvidence = (
  decision: AssortmentGovernedDecision,
  request: AssortmentDecisionRequest,
  row: Readonly<{ readonly outcome: string; readonly requestFingerprint: string }>,
): Effect.Effect<AssortmentPersistedDecisionEvidence, AssortmentOwnerFailure> => {
  if (
    (decision.outcome !== 'ELIGIBLE' && decision.outcome !== 'INELIGIBLE') ||
    row.outcome !== decision.outcome ||
    row.requestFingerprint !== assortmentDecisionRequestFingerprint(request) ||
    decision.evidence === undefined ||
    !Schema.is(AssortmentDecisionEvidenceSchema)(decision.evidence)
  ) {
    return Effect.fail(unavailable());
  }
  return Effect.succeed({ evidence: decision.evidence, outcome: decision.outcome, request });
};

export const assortmentDecisionEvidenceRepositoryForScope = (
  transaction: ScopedTransactionExecutor,
  scope: OperationalScope,
): AssortmentDecisionEvidenceStore & {
  readonly resolve: (
    reference: AssortmentOwnerResourceRef,
  ) => Effect.Effect<AssortmentPersistedDecisionEvidence, AssortmentOwnerFailure>;
} => ({
  persist: Effect.fn('assortmentDecisionEvidenceRepositoryForScope.persist')(function* persistDecisionEvidence(input) {
    const request = requestOf(input);
    const decision = evidenceOf(input);
    const { legalEntityId } = scope;
    if (
      legalEntityId === undefined ||
      !isScopedRequest(request, scope) ||
      decision.outcome === 'INDETERMINATE' ||
      decision.evidence === undefined
    ) {
      return yield* unavailable();
    }
    const [decisionJson, requestJson] = yield* Effect.all([encodeDecision(decision), encodeRequest(request)], {
      concurrency: 2,
    });
    const [row] = yield* transaction
      .insert(decisionEvidence)
      .values({
        decisionJson,
        legalEntityId,
        outcome: decision.outcome,
        requestFingerprint: assortmentDecisionRequestFingerprint(request),
        requestJson,
        tenantId: scope.tenantId,
      })
      .returning({ decisionEvidenceId: decisionEvidence.decisionEvidenceId })
      .pipe(Effect.mapError(unavailable));
    if (row === undefined) {
      return yield* unavailable();
    }
    return yield* Schema.decodeEffect(AssortmentConsumerDecisionEvidenceReferenceSchema)(
      decisionEvidenceReference(scope.tenantId, row.decisionEvidenceId),
    ).pipe(Effect.mapError(unavailable));
  }),
  resolve: Effect.fn('assortmentDecisionEvidenceRepositoryForScope.resolve')(
    function* resolveDecisionEvidence(reference) {
      if (
        scope.legalEntityId === undefined ||
        reference.tenantId !== scope.tenantId ||
        reference.moduleId !== MODULE_ID ||
        reference.resourceType !== EVIDENCE_RESOURCE_TYPE
      ) {
        return yield* unavailable();
      }
      const [row] = yield* transaction
        .select({
          decisionJson: decisionEvidence.decisionJson,
          legalEntityId: decisionEvidence.legalEntityId,
          outcome: decisionEvidence.outcome,
          requestFingerprint: decisionEvidence.requestFingerprint,
          requestJson: decisionEvidence.requestJson,
          tenantId: decisionEvidence.tenantId,
        })
        .from(decisionEvidence)
        .where(
          and(
            eq(decisionEvidence.decisionEvidenceId, reference.resourceId),
            eq(decisionEvidence.tenantId, scope.tenantId),
            eq(decisionEvidence.legalEntityId, scope.legalEntityId),
          ),
        )
        .limit(1)
        .pipe(Effect.mapError(unavailable));
      if (row === undefined || row.tenantId !== scope.tenantId || row.legalEntityId !== scope.legalEntityId) {
        return yield* unavailable();
      }
      const request = yield* decodeRequest(row.requestJson);
      // Preserve decode order so malformed request data cannot be hidden by a valid decision payload.
      // oxlint-disable-next-line effect-native/no-sequential-independent-yields
      const decision = yield* decodeDecision(row.decisionJson);
      return yield* storedEvidence(decision, request, row);
    },
  ),
});

export const assortmentDecisionEvaluationForScope = (transaction: ScopedTransactionExecutor, scope: OperationalScope) =>
  makeAssortmentDecisionEvaluation({
    evidenceStore: assortmentDecisionEvidenceRepositoryForScope(transaction, scope),
    source: makeUnavailableAssortmentDecisionSource(),
  });

export const assortmentDecisionEvidenceReferenceForScope = (
  transaction: ScopedTransactionExecutor,
  scope: OperationalScope,
) => assortmentDecisionEvidenceRepositoryForScope(transaction, scope).resolve;
