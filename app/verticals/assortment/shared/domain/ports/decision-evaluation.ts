import { Context, Effect, Layer, Predicate, Result, Schema } from 'effect'; // oxlint-disable-line max-classes-per-file -- The runtime service and sanitized input error form one owner-local contract; expires: 2027-09-23.

import {
  AssortmentDecisionSubjectSchema,
  AssortmentDecisionRequestSchema,
  AssortmentCatalogSelectionSchema,
  AssortmentDependencyFailureError,
  AssortmentGovernedDecisionSchema,
  AssortmentOwnerModuleIdSchema,
  AssortmentOwnerResourceRefSchema,
  AssortmentPublicDecisionResponseSchema,
  AssortmentPurchaseConstituentSchema,
  AssortmentPurchaseRequestSchema,
  AssortmentSetPurchaseCompositionSchema,
  AssortmentVisibilityRequestSchema,
  AssortmentTrustedCommerceContextSchema,
  composeAssortmentPurchaseOutcome,
} from '../decision-contracts.ts';
import type {
  AssortmentDecisionSubject,
  AssortmentDecisionEvidence,
  AssortmentGovernedDecision,
  AssortmentOwnerResourceRef,
  AssortmentPurchaseConstituent,
  AssortmentPurchaseRequest,
  AssortmentPublicDecisionResponse,
  AssortmentSafeReasonCode,
  AssortmentVisibilityRequest,
} from '../decision-contracts.ts';
import {
  AssortmentConsumerDecisionEvidenceReferenceSchema,
  AssortmentProspectivePurchaseEvidenceSchema,
} from '../consumer-evidence.ts';
import type {
  AssortmentConsumerConstituentEvidence,
  AssortmentConsumerDecisionEvidenceReference,
  AssortmentProspectivePurchaseEvidence,
} from '../consumer-evidence.ts';
import type { AssortmentOwnerFailure } from './owner-evidence.ts';

const AssortmentGovernedDecisionTypeSchema = Schema.toType(AssortmentGovernedDecisionSchema);
const AssortmentConsumerDecisionEvidenceReferenceTypeSchema = Schema.toType(
  AssortmentConsumerDecisionEvidenceReferenceSchema,
);
const AssortmentProspectivePurchaseEvidenceTypeSchema = Schema.toType(AssortmentProspectivePurchaseEvidenceSchema);
const requestEquivalence = Schema.toEquivalence(AssortmentDecisionRequestSchema);
const subjectEquivalence = Schema.toEquivalence(AssortmentDecisionSubjectSchema);
const contextEquivalence = Schema.toEquivalence(AssortmentTrustedCommerceContextSchema);
const constituentEquivalence = Schema.toEquivalence(AssortmentPurchaseConstituentSchema);
const selectionEquivalence = Schema.toEquivalence(AssortmentCatalogSelectionSchema);
const resourceEquivalence = Schema.toEquivalence(AssortmentOwnerResourceRefSchema);

/**
 * Only opaque owner references cross the public request boundary.  The
 * operation time, channel, selling legal entity, and subject resolution are
 * supplied by the owner-local source from the trusted gateway scope.
 */
export const AssortmentVisibilityEvaluationRequestSchema = Schema.Struct({
  decisionPurpose: Schema.Literal('VISIBILITY'),
  principalRef: Schema.optionalKey(AssortmentVisibilityRequestSchema.fields.principalRef),
  productRef: AssortmentVisibilityRequestSchema.fields.productRef,
  subject: AssortmentDecisionSubjectSchema,
  trustedContextRef: AssortmentOwnerResourceRefSchema,
});
export type AssortmentVisibilityEvaluationRequest = typeof AssortmentVisibilityEvaluationRequestSchema.Type;

export const AssortmentPurchaseEvaluationRequestSchema = Schema.Struct({
  constituent: AssortmentPurchaseConstituentSchema,
  decisionPurpose: Schema.Literal('PURCHASE'),
  principalRef: Schema.optionalKey(AssortmentPurchaseRequestSchema.fields.principalRef),
  setComposition: Schema.optionalKey(AssortmentSetPurchaseCompositionSchema),
  subject: AssortmentDecisionSubjectSchema,
  trustedContextRef: AssortmentOwnerResourceRefSchema,
});
export type AssortmentPurchaseEvaluationRequest = typeof AssortmentPurchaseEvaluationRequestSchema.Type;

