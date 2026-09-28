import { randomUUID } from 'node:crypto';

import type { OperationalScope, ScopedTransactionExecutor } from '@app/core-runtime';
import { DateTime, Effect, Result, Schema } from 'effect';
import { expect, it } from 'effect-rstest';

import {
  makeTestDatabaseFromPool,
  testDatabasePools,
} from '../../../../packages/core-runtime/tests/support/database.ts';
import { installOperationalScope } from '../../../../packages/core-runtime/src/db/scoped-transaction.ts';
import { coreRelations } from '../../../../packages/core-runtime/src/db/schema.ts';
import {
  CreateApplicabilityBindingPayloadSchema,
  CreateRulePayloadSchema,
} from '../../shared/actions/policy-administration.ts';
import { CreateClosedAssortmentBoundaryPayloadSchema } from '../../shared/actions/boundary-administration.ts';
import {
  AssortmentApplicableBoundaryQueryV1Schema,
  AssortmentOrdinaryCandidateQueryV1Schema,
} from '../../shared/domain/decision-set-query.ts';
import { readAssortmentDecisionSetV1, verifyAssortmentDecisionSetV1 } from '../../src/services/decision-set-reader.ts';
import { boundaryAdministrationPersistenceForScope } from '../../src/services/boundary-administration.service.ts';
import { assortmentPolicyPersistenceForScope } from '../../src/services/policy-administration.service.ts';

const tenantId = randomUUID();
const legalEntityId = randomUUID();
const principalId = randomUUID();
const operationTime = '2030-02-01T00:00:00.000Z';
const scope = {
  authContextRef: `job:assortment-decision-set:${randomUUID()}`,
  authMethod: 'system',
  correlationId: randomUUID(),
  legalEntityId,
  principalId,
  tenantId,
} satisfies OperationalScope;
const productRef = {
  moduleId: 'commerce.catalog',
  resourceId: randomUUID(),
  resourceType: 'catalog.product',
  tenantId,
} as const;
const profileRef = {
  moduleId: 'commerce.customer-context',
  resourceId: randomUUID(),
  resourceType: 'commerce.customer-context.retail-customer-profile',
  tenantId,
} as const;
const channelRef = {
  moduleId: 'commerce.channel',
  resourceId: 'decision-set-channel',
  resourceType: 'commerce.channel.channel',
  tenantId,
} as const;
const sellingLegalEntityRef = {
  moduleId: 'party.registry',
  resourceId: legalEntityId,
  resourceType: 'party.registry.legal-entity',
  tenantId,
} as const;
const query = Schema.decodeUnknownSync(AssortmentOrdinaryCandidateQueryV1Schema)({
  decisionPurpose: 'VISIBILITY',
  kind: 'ORDINARY_CANDIDATES',
  legalEntityId,
  operationTime,
  subject: {
    kind: 'IDENTIFIED',
    subject: { kind: 'RETAIL_CUSTOMER_PROFILE', profileRef },
  },
  target: { kind: 'PRODUCT', productRef },
  tenantId,
  trustedContext: {
    channelRef,
    operationTime,
    sellingLegalEntityRef,
    tenantId,
  },
  version: 1,
});

