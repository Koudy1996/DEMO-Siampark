/* oxlint-disable anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion -- Assortment and Core use the same transaction protocol at this scope-installer boundary; expires: 2027-09-24. */
import { randomUUID } from 'node:crypto';

import type { OperationalScope, ScopedTransactionExecutor } from '@app/core-runtime';
import { and, eq, sql } from 'drizzle-orm';
import { Effect, Exit, Schema } from 'effect';
import { expect, it } from 'effect-rstest';

import {
  makeTestDatabaseFromClient,
  testDatabaseClients,
} from '../../../../packages/core-runtime/tests/support/database.ts';
import type { TestDatabaseFromClient } from '../../../../packages/core-runtime/tests/support/database.ts';
import { installOperationalScope } from '../../../../packages/core-runtime/src/db/scoped-transaction.ts';
import type { CoreTransaction } from '../../../../packages/core-runtime/src/db/types.ts';
import {
  AssortmentCommitmentConfirmationInvalid,
  AssortmentCommitmentConfirmationPayloadSchema,
  AssortmentCommitmentConfirmationResultSchema,
} from '../../shared/domain/commitment-confirmation.ts';
import {
  AssortmentCandidateSchema,
  AssortmentOwnerResourceRefSchema,
  AssortmentPurchaseConstituentSchema,
} from '../../shared/domain/decision-contracts.ts';
import { assortmentRelations, commitmentConfirmations } from '../../src/database/schema.ts';
import { assortmentCommitmentConfirmationRepositoryForScope } from '../../src/services/assortment-commitment-confirmation.repository.ts';

const tenantId = randomUUID();
const legalEntityId = randomUUID();
const foreignTenantId = randomUUID();
const foreignLegalEntityId = randomUUID();
const principalId = randomUUID();
const actionInvocationId = randomUUID();

type AssortmentTestDatabase = TestDatabaseFromClient<typeof assortmentRelations>;
type AssortmentTransaction = Parameters<Parameters<AssortmentTestDatabase['transaction']>[0]>[0];

const scope = {
  authContextRef: 'commitment-confirmation-postgres-test',
  authMethod: 'session',
  correlationId: 'commitment-confirmation-postgres-test',
  legalEntityId,
  principalId,
  tenantId,
} satisfies OperationalScope;

const ref = (moduleId: string, resourceType: string, resourceId: string, refTenantId = tenantId) =>
  Schema.decodeUnknownSync(AssortmentOwnerResourceRefSchema)({
    moduleId,
    resourceId,
    resourceType,
    tenantId: refTenantId,
  });

// Future consumer owners define these types; Assortment persists both references opaquely.
const attemptRef = ref('example.consumer', 'example.consumer.attempt', 'attempt-1');
const meaningRef = ref('example.consumer', 'example.consumer.prospective-purchase-meaning', 'meaning-1');
const productRef = ref('catalog.owner', 'catalog.product', 'product-1');
const variantRef = ref('catalog.owner', 'catalog.variant', 'variant-1');
const candidate = Schema.decodeUnknownSync(AssortmentCandidateSchema)({
  audience: { kind: 'SHARED' },
  bindingRef: ref('commerce.assortment', 'commerce.assortment.applicability-binding', 'binding-1'),
  commercialScope: {
    channelRef: ref('commerce.channel', 'commerce.channel.channel', 'web'),
    sellingLegalEntityRef: ref('commerce.legal-entity', 'commerce.legal-entity.selling-legal-entity', legalEntityId),
  },
  decisionPurpose: 'PURCHASE',
  effect: 'ALLOW',
  ruleRevision: {
    ownerModuleId: 'commerce.assortment',
    revision: 'r1',
    sourceRef: ref('commerce.assortment', 'commerce.assortment.rule-revision', 'revision-1'),
  },
  selector: { kind: 'VARIANT', variantRef },
  stableRuleRef: ref('commerce.assortment', 'commerce.assortment.stable-rule', 'rule-1'),
});
const constituent = Schema.decodeUnknownSync(AssortmentPurchaseConstituentSchema)({
  catalogSelection: { configuration: { kind: 'NONE' }, productRef, variantKind: 'ATOMIC', variantRef },
  role: 'TOP_LEVEL',
});
const decisionEvidenceRef = {
  evidenceRef: ref('commerce.assortment', 'commerce.assortment.decision-evidence', 'evidence-1'),
  ownerModuleId: 'commerce.assortment',
};
const payload = Schema.decodeUnknownSync(AssortmentCommitmentConfirmationPayloadSchema)({
  attemptRef,
  candidate,
  constituent,
  decisionEvidenceRef,
  prospectivePurchaseMeaningRef: meaningRef,
});
const confirmation = Schema.decodeUnknownSync(AssortmentCommitmentConfirmationResultSchema)({
  ...payload,
  confirmationRef: ref('commerce.assortment', 'commerce.assortment.commitment-confirmation', randomUUID()),
  expiresAt: '2026-09-24T10:00:30.000Z',
  issuedAt: '2026-09-24T10:00:00.000Z',
});
const metadata = { actionInvocationId, actorPrincipalId: principalId };

