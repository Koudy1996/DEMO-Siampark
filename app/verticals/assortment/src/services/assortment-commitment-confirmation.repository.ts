import type { OperationalScope, ReadServiceFactory } from '@app/core-runtime';
import { and, eq } from 'drizzle-orm';
import { DateTime, Effect, Schema } from 'effect';
import { assortmentMeaningFingerprint } from './policy-administration.service.ts';
import {
  AssortmentCandidateSchema,
  AssortmentEvidenceReferenceSchema,
  AssortmentOwnerResourceRefSchema,
  AssortmentPurchaseConstituentSchema,
} from '../../shared/domain/decision-contracts.ts';
import {
  AssortmentCommitmentConfirmationInvalid,
  AssortmentCommitmentConfirmationResultSchema,
  AssortmentCommitmentConfirmationUnavailable,
} from '../../shared/domain/commitment-confirmation.ts';
import type {
  AssortmentCommitmentConfirmationPayload,
  AssortmentCommitmentConfirmationResult,
} from '../../shared/domain/commitment-confirmation.ts';
import type {
  AssortmentCommitmentConfirmationPersistenceMetadata,
  AssortmentCommitmentConfirmationRepository,
} from './assortment-commitment-confirmation.service.ts';
import { commitmentConfirmations } from '../database/schema.ts';

const unavailable = (cause?: unknown) => {
  const failure = new AssortmentCommitmentConfirmationUnavailable({
    code: 'assortment_confirmation_unavailable',
    reason: 'Assortment Commitment Confirmation persistence is unavailable',
  });
  return cause === undefined ? failure : Object.defineProperty(failure, 'cause', { configurable: true, value: cause });
};

const encodeOwnerRef = (value: typeof AssortmentOwnerResourceRefSchema.Type) =>
  Schema.encodeUnknownEffect(Schema.toCodecJson(AssortmentOwnerResourceRefSchema))(value).pipe(
    // oxlint-disable-next-line effect-native/no-json-schema-as-document-contract -- JSONB is validated by the owner codec.
    Effect.flatMap((encoded) => Schema.decodeEffect(Schema.Json)(encoded)),
    Effect.mapError(unavailable),
  );
const encodeConstituent = (value: typeof AssortmentPurchaseConstituentSchema.Type) =>
  Schema.encodeUnknownEffect(Schema.toCodecJson(AssortmentPurchaseConstituentSchema))(value).pipe(
    // oxlint-disable-next-line effect-native/no-json-schema-as-document-contract -- JSONB is validated by the owner codec.
    Effect.flatMap((encoded) => Schema.decodeEffect(Schema.Json)(encoded)),
    Effect.mapError(unavailable),
  );
const encodeCandidate = (value: typeof AssortmentCandidateSchema.Type) =>
  Schema.encodeUnknownEffect(Schema.toCodecJson(AssortmentCandidateSchema))(value).pipe(
    // oxlint-disable-next-line effect-native/no-json-schema-as-document-contract -- JSONB is validated by the owner codec.
    Effect.flatMap((encoded) => Schema.decodeEffect(Schema.Json)(encoded)),
    Effect.mapError(unavailable),
  );
const encodeEvidenceReference = (value: typeof AssortmentEvidenceReferenceSchema.Type) =>
  Schema.encodeUnknownEffect(Schema.toCodecJson(AssortmentEvidenceReferenceSchema))(value).pipe(
    // oxlint-disable-next-line effect-native/no-json-schema-as-document-contract -- JSONB is validated by the owner codec.
    Effect.flatMap((encoded) => Schema.decodeEffect(Schema.Json)(encoded)),
    Effect.mapError(unavailable),
  );

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- JSONB is decoded at this persistence boundary; expires: 2027-09-24.
const decodeOwnerRef = (value: unknown) =>
  Schema.decodeUnknownEffect(Schema.toCodecJson(AssortmentOwnerResourceRefSchema))(value).pipe(
    Effect.mapError(unavailable),
  );
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- JSONB is decoded at this persistence boundary; expires: 2027-09-24.
const decodeConstituent = (value: unknown) =>
  Schema.decodeUnknownEffect(Schema.toCodecJson(AssortmentPurchaseConstituentSchema))(value).pipe(
    Effect.mapError(unavailable),
  );
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- JSONB is decoded at this persistence boundary; expires: 2027-09-24.
const decodeCandidate = (value: unknown) =>
  Schema.decodeUnknownEffect(Schema.toCodecJson(AssortmentCandidateSchema))(value).pipe(Effect.mapError(unavailable));
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- JSONB is decoded at this persistence boundary; expires: 2027-09-24.
const decodeEvidenceReference = (value: unknown) =>
  Schema.decodeUnknownEffect(Schema.toCodecJson(AssortmentEvidenceReferenceSchema))(value).pipe(
    Effect.mapError(unavailable),
  );

