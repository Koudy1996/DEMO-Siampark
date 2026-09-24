import { Effect, Schema } from 'effect';
import { expect, it } from 'effect-rstest';

import {
  AssortmentDiscoveryDisclosureContextSchema,
  AssortmentDiscoveryDisclosureCoverageSchema,
  AssortmentDiscoveryDisclosureEquivalenceSchema,
  AssortmentDiscoveryDisclosureInvalidationSchema,
  AssortmentDiscoveryDisclosureInclusionDecisionSchema,
} from '../../shared/domain/disclosure-contracts.ts';
import { AssortmentOwnerResourceRefSchema, CatalogProductRefSchema } from '../../shared/domain/decision-contracts.ts';
import {
  AssortmentSearchProjectionEntrySchema,
  AssortmentSearchProjectionStateSchema,
} from '../../shared/domain/search-projection.ts';
import {
  applyAssortmentSearchProjectionInvalidation,
  checkAssortmentSearchProjectionInclusion,
  evaluateAssortmentSearchProjection,
  recheckAssortmentSearchDetailVisibility,
  AssortmentSearchDetailVisibilityRecheckUnavailableError,
  rebuildAssortmentSearchProjection,
} from '../../src/services/assortment-search-projection.service.ts';
import {
  AssortmentDecisionRequestInvalidError,
  AssortmentVisibilityEvaluationRequestSchema,
} from '../../shared/domain/ports/decision-evaluation.ts';
import type { AssortmentDecisionEvaluationPort } from '../../shared/domain/ports/decision-evaluation.ts';

const tenantId = '018f8b4e-35a2-7b51-8d56-91a4f37d6a11';
const operationTime = '2026-09-22T10:00:00.000Z';

const ref = (moduleId: string, resourceType: string, resourceId: string, nextTenantId = tenantId) =>
  Schema.decodeUnknownSync(AssortmentOwnerResourceRefSchema)({
    moduleId,
    resourceId,
    resourceType,
    tenantId: nextTenantId,
  });

const product = (resourceId: string) =>
  Schema.decodeUnknownSync(CatalogProductRefSchema)({
    moduleId: 'catalog.owner',
    resourceId,
    resourceType: 'catalog.product',
    tenantId,
  });

const context = (profileId: string) =>
  Schema.decodeUnknownSync(AssortmentDiscoveryDisclosureContextSchema)({
    decisionPurpose: 'VISIBILITY',
    subject: {
      kind: 'IDENTIFIED',
      subject: {
        kind: 'RETAIL_CUSTOMER_PROFILE',
        profileRef: ref('commerce.customer-context', 'commerce.customer-context.retail-customer-profile', profileId),
      },
    },
    trustedContext: {
      channelRef: ref('commerce.channel', 'commerce.channel', 'web'),
      operationTime,
      sellingLegalEntityRef: ref('commerce.legal-entity', 'commerce.legal-entity', 'sle-1'),
      tenantId,
    },
  });

const guestContext = () =>
  Schema.decodeUnknownSync(AssortmentDiscoveryDisclosureContextSchema)({
    decisionPurpose: 'VISIBILITY',
    subject: {
      guestEvidence: {
        evidenceRef: ref('commerce.guest-context', 'commerce.guest-context.evidence', 'guest-1'),
        ownerModuleId: 'commerce.guest-context',
        sourceRevision: {
          ownerModuleId: 'commerce.guest-context',
          revision: '1',
          sourceRef: ref('commerce.guest-context', 'commerce.guest-context.revision', 'revision-1'),
        },
      },
      kind: 'GUEST_PURCHASE_CONTEXT',
    },
    trustedContext: {
      channelRef: ref('commerce.channel', 'commerce.channel', 'web'),
      operationTime,
      sellingLegalEntityRef: ref('commerce.legal-entity', 'commerce.legal-entity', 'sle-1'),
      tenantId,
    },
  });

const coverage = (
  value: ReturnType<typeof context>,
  productRef: ReturnType<typeof product>,
  state: 'ESTABLISHED' | 'INVALIDATED' = 'ESTABLISHED',
) =>
  Schema.decodeUnknownSync(AssortmentDiscoveryDisclosureCoverageSchema)({
    context: Schema.encodeSync(AssortmentDiscoveryDisclosureContextSchema)(value),
    productRef,
    proof: {
      evidenceRef: ref('commerce.assortment', 'commerce.assortment.discovery-proof', `${productRef.resourceId}-proof`),
      ownerModuleId: 'commerce.assortment',
    },
    state,
  });

const entry = (
  value: ReturnType<typeof context>,
  productRef: ReturnType<typeof product>,
  verification: 'ESTABLISHED' | 'STALE' | 'UNCERTAIN' | 'UNVERIFIABLE' | 'INVALIDATED' = 'ESTABLISHED',
) =>
  Schema.decodeUnknownSync(AssortmentSearchProjectionEntrySchema)({
    context: Schema.encodeSync(AssortmentDiscoveryDisclosureContextSchema)(value),
    coverage: Schema.encodeSync(AssortmentDiscoveryDisclosureCoverageSchema)(
      coverage(value, productRef, verification === 'INVALIDATED' ? 'INVALIDATED' : 'ESTABLISHED'),
    ),
    productRef,
    verification,
  });