it.live('invalidates empty Assortment Candidate and Boundary sets when matching facts are added', () =>
  Effect.scoped(
    Effect.gen(function* decisionSetCurrentnessPostgres() {
      const { admin: adminPool } = yield* testDatabasePools;
      const ownerDatabase = yield* makeTestDatabaseFromPool(adminPool, coreRelations);
      const runScoped = <Value, Failure>(
        operation: (transaction: ScopedTransactionExecutor) => Effect.Effect<Value, Failure>,
      ) =>
        ownerDatabase.transaction((transaction) =>
          Effect.gen(function* scopedAssortmentOperation() {
            const scoped = yield* installOperationalScope(transaction, scope);
            return yield* operation(scoped);
          }),
        );

      const foreignTenantId = randomUUID();
      const foreignQuery = Schema.decodeUnknownSync(AssortmentOrdinaryCandidateQueryV1Schema)({
        decisionPurpose: 'VISIBILITY',
        kind: 'ORDINARY_CANDIDATES',
        legalEntityId,
        operationTime,
        subject: {
          kind: 'IDENTIFIED',
          subject: {
            kind: 'RETAIL_CUSTOMER_PROFILE',
            profileRef: { ...profileRef, tenantId: foreignTenantId },
          },
        },
        target: { kind: 'PRODUCT', productRef: { ...productRef, tenantId: foreignTenantId } },
        tenantId: foreignTenantId,
        trustedContext: {
          channelRef: { ...channelRef, tenantId: foreignTenantId },
          operationTime,
          sellingLegalEntityRef: { ...sellingLegalEntityRef, tenantId: foreignTenantId },
          tenantId: foreignTenantId,
        },
        version: 1,
      });
      const foreignRead = yield* runScoped((transaction) =>
        Effect.result(readAssortmentDecisionSetV1(transaction, foreignQuery)),
      );
      expect(Result.isFailure(foreignRead)).toBe(true);

      const otherLegalEntityId = randomUUID();
      const otherEntityQuery = Schema.decodeUnknownSync(AssortmentOrdinaryCandidateQueryV1Schema)({
        decisionPurpose: 'VISIBILITY',
        kind: 'ORDINARY_CANDIDATES',
        legalEntityId: otherLegalEntityId,
        operationTime,
        subject: { kind: 'IDENTIFIED', subject: { kind: 'RETAIL_CUSTOMER_PROFILE', profileRef } },
        target: { kind: 'PRODUCT', productRef },
        tenantId,
        trustedContext: {
          channelRef,
          operationTime,
          sellingLegalEntityRef: { ...sellingLegalEntityRef, resourceId: otherLegalEntityId },
          tenantId,
        },
        version: 1,
      });
      const otherEntityRead = yield* runScoped((transaction) =>
        Effect.result(readAssortmentDecisionSetV1(transaction, otherEntityQuery)),
      );
      expect(Result.isFailure(otherEntityRead)).toBe(true);

      const createRuleInput = Schema.decodeUnknownSync(CreateRulePayloadSchema)({
        effect: 'ALLOW',
        provenanceRef: 'decision-set-currentness:create-rule',
        purpose: 'VISIBILITY',
        reason: 'Seed the owner fence without creating a binding',
        selector: { kind: 'ALL' },
        stableCode: `decision-set.${tenantId}`,
      });
      const created = yield* runScoped((transaction) =>
        assortmentPolicyPersistenceForScope(transaction, scope).createRule({
          ...createRuleInput,
          actionInvocationId: randomUUID(),
          actorPrincipalId: principalId,
          tenantId,
        }),
      );
      if (!('initialRuleRevisionId' in created)) {
        throw new Error('Expected a new Assortment Rule Revision');
      }

      const empty = yield* runScoped((transaction) => readAssortmentDecisionSetV1(transaction, query));
      expect(empty.kind).toBe('COMPLETE_ORDINARY_CANDIDATE_SET');
      if (empty.kind !== 'COMPLETE_ORDINARY_CANDIDATE_SET') {
        throw new Error('Expected the ordinary Candidate set');
      }
      expect(empty.candidates).toEqual([]);
      const expectedProofRef = empty.completeness.evidence.proof.evidenceRef;
      const verify = () =>
        runScoped((transaction) => verifyAssortmentDecisionSetV1(transaction, { expectedProofRef, query, version: 1 }));
      expect(yield* verify()).toEqual({ state: 'CURRENT', version: 1 });

      const createBindingInput = Schema.decodeUnknownSync(CreateApplicabilityBindingPayloadSchema)({
        audience: { kind: 'SHARED' },
        commercialScope: { channelRef, sellingLegalEntityRef },
        effectiveFrom: DateTime.formatIso(DateTime.makeUnsafe(new Date('2030-01-01T00:00:00.000Z'))),
        provenanceRef: 'decision-set-currentness:create-binding',
        reason: 'Make the Rule Revision applicable',
        ruleRevisionRef: {
          ownerModuleId: 'commerce.assortment',
          revision: '1',
          sourceRef: {
            moduleId: 'commerce.assortment',
            resourceId: created.initialRuleRevisionId,
            resourceType: 'commerce.assortment.rule-revision',
            tenantId,
          },
        },
      });
      const binding = yield* runScoped((transaction) =>
        assortmentPolicyPersistenceForScope(transaction, scope).createBinding({
          ...createBindingInput,
          actionInvocationId: randomUUID(),
          actorPrincipalId: principalId,
          legalEntityId,
          tenantId,
        }),
      );
      expect(binding).toMatchObject({ created: true });
      expect(yield* verify()).toEqual({ state: 'STALE', version: 1 });
      const current = yield* runScoped((transaction) => readAssortmentDecisionSetV1(transaction, query));
      expect(current.kind).toBe('COMPLETE_ORDINARY_CANDIDATE_SET');
      if (current.kind !== 'COMPLETE_ORDINARY_CANDIDATE_SET') {
        throw new Error('Expected the ordinary Candidate set');
      }
      expect(current.candidates).toHaveLength(1);
      expect(current.candidates[0]).toMatchObject({ effect: 'ALLOW', selector: { kind: 'ALL' } });
      expect(
        yield* runScoped((transaction) =>
          verifyAssortmentDecisionSetV1(transaction, {
            expectedProofRef: current.completeness.evidence.proof.evidenceRef,
            query,
            version: 1,
          }),
        ),
      ).toEqual({ state: 'CURRENT', version: 1 });

      const boundaryQuery = Schema.decodeUnknownSync(AssortmentApplicableBoundaryQueryV1Schema)({
        decisionPurpose: 'VISIBILITY',
        kind: 'APPLICABLE_BOUNDARIES',
        legalEntityId,
        operationTime,
        subject: query.subject.kind === 'IDENTIFIED' ? query.subject.subject : undefined,
        target: { kind: 'PRODUCT', productRef },
        tenantId,
        trustedContext: { channelRef, operationTime, sellingLegalEntityRef, tenantId },
        version: 1,
      });
      const emptyBoundaries = yield* runScoped((transaction) =>
        readAssortmentDecisionSetV1(transaction, boundaryQuery),
      );
      expect(emptyBoundaries.kind).toBe('COMPLETE_BOUNDARY_SET');
      if (emptyBoundaries.kind !== 'COMPLETE_BOUNDARY_SET') {
        throw new Error('Expected the Boundary set');
      }
      expect(emptyBoundaries.boundaries).toEqual([]);
      const emptyBoundaryProofRef = emptyBoundaries.completeness.evidence.proof.evidenceRef;
      const createBoundaryInput = Schema.decodeUnknownSync(CreateClosedAssortmentBoundaryPayloadSchema)({
        admissionSet: { entries: [{ kind: 'PRODUCT', productRef }] },
        commercialScope: { channelRef, sellingLegalEntityRef },
        decisionPurpose: 'VISIBILITY',
        effectiveFrom: '2030-01-01T00:00:00.000Z',
        provenanceRef: 'decision-set-currentness:create-boundary',
        reason: 'Make a previously empty Boundary predicate nonempty',
        subject: boundaryQuery.subject,
      });
      const createdBoundary = yield* runScoped((transaction) =>
        boundaryAdministrationPersistenceForScope(transaction, scope).create({
          ...createBoundaryInput,
          actionInvocationId: randomUUID(),
          actorPrincipalId: principalId,
          legalEntityId,
          tenantId,
        }),
      );
      expect(createdBoundary).toMatchObject({ created: true });
      expect(
        yield* runScoped((transaction) =>
          verifyAssortmentDecisionSetV1(transaction, {
            expectedProofRef: emptyBoundaryProofRef,
            query: boundaryQuery,
            version: 1,
          }),
        ),
      ).toEqual({ state: 'STALE', version: 1 });
      const currentBoundaries = yield* runScoped((transaction) =>
        readAssortmentDecisionSetV1(transaction, boundaryQuery),
      );
      expect(currentBoundaries.kind).toBe('COMPLETE_BOUNDARY_SET');
      if (currentBoundaries.kind !== 'COMPLETE_BOUNDARY_SET') {
        throw new Error('Expected the Boundary set');
      }
      expect(currentBoundaries.boundaries).toHaveLength(1);
      expect(currentBoundaries.boundaries[0]?.admissionSet).toEqual([{ kind: 'PRODUCT', productRef }]);
      expect(
        yield* runScoped((transaction) =>
          verifyAssortmentDecisionSetV1(transaction, {
            expectedProofRef: currentBoundaries.completeness.evidence.proof.evidenceRef,
            query: boundaryQuery,
            version: 1,
          }),
        ),
      ).toEqual({ state: 'CURRENT', version: 1 });
    }),
  ),
);