const runScoped = <Value>(
  database: AssortmentTestDatabase,
  operationScope: OperationalScope,
  operation: (transaction: AssortmentTransaction) => Effect.Effect<Value, unknown>,
) =>
  database.transaction((transaction) =>
    Effect.gen(function* runOwnerScopedOperation() {
      yield* transaction.execute(
        sql`select set_config('ontos.tenant_id', ${operationScope.tenantId}, true), set_config('ontos.legal_entity_id', ${operationScope.legalEntityId}, true)`,
        'objects',
      );
      return yield* operation(transaction);
    }),
  );

const runRepositoryScoped = <Value>(
  database: AssortmentTestDatabase,
  operationScope: OperationalScope,
  operation: (transaction: ScopedTransactionExecutor) => Effect.Effect<Value, unknown>,
) =>
  database.transaction((transaction) =>
    Effect.gen(function* runRepositoryOperation() {
      // SAFETY: The assortment and Core transactions expose the same Drizzle transaction
      // protocol; the shared scope installer only consumes that structural database boundary.
      const scopedTransaction = yield* installOperationalScope(
        transaction as unknown as CoreTransaction,
        operationScope,
      );
      return yield* operation(scopedTransaction);
    }),
  );

const cleanupRows = (admin: AssortmentTestDatabase) =>
  admin.transaction((transaction) =>
    Effect.gen(function* cleanupCommitmentConfirmations() {
      yield* transaction.execute(sql`set local session_replication_role = 'replica'`, 'objects');
      yield* transaction
        .delete(commitmentConfirmations)
        .where(
          and(eq(commitmentConfirmations.tenantId, tenantId), eq(commitmentConfirmations.legalEntityId, legalEntityId)),
        );
    }),
  );

const grantRuntimeAccess = (admin: AssortmentTestDatabase) =>
  admin.transaction((transaction) =>
    Effect.gen(function* grantCommitmentConfirmationAccess() {
      yield* transaction.execute(sql`grant usage on schema assortment to ontos_runtime`, 'objects');
      yield* transaction.execute(
        sql`grant select, insert, update, delete on table assortment.assortment_commitment_confirmations to ontos_runtime`,
        'objects',
      );
    }),
  );

const revokeRuntimeAccess = (admin: AssortmentTestDatabase) =>
  admin.transaction((transaction) =>
    Effect.gen(function* revokeCommitmentConfirmationAccess() {
      yield* transaction.execute(
        sql`revoke select, insert, update, delete on table assortment.assortment_commitment_confirmations from ontos_runtime`,
        'objects',
      );
      yield* transaction.execute(sql`revoke usage on schema assortment from ontos_runtime`, 'objects');
    }),
  );