const run = <Value, Failure>(effect: Effect.Effect<Value, Failure>) =>
  // oxlint-disable-next-line effect-native/no-effect-run-in-tests
  Effect.runSync(effect);

it('rebuilds deterministic exact-context state and rejects duplicate slices', () => {
  const value = context('profile-1');
  const first = entry(value, product('product-b'));
  const second = entry(value, product('product-a'));
  const rebuilt = run(rebuildAssortmentSearchProjection([first, second]));
  expect(rebuilt.entries.map((item: (typeof rebuilt.entries)[number]) => item.productRef.resourceId)).toEqual([
    'product-a',
    'product-b',
  ]);

  expect(() => run(rebuildAssortmentSearchProjection([first, first]))).toThrow();
  const encoded = Schema.encodeSync(AssortmentSearchProjectionStateSchema)(rebuilt);
  expect('eventOffset' in encoded).toBe(false);
  expect('ttl' in encoded).toBe(false);
  expect('indexComplete' in encoded).toBe(false);
  expect(() =>
    Schema.decodeUnknownSync(AssortmentSearchProjectionStateSchema, { onExcessProperty: 'error' })({
      ...encoded,
      eventOffset: 10,
      ttl: 60,
    }),
  ).toThrow();
});

it('includes only an established exact slice and omits unsafe states or scope mismatches', () => {
  const requested = context('profile-1');
  const exactProduct = product('product-1');
  for (const verification of ['STALE', 'UNCERTAIN', 'UNVERIFIABLE', 'INVALIDATED'] as const) {
    const decision = run(
      checkAssortmentSearchProjectionInclusion({
        context: requested,
        entry: entry(requested, exactProduct, verification),
        productRef: exactProduct,
      }),
    );
    expect(decision.decision).toBe('OMIT');
  }

  const included = run(
    checkAssortmentSearchProjectionInclusion({
      context: requested,
      entry: entry(requested, exactProduct),
      productRef: exactProduct,
    }),
  );
  expect(included.decision).toBe('INCLUDE');
  expect(() =>
    Schema.decodeUnknownSync(AssortmentDiscoveryDisclosureInclusionDecisionSchema)(
      Schema.encodeSync(AssortmentDiscoveryDisclosureInclusionDecisionSchema)(included),
    ),
  ).not.toThrow();

  const wrongContext = run(
    checkAssortmentSearchProjectionInclusion({
      context: requested,
      entry: entry(context('profile-2'), exactProduct),
      productRef: exactProduct,
    }),
  );
  expect(wrongContext.decision).toBe('OMIT');

  const missing = run(checkAssortmentSearchProjectionInclusion({ context: requested, productRef: product('missing') }));
  expect(missing.decision).toBe('OMIT');
});

it('requires explicit Assortment equivalence before reusing a broader projection slice', () => {
  const source = context('profile-1');
  const target = context('profile-2');
  const productRef = product('product-1');
  const sourceEntry = entry(source, productRef);
  const equivalence = Schema.decodeUnknownSync(AssortmentDiscoveryDisclosureEquivalenceSchema)({
    kind: 'ASSORTMENT_PROVEN_CONTEXT_EQUIVALENCE',
    productRef,
    proof: {
      evidenceRef: ref('commerce.assortment', 'commerce.assortment.discovery-proof', 'equivalence-proof'),
      ownerModuleId: 'commerce.assortment',
    },
    source: Schema.encodeSync(AssortmentDiscoveryDisclosureContextSchema)(source),
    target: Schema.encodeSync(AssortmentDiscoveryDisclosureContextSchema)(target),
  });

  const withoutEquivalence = run(
    checkAssortmentSearchProjectionInclusion({ context: target, entry: sourceEntry, productRef }),
  );
  expect(withoutEquivalence.decision).toBe('OMIT');

  const withEquivalence = run(
    checkAssortmentSearchProjectionInclusion({
      context: target,
      entry: sourceEntry,
      equivalence,
      productRef,
    }),
  );
  expect(withEquivalence.decision).toBe('INCLUDE');

  const staleSource = run(
    checkAssortmentSearchProjectionInclusion({
      context: target,
      entry: entry(source, productRef, 'STALE'),
      equivalence,
      productRef,
    }),
  );
  expect(staleSource.decision).toBe('OMIT');
});