const ownerRefEquivalence = Schema.toEquivalence(AssortmentOwnerResourceRefSchema);
const constituentEquivalence = Schema.toEquivalence(AssortmentPurchaseConstituentSchema);
const candidateEquivalence = Schema.toEquivalence(AssortmentCandidateSchema);
const evidenceReferenceEquivalence = Schema.toEquivalence(AssortmentEvidenceReferenceSchema);

type ScopedTransaction = Parameters<ReadServiceFactory<Readonly<Record<string, never>>>>[0];

type ConfirmationRow = Pick<
  typeof commitmentConfirmations.$inferSelect,
  | 'actionInvocationId'
  | 'actorPrincipalId'
  | 'attemptModuleId'
  | 'attemptResourceId'
  | 'attemptResourceType'
  | 'candidateJson'
  | 'commitmentConfirmationId'
  | 'constituentJson'
  | 'decisionEvidenceJson'
  | 'expiresAt'
  | 'issuedAt'
  | 'legalEntityId'
  | 'prospectiveMeaningJson'
  | 'tenantId'
>;

const decodeConfirmationRow = Effect.fn('AssortmentCommitmentConfirmationRepository.decodeConfirmationRow')(
  function* decodeStoredConfirmation(row: ConfirmationRow) {
    const [attemptRef, prospectivePurchaseMeaningRef, constituent, candidate, decisionEvidenceRef] = yield* Effect.all(
      [
        decodeOwnerRef({
          moduleId: row.attemptModuleId,
          resourceId: row.attemptResourceId,
          resourceType: row.attemptResourceType,
          tenantId: row.tenantId,
        }),
        decodeOwnerRef(row.prospectiveMeaningJson),
        decodeConstituent(row.constituentJson),
        decodeCandidate(row.candidateJson),
        decodeEvidenceReference(row.decisionEvidenceJson),
      ],
      { concurrency: 5 },
    );
    return yield* Schema.decodeEffect(AssortmentCommitmentConfirmationResultSchema)({
      attemptRef,
      candidate,
      confirmationRef: {
        moduleId: 'commerce.assortment',
        resourceId: row.commitmentConfirmationId,
        resourceType: 'commerce.assortment.commitment-confirmation',
        tenantId: row.tenantId,
      },
      constituent,
      decisionEvidenceRef,
      expiresAt: DateTime.formatIso(DateTime.makeUnsafe(row.expiresAt)),
      issuedAt: DateTime.formatIso(DateTime.makeUnsafe(row.issuedAt)),
      prospectivePurchaseMeaningRef,
    }).pipe(Effect.mapError(unavailable));
  },
);

const replayMatches = (
  row: ConfirmationRow,
  stored: AssortmentCommitmentConfirmationResult,
  payload: AssortmentCommitmentConfirmationPayload,
  metadata: AssortmentCommitmentConfirmationPersistenceMetadata,
): boolean =>
  row.actionInvocationId === metadata.actionInvocationId &&
  row.actorPrincipalId === metadata.actorPrincipalId &&
  ownerRefEquivalence(stored.attemptRef, payload.attemptRef) &&
  ownerRefEquivalence(stored.prospectivePurchaseMeaningRef, payload.prospectivePurchaseMeaningRef) &&
  constituentEquivalence(stored.constituent, payload.constituent) &&
  candidateEquivalence(stored.candidate, payload.candidate) &&
  evidenceReferenceEquivalence(stored.decisionEvidenceRef, payload.decisionEvidenceRef);

const replayConflict = () =>
  new AssortmentCommitmentConfirmationInvalid({
    code: 'assortment_confirmation_invalid',
    reason: 'Confirmation action invocation was already used with a different payload or actor',
  });

