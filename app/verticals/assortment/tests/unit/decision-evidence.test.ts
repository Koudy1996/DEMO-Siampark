import { expect, it } from 'effect-rstest';
import { Effect, Schema } from 'effect';

import {
  AssortmentCandidateSchema,
  AssortmentCatalogSelectionSchema,
  AssortmentDecisionEvidenceSchema,
  AssortmentOwnerResourceRefSchema,
  AssortmentPurchaseRequestSchema,
  AssortmentSetPurchaseCompositionSchema,
  AssortmentVisibilityRequestSchema,
} from '../../shared/domain/decision-contracts.ts';
import {
  AssortmentDecisionEvidenceConstructionError,
  AssortmentSuccessfulAttemptDecisionEvidenceSchema,
  constructAssortmentSuccessfulAttemptEvidence,
} from '../../shared/domain/decision-evidence.ts';
import { AssortmentSetCompositionResolutionSchema } from '../../shared/domain/ports/owner-evidence.ts';
import type { AssortmentCatalogSelection } from '../../shared/domain/decision-contracts.ts';

const tenantId = '018f8b4e-35a2-7b51-8d56-91a4f37d6a11';
const otherTenantId = '018f8b4e-35a2-7b51-8d56-91a4f37d6a22';
const operationTime = '2026-09-22T10:00:00.000Z';

const ref = (moduleId: string, resourceType: string, resourceId: string, nextTenantId = tenantId) =>
  Schema.decodeUnknownSync(AssortmentOwnerResourceRefSchema)({
    moduleId,
    resourceId,
    resourceType,
    tenantId: nextTenantId,
  });

const ownerRevision = (sourceRef: ReturnType<typeof ref>, revision = 'r1') => ({
  ownerModuleId: sourceRef.moduleId,
  revision,
  sourceRef,
});

const context = {
  channelRef: ref('commerce.channel', 'commerce.channel.channel', 'web'),
  operationTime,
  sellingLegalEntityRef: ref('commerce.legal-entity', 'commerce.legal-entity.selling-legal-entity', 'sle-1'),
  tenantId,
};

const subject = {
  kind: 'IDENTIFIED' as const,
  subject: {
    kind: 'RETAIL_CUSTOMER_PROFILE' as const,
    profileRef: ref('commerce.customer-context', 'commerce.customer-context.retail-customer-profile', 'profile-1'),
  },
};

const productRef = ref('catalog.owner', 'catalog.product', 'product-1');
const variantRef = ref('catalog.owner', 'catalog.variant', 'variant-1');
const bindingRef = ref('commerce.assortment', 'commerce.assortment.applicability-binding', 'binding-1');
const ruleRevisionRef = ref('commerce.assortment', 'commerce.assortment.rule-revision', 'revision-1');
const stableRuleRef = ref('commerce.assortment', 'commerce.assortment.stable-rule', 'rule-1');

const atomicSelection = productRef;

const purchaseSelection = Schema.decodeUnknownSync(AssortmentCatalogSelectionSchema)({
  configuration: { kind: 'NONE' as const },
  productRef,
  variantKind: 'ATOMIC' as const,
  variantRef,
});

const candidate = (
  nextBindingRef = bindingRef,
  nextRuleRef = ruleRevisionRef,
  nextSelection: AssortmentCatalogSelection = purchaseSelection,
) =>
  Schema.decodeUnknownSync(AssortmentCandidateSchema)({
    audience: { kind: 'SHARED' },
    bindingRef: nextBindingRef,
    commercialScope: {
      channelRef: context.channelRef,
      sellingLegalEntityRef: context.sellingLegalEntityRef,
    },
    decisionPurpose: 'PURCHASE',
    effect: 'ALLOW',
    ruleRevision: ownerRevision(nextRuleRef),
    selector: { kind: 'VARIANT', variantRef: nextSelection.variantRef },
    stableRuleRef,
  });

const proof = (resourceId: string) => ({
  evidenceRef: ref('commerce.assortment', 'commerce.assortment.evidence', resourceId),
  ownerModuleId: 'commerce.assortment',
});