it('does not let a Guest slice refill an identified context without exact equivalence', () => {
  const source = guestContext();
  const target = context('profile-2');
  const productRef = product('product-guest');
  const sourceEntry = entry(source, productRef);
  const withoutEquivalence = run(
    checkAssortmentSearchProjectionInclusion({ context: target, entry: sourceEntry, productRef }),
  );
  expect(withoutEquivalence.decision).toBe('OMIT');

  const equivalence = Schema.decodeUnknownSync(AssortmentDiscoveryDisclosureEquivalenceSchema)({
    kind: 'ASSORTMENT_PROVEN_CONTEXT_EQUIVALENCE',
    productRef,
    proof: {
      evidenceRef: ref('commerce.assortment', 'commerce.assortment.discovery-proof', 'guest-equivalence-proof'),
      ownerModuleId: 'commerce.assortment',
    },
    source: Schema.encodeSync(AssortmentDiscoveryDisclosureContextSchema)(source),
    target: Schema.encodeSync(AssortmentDiscoveryDisclosureContextSchema)(target),
  });
  expect(
    run(checkAssortmentSearchProjectionInclusion({ context: target, entry: sourceEntry, equivalence, productRef }))
      .decision,
  ).toBe('INCLUDE');

  const wrongProductEquivalence = Schema.decodeUnknownSync(AssortmentDiscoveryDisclosureEquivalenceSchema)({
    ...Schema.encodeSync(AssortmentDiscoveryDisclosureEquivalenceSchema)(equivalence),
    productRef: product('different-product'),
  });
  expect(
    run(
      checkAssortmentSearchProjectionInclusion({
        context: target,
        entry: sourceEntry,
        equivalence: wrongProductEquivalence,
        productRef,
      }),
    ).decision,
  ).toBe('OMIT');
  expect(() =>
    Schema.decodeUnknownSync(AssortmentDiscoveryDisclosureEquivalenceSchema)({
      ...Schema.encodeSync(AssortmentDiscoveryDisclosureEquivalenceSchema)(equivalence),
      productRef: product('foreign-product'),
      proof: {
        ...equivalence.proof,
        evidenceRef: ref(
          'commerce.assortment',
          'commerce.assortment.discovery-proof',
          'foreign-proof',
          'foreign-tenant',
        ),
      },
    }),
  ).toThrow();
});

it('stops an invalidated exact slice until replacement coverage is rebuilt', () => {
  const value = context('profile-1');
  const productRef = product('product-1');
  const state = run(rebuildAssortmentSearchProjection([entry(value, productRef)]));
  const invalidation = Schema.decodeUnknownSync(AssortmentDiscoveryDisclosureInvalidationSchema)({
    context: Schema.encodeSync(AssortmentDiscoveryDisclosureContextSchema)(value),
    productRef,
    proof: {
      evidenceRef: ref('commerce.assortment', 'commerce.assortment.discovery-proof', `${productRef.resourceId}-proof`),
      ownerModuleId: 'commerce.assortment',
    },
    state: 'INVALIDATED',
  });
  const invalidated = run(applyAssortmentSearchProjectionInvalidation(state, invalidation));
  expect(invalidated.entries[0]?.verification).toBe('INVALIDATED');
  expect(
    run(
      evaluateAssortmentSearchProjection({
        context: value,
        productRefs: [productRef],
        state: invalidated,
      }),
    )[0]?.decision,
  ).toBe('OMIT');

  const rebuilt = run(rebuildAssortmentSearchProjection([entry(value, productRef)]));
  expect(
    run(
      evaluateAssortmentSearchProjection({
        context: value,
        productRefs: [productRef],
        state: rebuilt,
      }),
    )[0]?.decision,
  ).toBe('INCLUDE');
});

it('keeps cross-context entries isolated in batch evaluation', () => {
  const source = context('profile-1');
  const target = context('profile-2');
  const productRef = product('product-1');
  const state = run(rebuildAssortmentSearchProjection([entry(source, productRef)]));
  const decisions = run(evaluateAssortmentSearchProjection({ context: target, productRefs: [productRef], state }));
  expect(decisions[0]?.decision).toBe('OMIT');
});

it.effect('requires an authoritative detail recheck and fails closed on port failure', () =>
  Effect.gen(function* detailRecheck() {
    const request = Schema.decodeUnknownSync(AssortmentVisibilityEvaluationRequestSchema)({
      decisionPurpose: 'VISIBILITY',
      productRef: product('product-1'),
      subject: context('profile-1').subject,
      trustedContextRef: ref('commerce.assortment', 'commerce.assortment.trusted-context', 'context-1'),
    });
    const scope = {
      correlationId: 'detail-test',
      legalEntityId: 'sle-1',
      principalId: 'principal-1',
      tenantId,
    };
    const ineligible: AssortmentDecisionEvaluationPort = {
      evaluatePurchase: () => Effect.die('unused'),
      evaluateVisibility: () =>
        Effect.succeed({ outcome: 'INELIGIBLE', retryable: false, safeReasonCode: 'RULE_DENIED' }),
    };
    const included = yield* recheckAssortmentSearchDetailVisibility({ evaluation: ineligible, request, scope });
    expect(included).toEqual({
      decision: 'OMIT_DETAIL',
    });

    const unavailable: AssortmentDecisionEvaluationPort = {
      evaluatePurchase: () => Effect.die('unused'),
      evaluateVisibility: () =>
        Effect.fail(
          new AssortmentDecisionRequestInvalidError({ code: 'INVALID_DECISION_REQUEST', reason: 'INVALID_INPUT' }),
        ),
    };
    const failure = yield* recheckAssortmentSearchDetailVisibility({ evaluation: unavailable, request, scope }).pipe(
      Effect.flip,
    );
    expect(failure).toBeInstanceOf(AssortmentSearchDetailVisibilityRecheckUnavailableError);
  }),
);