const storedConfirmation = (
  transaction: ScopedTransaction,
  scope: OperationalScope,
  legalEntityId: string,
  actionInvocationId: string,
) =>
  transaction
    .select({
      actionInvocationId: commitmentConfirmations.actionInvocationId,
      actorPrincipalId: commitmentConfirmations.actorPrincipalId,
      attemptModuleId: commitmentConfirmations.attemptModuleId,
      attemptResourceId: commitmentConfirmations.attemptResourceId,
      attemptResourceType: commitmentConfirmations.attemptResourceType,
      candidateJson: commitmentConfirmations.candidateJson,
      commitmentConfirmationId: commitmentConfirmations.commitmentConfirmationId,
      constituentJson: commitmentConfirmations.constituentJson,
      decisionEvidenceJson: commitmentConfirmations.decisionEvidenceJson,
      expiresAt: commitmentConfirmations.expiresAt,
      issuedAt: commitmentConfirmations.issuedAt,
      legalEntityId: commitmentConfirmations.legalEntityId,
      prospectiveMeaningJson: commitmentConfirmations.prospectiveMeaningJson,
      tenantId: commitmentConfirmations.tenantId,
    })
    .from(commitmentConfirmations)
    .where(
      and(
        eq(commitmentConfirmations.actionInvocationId, actionInvocationId),
        eq(commitmentConfirmations.tenantId, scope.tenantId),
        eq(commitmentConfirmations.legalEntityId, legalEntityId),
      ),
    )
    .limit(1)
    .pipe(Effect.mapError(unavailable));

export const assortmentCommitmentConfirmationRepositoryForScope = (
  transaction: ScopedTransaction,
  scope: OperationalScope,
): AssortmentCommitmentConfirmationRepository => ({
  persist: Effect.fn('assortmentCommitmentConfirmationRepositoryForScope.persist')(
    function* persistConfirmation(payload, result, persistenceScope, metadata) {
      if (
        persistenceScope.legalEntityId === undefined ||
        scope.legalEntityId === undefined ||
        persistenceScope.tenantId !== scope.tenantId ||
        persistenceScope.legalEntityId !== scope.legalEntityId ||
        result.confirmationRef.tenantId !== persistenceScope.tenantId
      ) {
        return yield* unavailable();
      }
      const [prospectiveMeaningJson, constituentJson, candidateJson, decisionEvidenceJson] = yield* Effect.all(
        [
          encodeOwnerRef(payload.prospectivePurchaseMeaningRef),
          encodeConstituent(payload.constituent),
          encodeCandidate(payload.candidate),
          encodeEvidenceReference(result.decisionEvidenceRef),
        ],
        { concurrency: 4 },
      );
      const rows = yield* transaction
        .insert(commitmentConfirmations)
        .values({
          actionInvocationId: metadata.actionInvocationId,
          actorPrincipalId: metadata.actorPrincipalId,
          attemptModuleId: payload.attemptRef.moduleId,
          attemptResourceId: payload.attemptRef.resourceId,
          attemptResourceType: payload.attemptRef.resourceType,
          candidateJson,
          commitmentConfirmationId: result.confirmationRef.resourceId,
          constituentFingerprint: assortmentMeaningFingerprint(payload.constituent),
          constituentJson,
          decisionEvidenceJson,
          expiresAt: DateTime.toDateUtc(result.expiresAt),
          issuedAt: DateTime.toDateUtc(result.issuedAt),
          legalEntityId: persistenceScope.legalEntityId,
          prospectiveMeaningJson,
          tenantId: persistenceScope.tenantId,
        })
        .onConflictDoNothing({
          target: [
            commitmentConfirmations.tenantId,
            commitmentConfirmations.legalEntityId,
            commitmentConfirmations.actionInvocationId,
          ],
        })
        .returning({ commitmentConfirmationId: commitmentConfirmations.commitmentConfirmationId })
        .pipe(Effect.mapError(unavailable));
      if (rows.length > 0) {
        return result;
      }

      const [row] = yield* storedConfirmation(
        transaction,
        scope,
        persistenceScope.legalEntityId,
        metadata.actionInvocationId,
      );
      if (row === undefined || row.tenantId !== scope.tenantId || row.legalEntityId !== scope.legalEntityId) {
        return yield* unavailable();
      }
      const stored = yield* decodeConfirmationRow(row);
      return replayMatches(row, stored, payload, metadata) ? stored : yield* replayConflict();
    },
  ),
});