/** The trusted portion copied from ReadHandlerContext.scope. */
export interface AssortmentTrustedReadScope {
  // oxlint-disable-next-line effect-native/no-threaded-correlation-parameter -- ReadHandlerContext supplies the trusted transport correlation identity.
  readonly correlationId: string;
  readonly legalEntityId?: string;
  readonly principalId: string;
  readonly tenantId: string;
}

export interface AssortmentOwnedVisibilityDecision {
  readonly decision: AssortmentGovernedDecision;
  readonly request: AssortmentVisibilityRequest;
  readonly safeReasonCode?: AssortmentSafeReasonCode;
}

export interface AssortmentOwnedPurchaseConstituentDecision {
  readonly constituent: AssortmentPurchaseConstituent;
  readonly decision: AssortmentGovernedDecision;
  readonly request: AssortmentPurchaseRequest;
}

export interface AssortmentOwnedPurchaseDecision {
  readonly constituents: readonly AssortmentOwnedPurchaseConstituentDecision[];
  readonly decision: AssortmentGovernedDecision;
  readonly request: AssortmentPurchaseRequest;
  readonly safeReasonCode?: AssortmentSafeReasonCode;
}

/**
 * Owner-local implementation seam. It must build canonical requests through
 * Boundary/Candidate resolvers, currentness checks, and immutable Decision
 * Evidence before returning. No external owner API is invented here.
 */
// oxlint-disable-next-line effect-native/require-context-service-for-service-interface -- This owner-local source is injected by the generated read factory; expires: 2027-09-23.
export interface AssortmentDecisionSourcePort {
  readonly resolvePurchase: (
    request: AssortmentPurchaseEvaluationRequest,
    scope: AssortmentTrustedReadScope,
  ) => Effect.Effect<AssortmentOwnedPurchaseDecision, AssortmentOwnerFailure>;
  readonly resolveVisibility: (
    request: AssortmentVisibilityEvaluationRequest,
    scope: AssortmentTrustedReadScope,
  ) => Effect.Effect<AssortmentOwnedVisibilityDecision, AssortmentOwnerFailure>;
}

/** Full evidence is persisted owner-locally; only these bounded references leave the module. */
// oxlint-disable-next-line effect-native/require-context-service-for-service-interface -- This owner-local evidence sink is injected by the generated read factory; expires: 2027-09-23.
export interface AssortmentDecisionEvidenceStore {
  readonly persist: (
    input: AssortmentOwnedPurchaseConstituentDecision | AssortmentOwnedVisibilityDecision,
  ) => Effect.Effect<AssortmentConsumerDecisionEvidenceReference, AssortmentOwnerFailure>;
}

export class AssortmentDecisionRequestInvalidError extends Schema.TaggedError<AssortmentDecisionRequestInvalidError>()(
  'AssortmentDecisionRequestInvalidError',
  {
    code: Schema.Literal('INVALID_DECISION_REQUEST'),
    reason: Schema.Literals(['INVALID_INPUT', 'TRUSTED_SCOPE_MISMATCH']),
  },
) {}

export interface AssortmentPurchaseEvaluationResult {
  readonly consumerEvidence?: AssortmentProspectivePurchaseEvidence;
  readonly decision: AssortmentPublicDecisionResponse;
}

export const AssortmentPurchaseEvaluationResultSchema = Schema.Struct({
  consumerEvidence: Schema.optionalKey(AssortmentProspectivePurchaseEvidenceSchema),
  decision: AssortmentPublicDecisionResponseSchema,
});

export interface AssortmentDecisionEvaluationPort {
  readonly evaluatePurchase: (
    request: AssortmentPurchaseEvaluationRequest,
    scope: AssortmentTrustedReadScope,
  ) => Effect.Effect<AssortmentPurchaseEvaluationResult, AssortmentDecisionRequestInvalidError>;
  readonly evaluateVisibility: (
    request: AssortmentVisibilityEvaluationRequest,
    scope: AssortmentTrustedReadScope,
  ) => Effect.Effect<AssortmentPublicDecisionResponse, AssortmentDecisionRequestInvalidError>;
}

