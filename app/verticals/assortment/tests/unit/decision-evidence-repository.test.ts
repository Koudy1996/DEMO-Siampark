import type { OperationalScope } from '@app/core-runtime';
import { Effect, Option, Schema } from 'effect';
import { expect, it } from 'effect-rstest';
import {
  AssortmentDependencyFailureError,
  AssortmentGovernedDecisionSchema,
  AssortmentOwnerResourceRefSchema,
  AssortmentPurchaseRequestSchema,
} from '../../shared/domain/decision-contracts.ts';
import { AssortmentConsumerDecisionEvidenceReferenceSchema } from '../../shared/domain/consumer-evidence.ts';
import { assortmentDecisionEvidenceRepositoryFromPort } from '../../src/services/decision-evidence.repository.ts';
import type {
  AssortmentDecisionEvidenceInsert,
  AssortmentDecisionEvidencePersistencePort,
  AssortmentDecisionEvidenceRow,
} from '../../src/services/decision-evidence.repository.ts';

const tenantId = '018f8b4e-35a2-7b51-8d56-91a4f37d6a11';
const legalEntityId = '018f8b4e-35a2-7b51-8d56-91a4f37d6a12';
const scope = {
  authContextRef: 'decision-evidence-repository-test',
  authMethod: 'session',
  correlationId: 'decision-evidence-repository-test',
  legalEntityId,
  principalId: '018f8b4e-35a2-7b51-8d56-91a4f37d6a13',
  tenantId,
} satisfies OperationalScope;

const ref = (moduleId: string, resourceType: string, resourceId: string, nextTenantId = tenantId) =>
  Schema.decodeUnknownSync(AssortmentOwnerResourceRefSchema)({
    moduleId,
    resourceId,
    resourceType,
    tenantId: nextTenantId,
  });

const request = Schema.decodeUnknownSync(AssortmentPurchaseRequestSchema)({
  constituent: {
    catalogSelection: {
      configuration: { kind: 'NONE' },
      productRef: ref('catalog.owner', 'catalog.product', 'product-1'),
      variantKind: 'ATOMIC',
      variantRef: ref('catalog.owner', 'catalog.variant', 'variant-1'),
    },
    role: 'TOP_LEVEL',
  },
  decisionPurpose: 'PURCHASE',
  subject: {
    kind: 'IDENTIFIED',
    subject: {
      kind: 'RETAIL_CUSTOMER_PROFILE',
      profileRef: ref('commerce.customer-context', 'commerce.customer-context.retail-customer-profile', 'profile-1'),
    },
  },
  trustedContext: {
    channelRef: ref('commerce.channel', 'commerce.channel.channel', 'web'),
    operationTime: '2026-09-23T10:00:00.000Z',
    sellingLegalEntityRef: ref('commerce.legal-entity', 'commerce.legal-entity.selling-legal-entity', legalEntityId),
    tenantId,
  },
});

const decision = Schema.decodeUnknownSync(AssortmentGovernedDecisionSchema)({
  evidence: {
    factCurrentness: [],
    operationTime: '2026-09-23T10:00:00.000Z',
    setCompleteness: [],
    subject: request.subject,
    target: { kind: 'CATALOG_SELECTION', selection: request.constituent.catalogSelection },
    trustedContext: { ...request.trustedContext, operationTime: '2026-09-23T10:00:00.000Z' },
  },
  outcome: 'ELIGIBLE',
});

const storedInput = { constituent: request.constituent, decision, request };
const referenceId = '018f8b4e-35a2-7b51-8d56-91a4f37d6a14';
type EvidenceLookup = Readonly<{ readonly id: string; readonly legalEntityId: string; readonly tenantId: string }>;
interface InsertCapture {
  value?: AssortmentDecisionEvidenceInsert;
}