it.live('persists immutable confirmations with replay, RLS isolation, and append-only enforcement', () =>
  Effect.scoped(
    Effect.gen(function* commitmentConfirmationPersistenceAcceptance() {
      const { admin: adminClient, runtime: runtimeClient } = yield* testDatabaseClients;
      const admin = yield* makeTestDatabaseFromClient(adminClient, assortmentRelations);
      const runtime = yield* makeTestDatabaseFromClient(runtimeClient, assortmentRelations);
      yield* cleanupRows(admin);
      yield* grantRuntimeAccess(admin);
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* cleanupCommitmentConfirmationAcceptance() {
          yield* cleanupRows(admin).pipe(Effect.orDie);
          yield* revokeRuntimeAccess(admin).pipe(Effect.orDie);
        }),
      );

      const persisted = yield* runRepositoryScoped(runtime, scope, (transaction) =>
        assortmentCommitmentConfirmationRepositoryForScope(transaction, scope).persist(
          payload,
          confirmation,
          scope,
          metadata,
        ),
      );
      expect(persisted).toEqual(confirmation);

      const replayed = yield* runRepositoryScoped(runtime, scope, (transaction) =>
        assortmentCommitmentConfirmationRepositoryForScope(transaction, scope).persist(
          payload,
          Schema.decodeUnknownSync(AssortmentCommitmentConfirmationResultSchema)({
            ...confirmation,
            confirmationRef: ref('commerce.assortment', 'commerce.assortment.commitment-confirmation', randomUUID()),
            expiresAt: '2026-09-24T10:00:20.000Z',
            issuedAt: '2026-09-24T10:00:00.000Z',
          }),
          scope,
          metadata,
        ),
      );
      expect(replayed).toEqual(confirmation);

      const changedActor = yield* Effect.flip(
        runRepositoryScoped(runtime, scope, (transaction) =>
          assortmentCommitmentConfirmationRepositoryForScope(transaction, scope).persist(payload, confirmation, scope, {
            ...metadata,
            actorPrincipalId: randomUUID(),
          }),
        ),
      );
      expect(Schema.is(AssortmentCommitmentConfirmationInvalid)(changedActor)).toBe(true);

      const changedPayload = Schema.decodeUnknownSync(AssortmentCommitmentConfirmationPayloadSchema)({
        ...payload,
        prospectivePurchaseMeaningRef: ref(
          'example.consumer',
          'example.consumer.prospective-purchase-meaning',
          'meaning-2',
        ),
      });
      const changedPayloadResult = Schema.decodeUnknownSync(AssortmentCommitmentConfirmationResultSchema)({
        ...changedPayload,
        confirmationRef: ref('commerce.assortment', 'commerce.assortment.commitment-confirmation', randomUUID()),
        expiresAt: '2026-09-24T10:00:30.000Z',
        issuedAt: '2026-09-24T10:00:00.000Z',
      });
      const changedPayloadError = yield* Effect.flip(
        runRepositoryScoped(runtime, scope, (transaction) =>
          assortmentCommitmentConfirmationRepositoryForScope(transaction, scope).persist(
            changedPayload,
            changedPayloadResult,
            scope,
            metadata,
          ),
        ),
      );
      expect(Schema.is(AssortmentCommitmentConfirmationInvalid)(changedPayloadError)).toBe(true);

      const visibleRows = yield* runScoped(runtime, scope, (transaction) =>
        transaction
          .select()
          .from(commitmentConfirmations)
          .where(eq(commitmentConfirmations.commitmentConfirmationId, confirmation.confirmationRef.resourceId)),
      );
      expect(visibleRows).toHaveLength(1);

      const wrongTenantScope = { ...scope, tenantId: foreignTenantId };
      const wrongTenantRows = yield* runScoped(runtime, wrongTenantScope, (transaction) =>
        transaction
          .select()
          .from(commitmentConfirmations)
          .where(eq(commitmentConfirmations.commitmentConfirmationId, confirmation.confirmationRef.resourceId)),
      );
      expect(wrongTenantRows).toEqual([]);

      const wrongLegalEntityScope = { ...scope, legalEntityId: foreignLegalEntityId };
      const wrongLegalEntityRows = yield* runScoped(runtime, wrongLegalEntityScope, (transaction) =>
        transaction
          .select()
          .from(commitmentConfirmations)
          .where(eq(commitmentConfirmations.commitmentConfirmationId, confirmation.confirmationRef.resourceId)),
      );
      expect(wrongLegalEntityRows).toEqual([]);

      const updateExit = yield* Effect.exit(
        runScoped(runtime, scope, (transaction) =>
          transaction.execute(
            sql`update assortment.assortment_commitment_confirmations set recorded_at = recorded_at where commitment_confirmation_id = ${confirmation.confirmationRef.resourceId}::uuid`,
            'objects',
          ),
        ),
      );
      expect(Exit.isFailure(updateExit)).toBe(true);

      const deleteExit = yield* Effect.exit(
        runScoped(runtime, scope, (transaction) =>
          transaction.execute(
            sql`delete from assortment.assortment_commitment_confirmations where commitment_confirmation_id = ${confirmation.confirmationRef.resourceId}::uuid`,
            'objects',
          ),
        ),
      );
      expect(Exit.isFailure(deleteExit)).toBe(true);

      const immutableRows = yield* runScoped(runtime, scope, (transaction) =>
        transaction
          .select()
          .from(commitmentConfirmations)
          .where(eq(commitmentConfirmations.commitmentConfirmationId, confirmation.confirmationRef.resourceId)),
      );
      expect(immutableRows).toEqual(visibleRows);
    }),
  ),
);