const unavailable = (): AssortmentPublicDecisionResponse => ({
  outcome: 'INDETERMINATE',
  retryable: true,
  safeReasonCode: 'DEPENDENCY_UNAVAILABLE',
});

const invalidRequest = (): AssortmentDecisionRequestInvalidError =>
  new AssortmentDecisionRequestInvalidError({
    code: 'INVALID_DECISION_REQUEST',
    reason: 'INVALID_INPUT',
  });

const subjectReference = (subject: AssortmentDecisionSubject): AssortmentOwnerResourceRef => {
  if (subject.kind === 'GUEST_PURCHASE_CONTEXT') {
    return subject.guestEvidence.evidenceRef;
  }
  return subject.subject.kind === 'RETAIL_CUSTOMER_PROFILE'
    ? subject.subject.profileRef
    : subject.subject.counterpartyRef;
};

const validateScope = (
  request: AssortmentVisibilityEvaluationRequest | AssortmentPurchaseEvaluationRequest,
  scope: AssortmentTrustedReadScope,
): Effect.Effect<void, AssortmentDecisionRequestInvalidError> => {
  const productRef =
    request.decisionPurpose === 'VISIBILITY' ? request.productRef : request.constituent.catalogSelection.productRef;
  const principalMatches =
    request.principalRef === undefined ||
    (request.principalRef.tenantId === scope.tenantId && request.principalRef.principalId === scope.principalId);
  if (
    scope.correlationId.trim() === '' ||
    scope.principalId.trim() === '' ||
    scope.legalEntityId === undefined ||
    scope.legalEntityId.trim() === '' ||
    request.trustedContextRef.tenantId !== scope.tenantId ||
    productRef.tenantId !== scope.tenantId ||
    subjectReference(request.subject).tenantId !== scope.tenantId ||
    !principalMatches
  ) {
    return Effect.fail(
      new AssortmentDecisionRequestInvalidError({
        code: 'INVALID_DECISION_REQUEST',
        reason: 'TRUSTED_SCOPE_MISMATCH',
      }),
    );
  }
  return Effect.void;
};

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Recursive boundary check accepts unknown owner output before schema validation; expires: 2027-09-23.
const deeplyFrozen = (value: unknown, seen = new Set<object>()): boolean => {
  if (!Predicate.isObjectOrArray(value)) {
    return true;
  }
  if (seen.has(value)) {
    return true;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  seen.add(value);
  return Object.values(value).every((nested) => deeplyFrozen(nested, seen));
};

const immutable = (decision: AssortmentGovernedDecision): boolean => {
  if (!Schema.is(AssortmentGovernedDecisionTypeSchema)(decision)) {
    return false;
  }
  return deeplyFrozen(decision);
};

const trustedContextMatchesScope = (
  context: typeof AssortmentTrustedCommerceContextSchema.Type,
  scope: AssortmentTrustedReadScope,
): boolean =>
  context.tenantId === scope.tenantId &&
  context.sellingLegalEntityRef.tenantId === scope.tenantId &&
  context.sellingLegalEntityRef.resourceId === scope.legalEntityId;

const evidenceMatchesRequest = (
  decision: AssortmentGovernedDecision,
  request: AssortmentVisibilityRequest | AssortmentPurchaseRequest,
  target: AssortmentDecisionEvidence['target'],
): boolean => {
  if (decision.outcome === 'INDETERMINATE') {
    return (
      decision.evidence === undefined ||
      (subjectEquivalence(decision.evidence.subject, request.subject) &&
        contextEquivalence(decision.evidence.trustedContext, request.trustedContext) &&
        decision.evidence.operationTime === request.trustedContext.operationTime &&
        (target.kind === 'PRODUCT'
          ? decision.evidence.target.kind === 'PRODUCT' &&
            resourceEquivalence(decision.evidence.target.productRef, target.productRef)
          : decision.evidence.target.kind === 'CATALOG_SELECTION' &&
            selectionEquivalence(decision.evidence.target.selection, target.selection)))
    );
  }
  return (
    decision.evidence !== undefined &&
    subjectEquivalence(decision.evidence.subject, request.subject) &&
    contextEquivalence(decision.evidence.trustedContext, request.trustedContext) &&
    decision.evidence.operationTime === request.trustedContext.operationTime &&
    (target.kind === 'PRODUCT'
      ? decision.evidence.target.kind === 'PRODUCT' &&
        resourceEquivalence(decision.evidence.target.productRef, target.productRef)
      : decision.evidence.target.kind === 'CATALOG_SELECTION' &&
        selectionEquivalence(decision.evidence.target.selection, target.selection))
  );
};

const visibilityOwnedOutputMatches = (
  owned: AssortmentOwnedVisibilityDecision,
  request: AssortmentVisibilityEvaluationRequest,
  scope: AssortmentTrustedReadScope,
): boolean =>
  Schema.is(AssortmentVisibilityRequestSchema)(owned.request) &&
  owned.request.decisionPurpose === request.decisionPurpose &&
  resourceEquivalence(owned.request.productRef, request.productRef) &&
  (owned.request.principalRef === undefined) === (request.principalRef === undefined) &&
  (owned.request.principalRef === undefined ||
    (owned.request.principalRef.tenantId === request.principalRef?.tenantId &&
      owned.request.principalRef.principalId === request.principalRef?.principalId)) &&
  subjectEquivalence(owned.request.subject, request.subject) &&
  trustedContextMatchesScope(owned.request.trustedContext, scope) &&
  evidenceMatchesRequest(owned.decision, owned.request, { kind: 'PRODUCT', productRef: request.productRef });

const purchaseOwnedOutputMatches = (
  owned: AssortmentOwnedPurchaseDecision,
  request: AssortmentPurchaseEvaluationRequest,
  scope: AssortmentTrustedReadScope,
): boolean => {
  if (!Schema.is(AssortmentPurchaseRequestSchema)(owned.request)) {
    return false;
  }
  let expectedRequest: AssortmentPurchaseRequest = {
    constituent: request.constituent,
    decisionPurpose: request.decisionPurpose,
    subject: request.subject,
    trustedContext: owned.request.trustedContext,
  };
  if (request.principalRef !== undefined) {
    expectedRequest = { ...expectedRequest, principalRef: request.principalRef };
  }
  if (request.setComposition !== undefined) {
    expectedRequest = { ...expectedRequest, setComposition: request.setComposition };
  }
  if (!requestEquivalence(owned.request, expectedRequest)) {
    return false;
  }
  if (
    !trustedContextMatchesScope(owned.request.trustedContext, scope) ||
    !evidenceMatchesRequest(owned.decision, owned.request, {
      kind: 'CATALOG_SELECTION',
      selection: request.constituent.catalogSelection,
    })
  ) {
    return false;
  }

  const expectedConstituents = [owned.request.constituent, ...(owned.request.setComposition?.requiredComponents ?? [])];
  if (owned.decision.outcome === 'INDETERMINATE' && owned.constituents.length === 0) {
    return true;
  }
  const endedWithAuthoritativeDeny =
    owned.decision.outcome === 'INELIGIBLE' &&
    owned.constituents.at(-1)?.decision.outcome === 'INELIGIBLE' &&
    owned.constituents.slice(0, -1).every((item) => item.decision.outcome !== 'INELIGIBLE');
  if (
    (endedWithAuthoritativeDeny
      ? owned.constituents.length > expectedConstituents.length
      : owned.constituents.length !== expectedConstituents.length) ||
    owned.constituents.length === 0
  ) {
    return false;
  }
  if (
    owned.constituents.some((item, index) => {
      const expected = expectedConstituents[index];
      return (
        expected === undefined ||
        (endedWithAuthoritativeDeny &&
          item.decision.outcome === 'INELIGIBLE' &&
          index !== owned.constituents.length - 1) ||
        !Schema.is(AssortmentPurchaseRequestSchema)(item.request) ||
        !requestEquivalence(item.request, owned.request) ||
        !constituentEquivalence(item.constituent, expected) ||
        !immutable(item.decision) ||
        !evidenceMatchesRequest(item.decision, item.request, {
          kind: 'CATALOG_SELECTION',
          selection: item.constituent.catalogSelection,
        })
      );
    })
  ) {
    return false;
  }
  return (
    composeAssortmentPurchaseOutcome(
      owned.constituents.map((item) => ({ constituent: item.constituent, outcome: item.decision.outcome })),
    ) === owned.decision.outcome
  );
};

const responseFor = (
  decision: AssortmentGovernedDecision,
  explicitReason?: AssortmentSafeReasonCode,
): AssortmentPublicDecisionResponse => {
  if (decision.outcome === 'ELIGIBLE') {
    return { outcome: 'ELIGIBLE', retryable: false };
  }
  if (decision.outcome === 'INELIGIBLE') {
    let safeReasonCode: 'BOUNDARY_EXCLUDED' | 'RULE_DENIED' = 'RULE_DENIED';
    if (explicitReason === 'BOUNDARY_EXCLUDED' || explicitReason === 'RULE_DENIED') {
      safeReasonCode = explicitReason;
    } else if (
      decision.evidence.boundaryPath?.kind === 'UNIQUE_MAXIMAL_BOUNDARY' &&
      !decision.evidence.boundaryPath.admitted
    ) {
      safeReasonCode = 'BOUNDARY_EXCLUDED';
    }
    return { outcome: 'INELIGIBLE', retryable: false, safeReasonCode };
  }
  if (explicitReason === 'CURRENTNESS_UNCERTAIN') {
    return { outcome: 'INDETERMINATE', retryable: true, safeReasonCode: explicitReason };
  }
  const { safeReasonCode } = decision.failure;
  if (safeReasonCode === 'DEPENDENCY_UNAVAILABLE') {
    return { outcome: 'INDETERMINATE', retryable: true, safeReasonCode };
  }
  return { outcome: 'INDETERMINATE', retryable: false, safeReasonCode };
};

const ineligibleReason = (decision: AssortmentGovernedDecision): 'BOUNDARY_EXCLUDED' | 'RULE_DENIED' => {
  const response = responseFor(decision);
  if (response.outcome === 'INELIGIBLE' && response.safeReasonCode === 'BOUNDARY_EXCLUDED') {
    return 'BOUNDARY_EXCLUDED';
  }
  return 'RULE_DENIED';
};

const assortmentOwnerModuleId = Result.getOrThrow(
  Schema.decodeResult(AssortmentOwnerModuleIdSchema)('commerce.assortment'),
);

export const makeUnavailableAssortmentDecisionSource = (): AssortmentDecisionSourcePort => ({
  resolvePurchase: () =>
    Effect.fail(
      new AssortmentDependencyFailureError({
        code: 'DEPENDENCY_FAILURE',
        ownerModuleId: assortmentOwnerModuleId,
        retryable: true,
        safeReasonCode: 'DEPENDENCY_UNAVAILABLE',
      }),
    ),
  resolveVisibility: () =>
    Effect.fail(
      new AssortmentDependencyFailureError({
        code: 'DEPENDENCY_FAILURE',
        ownerModuleId: assortmentOwnerModuleId,
        retryable: true,
        safeReasonCode: 'DEPENDENCY_UNAVAILABLE',
      }),
    ),
});

const makeUnavailableStore = (): AssortmentDecisionEvidenceStore => ({
  persist: () =>
    Effect.fail(
      new AssortmentDependencyFailureError({
        code: 'DEPENDENCY_FAILURE',
        ownerModuleId: assortmentOwnerModuleId,
        retryable: true,
        safeReasonCode: 'DEPENDENCY_UNAVAILABLE',
      }),
    ),
});

export interface AssortmentDecisionEvaluationDependencies {
  readonly evidenceStore: AssortmentDecisionEvidenceStore;
  readonly source: AssortmentDecisionSourcePort;
}

// oxlint-disable-next-line effect-native/no-wide-factory-signature -- Owner-local Boundary/Candidate and evidence-store collaborators are explicit deployment seams; expires: 2027-09-23.
export const makeAssortmentDecisionEvaluation = (
  // oxlint-disable-next-line effect-native/no-dependency-parameters -- This explicit owner-local seam is the dependency injection boundary used by the generated read adapters; expires: 2027-09-23.
  dependencies: AssortmentDecisionEvaluationDependencies,
): AssortmentDecisionEvaluationPort => ({
  evaluatePurchase: Effect.fn('AssortmentDecisionEvaluation.evaluatePurchase')(
    function* evaluatePurchase(request, scope) {
      if (!Schema.is(AssortmentPurchaseEvaluationRequestSchema)(request)) {
        return yield* invalidRequest();
      }
      yield* validateScope(request, scope);
      const owned = yield* dependencies.source
        .resolvePurchase(request, scope)
        .pipe(Effect.catchTag('AssortmentDependencyFailureError', () => Effect.void));
      if (owned === undefined || !immutable(owned.decision) || !purchaseOwnedOutputMatches(owned, request, scope)) {
        return { decision: unavailable() };
      }
      const response = responseFor(owned.decision, owned.safeReasonCode);
      if (owned.decision.outcome === 'INDETERMINATE') {
        return { decision: response };
      }
      const references: AssortmentConsumerConstituentEvidence[] = [];
      // oxlint-disable-next-line effect-native/no-imperative-loop-in-effect-gen -- Evidence references are persisted sequentially to retain deterministic constituent order.
      for (const item of owned.constituents) {
        if (item.decision.outcome === 'INDETERMINATE') {
          return { decision: unavailable() };
        }
        const reference = yield* dependencies.evidenceStore
          .persist(item)
          .pipe(Effect.catchTag('AssortmentDependencyFailureError', () => Effect.void));
        if (reference === undefined || !Schema.is(AssortmentConsumerDecisionEvidenceReferenceTypeSchema)(reference)) {
          return { decision: unavailable() };
        }
        references.push(
          item.decision.outcome === 'ELIGIBLE'
            ? { constituent: item.constituent, decisionEvidence: reference, outcome: 'ELIGIBLE' }
            : {
                constituent: item.constituent,
                decisionEvidence: reference,
                outcome: 'INELIGIBLE',
                safeReasonCode: ineligibleReason(item.decision),
              },
        );
      }
      const consumerEvidence =
        owned.request.setComposition === undefined
          ? {
              composedOutcome: owned.decision.outcome,
              evaluatedConstituents: references,
              subject: owned.request.subject,
              topLevelConstituent: owned.request.constituent,
              trustedContext: owned.request.trustedContext,
            }
          : {
              composedOutcome: owned.decision.outcome,
              evaluatedConstituents: references,
              setComposition: owned.request.setComposition,
              subject: owned.request.subject,
              topLevelConstituent: owned.request.constituent,
              trustedContext: owned.request.trustedContext,
            };
      if (!Schema.is(AssortmentProspectivePurchaseEvidenceTypeSchema)(consumerEvidence)) {
        return { decision: unavailable() };
      }
      return { consumerEvidence, decision: response };
    },
  ),
  evaluateVisibility: Effect.fn('AssortmentDecisionEvaluation.evaluateVisibility')(
    function* evaluateVisibility(request, scope) {
      if (!Schema.is(AssortmentVisibilityEvaluationRequestSchema)(request)) {
        return yield* invalidRequest();
      }
      yield* validateScope(request, scope);
      const owned = yield* dependencies.source
        .resolveVisibility(request, scope)
        .pipe(Effect.catchTag('AssortmentDependencyFailureError', () => Effect.void));
      if (owned === undefined || !immutable(owned.decision) || !visibilityOwnedOutputMatches(owned, request, scope)) {
        return unavailable();
      }
      if (owned.decision.outcome === 'INDETERMINATE') {
        return responseFor(owned.decision, owned.safeReasonCode);
      }
      const persisted = yield* dependencies.evidenceStore
        .persist(owned)
        .pipe(Effect.catchTag('AssortmentDependencyFailureError', () => Effect.succeed(false)));
      return persisted === false ? unavailable() : responseFor(owned.decision, owned.safeReasonCode);
    },
  ),
});

export class AssortmentDecisionEvaluation extends Context.Service<
  AssortmentDecisionEvaluation,
  AssortmentDecisionEvaluationPort
>()('@app/assortment/shared/domain/ports/decision-evaluation/AssortmentDecisionEvaluation') {}

export type AssortmentDecisionEvaluationService = AssortmentDecisionEvaluationPort;

export const makeAssortmentDecisionEvaluationUnavailable = (): AssortmentDecisionEvaluationPort =>
  makeAssortmentDecisionEvaluation({
    evidenceStore: makeUnavailableStore(),
    source: makeUnavailableAssortmentDecisionSource(),
  });

export const assortmentDecisionEvaluationUnavailable = makeAssortmentDecisionEvaluationUnavailable();

export const AssortmentDecisionEvaluationUnavailableLive = Layer.succeed(
  AssortmentDecisionEvaluation,
  assortmentDecisionEvaluationUnavailable,
);