const persistenceFailure = () =>
  new AssortmentDependencyFailureError({
    code: 'DEPENDENCY_FAILURE',
    ownerModuleId: Schema.decodeUnknownSync(AssortmentOwnerResourceRefSchema)(
      ref('commerce.assortment', 'commerce.assortment.decision-evidence', referenceId),
    ).moduleId,
    retryable: true,
    safeReasonCode: 'DEPENDENCY_UNAVAILABLE',
  });

const persistencePort = (options?: {
  readonly inserted?: InsertCapture;
  readonly queries?: EvidenceLookup[];
  readonly selected?: readonly AssortmentDecisionEvidenceRow[];
  readonly selectFailure?: Error;
}): AssortmentDecisionEvidencePersistencePort => ({
  find: (query) => {
    options?.queries?.push(query);
    return options?.selectFailure === undefined
      ? Effect.succeed(options?.selected ?? [])
      : Effect.fail(persistenceFailure());
  },
  insert: (value) => {
    if (options?.inserted !== undefined) {
      options.inserted.value = value;
    }
    return Effect.succeed(Option.some(referenceId));
  },
});

const repositoryFor = (options?: Parameters<typeof persistencePort>[0]) =>
  assortmentDecisionEvidenceRepositoryFromPort(persistencePort(options), scope);

it.effect('persists validated evidence and resolves the exact tenant/legal-entity reference', () =>
  Effect.gen(function* persistsAndResolves() {
    const inserted: InsertCapture = {};
    const repository = repositoryFor({ inserted });
    const reference = yield* repository.persist(storedInput);
    expect(Schema.is(AssortmentConsumerDecisionEvidenceReferenceSchema)(reference)).toBe(true);
    const row = inserted.value;
    if (row === undefined) {
      throw new Error('expected the persistence port to capture inserted evidence');
    }
    const queries: EvidenceLookup[] = [];
    const resolved = yield* repositoryFor({ queries, selected: [{ ...row, decisionEvidenceId: referenceId }] }).resolve(
      reference.evidenceRef,
    );
    expect(queries).toEqual([{ id: referenceId, legalEntityId, tenantId }]);
    expect(resolved.request).toEqual(request);
    expect(resolved.evidence).toEqual(decision.evidence);
  }),
);

it.effect('fails closed for wrong reference scope, missing rows, database failures, and tampered evidence', () =>
  Effect.gen(function* failsClosed() {
    const persistenceRepository = repositoryFor();
    const foreign = {
      ...ref(
        'commerce.assortment',
        'commerce.assortment.decision-evidence',
        referenceId,
        '90000000-0000-4000-8000-000000000009',
      ),
    };
    expect(
      Schema.is(AssortmentDependencyFailureError)(yield* Effect.flip(persistenceRepository.resolve(foreign))),
    ).toBe(true);
    expect(
      Schema.is(AssortmentDependencyFailureError)(
        yield* Effect.flip(
          repositoryFor().resolve(ref('commerce.assortment', 'commerce.assortment.decision-evidence', referenceId)),
        ),
      ),
    ).toBe(true);

    const dbFailure = repositoryFor({ selectFailure: new Error('database unavailable') });
    expect(
      Schema.is(AssortmentDependencyFailureError)(
        yield* Effect.flip(
          dbFailure.resolve(ref('commerce.assortment', 'commerce.assortment.decision-evidence', referenceId)),
        ),
      ),
    ).toBe(true);

    const tampered = {
      decisionEvidenceId: referenceId,
      decisionJson: {},
      legalEntityId,
      outcome: 'INELIGIBLE',
      requestFingerprint: '0'.repeat(64),
      requestJson: {},
      tenantId,
    };
    expect(
      Schema.is(AssortmentDependencyFailureError)(
        yield* Effect.flip(
          repositoryFor({ selected: [tampered] }).resolve(
            ref('commerce.assortment', 'commerce.assortment.decision-evidence', referenceId),
          ),
        ),
      ),
    ).toBe(true);
  }),
);
