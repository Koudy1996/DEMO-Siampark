/* oxlint-disable anti-slop/no-chained-type-assertions, anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type, anti-slop/require-safety-comment-for-type-assertion, typescript/no-unsafe-type-assertion -- The fake fluent Drizzle query builder models only this repository's scoped insert/select seam; expires: 2027-09-23. */
import type { OperationalScope, ScopedTransactionExecutor } from '@app/core-runtime';
import { Effect, Schema } from 'effect';
import { expect, it } from 'effect-rstest';
import {
  AssortmentDependencyFailureError,
  AssortmentGovernedDecisionSchema,
  AssortmentOwnerResourceRefSchema,
  AssortmentPurchaseRequestSchema,
} from '../../shared/domain/decision-contracts.ts';
import { AssortmentConsumerDecisionEvidenceReferenceSchema } from '../../shared/domain/consumer-evidence.ts';
import { assortmentDecisionEvidenceRepositoryForScope } from '../../src/services/decision-evidence.repository.ts';

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
interface InsertCapture {
  value?: Record<string, unknown>;
}

type QueryRows = readonly object[];
type FakeQuery = Effect.Effect<QueryRows, unknown> & {
  from: () => FakeQuery;
  limit: () => FakeQuery;
  returning: () => FakeQuery;
  values: (value: Record<string, unknown>) => FakeQuery;
  where: () => FakeQuery;
};

const fakeTransaction = (options?: {
  readonly inserted?: { value?: Record<string, unknown> };
  readonly insertFailure?: unknown;
  readonly selected?: QueryRows;
  readonly selectFailure?: unknown;
}) => {
  const makeQuery = (rows: QueryRows, failure?: unknown): FakeQuery => {
    const base = failure === undefined ? Effect.succeed(rows) : Effect.fail(failure);
    const query = base as unknown as FakeQuery;
    query.from = () => query;
    query.limit = () => query;
    query.returning = () => query;
    query.values = (value) => {
      if (options?.inserted !== undefined) {
        options.inserted.value = value;
      }
      return query;
    };
    query.where = () => query;
    return query;
  };
  return {
    insert: () => makeQuery([{ decisionEvidenceId: referenceId }], options?.insertFailure),
    select: () => makeQuery(options?.selected ?? [], options?.selectFailure),
  } as unknown as ScopedTransactionExecutor;
};

it.effect('persists validated evidence and resolves the exact tenant/legal-entity reference', () =>
  Effect.gen(function* persistsAndResolves() {
    const inserted: InsertCapture = {};
    const repository = assortmentDecisionEvidenceRepositoryForScope(fakeTransaction({ inserted }), scope);
    const reference = yield* repository.persist(storedInput);
    expect(Schema.is(AssortmentConsumerDecisionEvidenceReferenceSchema)(reference)).toBe(true);
    const row = inserted.value;
    const resolved = yield* assortmentDecisionEvidenceRepositoryForScope(
      fakeTransaction({ selected: [{ ...row, decisionEvidenceId: referenceId }] }),
      scope,
    ).resolve(reference.evidenceRef);
    expect(resolved.request).toEqual(request);
    expect(resolved.evidence).toEqual(decision.evidence);
  }),
);

it.effect('fails closed for wrong reference scope, missing rows, database failures, and tampered evidence', () =>
  Effect.gen(function* failsClosed() {
    const repository = assortmentDecisionEvidenceRepositoryForScope(fakeTransaction(), scope);
    const foreign = {
      ...ref(
        'commerce.assortment',
        'commerce.assortment.decision-evidence',
        referenceId,
        '90000000-0000-4000-8000-000000000009',
      ),
    };
    expect(Schema.is(AssortmentDependencyFailureError)(yield* Effect.flip(repository.resolve(foreign)))).toBe(true);
    expect(
      Schema.is(AssortmentDependencyFailureError)(
        yield* Effect.flip(
          assortmentDecisionEvidenceRepositoryForScope(fakeTransaction(), scope).resolve(
            ref('commerce.assortment', 'commerce.assortment.decision-evidence', referenceId),
          ),
        ),
      ),
    ).toBe(true);

    const dbFailure = assortmentDecisionEvidenceRepositoryForScope(
      fakeTransaction({ selectFailure: new Error('database unavailable') }),
      scope,
    );
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
          assortmentDecisionEvidenceRepositoryForScope(fakeTransaction({ selected: [tampered] }), scope).resolve(
            ref('commerce.assortment', 'commerce.assortment.decision-evidence', referenceId),
          ),
        ),
      ),
    ).toBe(true);
  }),
);