const completeness = {
  predicate: 'all current Candidate-producing bindings and immutable revisions for this exact decision',
  proof: proof('completeness-1'),
  scope: 'commerce.assortment.ordinary-candidates',
  state: 'COMPLETE' as const,
};

const evidenceFor = (
  target:
    | { readonly kind: 'PRODUCT'; readonly productRef: ReturnType<typeof ref> }
    | { readonly kind: 'CATALOG_SELECTION'; readonly selection: AssortmentCatalogSelection },
  nextCandidate = candidate(),
  nextBindingRef = bindingRef,
  nextRuleRef = ruleRevisionRef,
) =>
  Schema.decodeUnknownSync(AssortmentDecisionEvidenceSchema)({
    candidates: [nextCandidate],
    factCurrentness: [
      { factRef: nextBindingRef, proof: proof('binding-current-1'), state: 'CURRENT' },
      { factRef: nextRuleRef, proof: proof('revision-current-1'), state: 'CURRENT' },
    ],
    operationTime,
    setCompleteness: [completeness],
    subject,
    target,
    trustedContext: context,
  });

const visibilityInput = () => {
  const request = Schema.decodeUnknownSync(AssortmentVisibilityRequestSchema)({
    decisionPurpose: 'VISIBILITY',
    productRef: atomicSelection,
    subject,
    trustedContext: context,
  });
  const visibilityCandidate = Schema.decodeUnknownSync(AssortmentCandidateSchema)({
    ...candidate(),
    decisionPurpose: 'VISIBILITY',
    selector: { kind: 'PRODUCT', productRef: atomicSelection },
  });
  const evidence = evidenceFor({ kind: 'PRODUCT', productRef: atomicSelection }, visibilityCandidate);
  return Schema.decodeUnknownSync(Schema.toType(AssortmentSuccessfulAttemptDecisionEvidenceSchema))({
    decision: { evidence, outcome: 'ELIGIBLE' },
    request,
  });
};

const run = (input: ReturnType<typeof visibilityInput>) => constructAssortmentSuccessfulAttemptEvidence(input);

it.effect('constructs deterministic immutable owner-local evidence without exposing a public projection', () =>
  Effect.gen(function* deterministicEvidence() {
    const first = yield* run(visibilityInput());
    const second = yield* run(visibilityInput());

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.decision.evidence)).toBe(true);
    expect(Object.isFrozen(first.decision.evidence.candidates)).toBe(true);
    expect(Object.isFrozen(first.request.trustedContext)).toBe(true);
    expect(() => Object.assign(first.request.trustedContext, { tenantId: otherTenantId })).toThrow();
  }),
);

it.effect('rejects cross-tenant, incomplete, and indeterminate evidence', () =>
  Effect.gen(function* rejectsInvalidEvidence() {
    const valid = visibilityInput();
    const crossTenantBinding = ref(
      'commerce.assortment',
      'commerce.assortment.applicability-binding',
      'binding-cross-tenant',
      otherTenantId,
    );
    const crossTenantCandidate = Schema.decodeUnknownSync(AssortmentCandidateSchema)({
      ...candidate(crossTenantBinding),
      decisionPurpose: 'VISIBILITY',
      selector: { kind: 'PRODUCT', productRef: atomicSelection },
    });
    const crossTenant = {
      ...valid,
      decision: {
        ...valid.decision,
        evidence: evidenceFor(
          { kind: 'PRODUCT', productRef: atomicSelection },
          crossTenantCandidate,
          crossTenantBinding,
        ),
      },
    };
    const crossTenantError = yield* Effect.flip(run(crossTenant));
    expect(crossTenantError).toBeInstanceOf(AssortmentDecisionEvidenceConstructionError);

    const missingProof = {
      ...valid,
      decision: {
        ...valid.decision,
        evidence: { ...valid.decision.evidence, setCompleteness: [] },
      },
    };
    const missingProofError = yield* Effect.flip(run(missingProof));
    expect(missingProofError).toBeInstanceOf(AssortmentDecisionEvidenceConstructionError);

    const indeterminate = { ...valid, decision: { outcome: 'INDETERMINATE' } };
    expect(Schema.is(AssortmentSuccessfulAttemptDecisionEvidenceSchema)(indeterminate)).toBe(false);
  }),
);

it.effect('requires the exact pinned Set composition and preserves only evaluated constituents', () =>
  Effect.gen(function* validatesSetEvidence() {
    const topLevelSelection = Schema.decodeUnknownSync(AssortmentCatalogSelectionSchema)({
      configuration: { kind: 'NONE' as const },
      productRef,
      setCompositionRevision: ownerRevision(ref('catalog.owner', 'catalog.set-composition-revision', 'composition-1')),
      variantKind: 'SET' as const,
      variantRef,
    });
    if (topLevelSelection.variantKind !== 'SET') {
      return;
    }
    const componentSelection = Schema.decodeUnknownSync(AssortmentCatalogSelectionSchema)({
      configuration: { kind: 'NONE' as const },
      productRef: ref('catalog.owner', 'catalog.product', 'component-1'),
      variantKind: 'ATOMIC' as const,
      variantRef: ref('catalog.owner', 'catalog.variant', 'component-variant-1'),
    });
    const setComposition = Schema.decodeUnknownSync(AssortmentSetPurchaseCompositionSchema)({
      requiredComponents: [{ catalogSelection: componentSelection, role: 'REQUIRED_COMPONENT' }],
      setCompositionRevision: topLevelSelection.setCompositionRevision,
    });
    const [component] = setComposition.requiredComponents;
    if (component === undefined) {
      return;
    }
    const request = Schema.decodeUnknownSync(AssortmentPurchaseRequestSchema)({
      constituent: { catalogSelection: topLevelSelection, role: 'TOP_LEVEL' },
      decisionPurpose: 'PURCHASE',
      setComposition,
      subject,
      trustedContext: context,
    });
    const topLevelCandidate = candidate(bindingRef, ruleRevisionRef, topLevelSelection);
    const componentBindingRef = ref(
      'commerce.assortment',
      'commerce.assortment.applicability-binding',
      'binding-component',
    );
    const componentRuleRevisionRef = ref(
      'commerce.assortment',
      'commerce.assortment.rule-revision',
      'revision-component',
    );
    const componentCandidate = candidate(componentBindingRef, componentRuleRevisionRef, componentSelection);
    const topDecision = {
      evidence: evidenceFor({ kind: 'CATALOG_SELECTION', selection: topLevelSelection }, topLevelCandidate),
      outcome: 'ELIGIBLE' as const,
    };
    const componentDecision = {
      evidence: evidenceFor(
        { kind: 'CATALOG_SELECTION', selection: componentSelection },
        componentCandidate,
        componentBindingRef,
        componentRuleRevisionRef,
      ),
      outcome: 'ELIGIBLE' as const,
    };
    const compositionSource = Schema.decodeUnknownSync(AssortmentSetCompositionResolutionSchema)({
      composition: setComposition,
      source: {
        evidenceRef: ref('catalog.owner', 'catalog.set-composition-evidence', 'composition-proof'),
        ownerModuleId: 'catalog.owner',
      },
    });
    const setResolution = {
      evidence: {
        composition: setComposition,
        compositionSource,
        evaluated: [
          { constituent: request.constituent, decision: topDecision },
          { constituent: component, decision: componentDecision },
        ],
      },
      kind: 'ELIGIBLE' as const,
    };
    const valid = Schema.decodeUnknownSync(Schema.toType(AssortmentSuccessfulAttemptDecisionEvidenceSchema))({
      decision: topDecision,
      request,
      setResolution,
    });
    const accepted = yield* constructAssortmentSuccessfulAttemptEvidence(valid);
    const acceptedResolution = accepted.setResolution;
    expect(
      acceptedResolution !== undefined && 'evidence' in acceptedResolution ? acceptedResolution.evidence.evaluated : [],
    ).toHaveLength(2);

    const fabricated = {
      ...valid,
      setResolution: {
        ...setResolution,
        evidence: {
          ...setResolution.evidence,
          evaluated: [...setResolution.evidence.evaluated, { constituent: component, decision: componentDecision }],
        },
      },
    };
    const fabricatedError = yield* Effect.flip(constructAssortmentSuccessfulAttemptEvidence(fabricated));
    expect(fabricatedError).toBeInstanceOf(AssortmentDecisionEvidenceConstructionError);
  }),
);
