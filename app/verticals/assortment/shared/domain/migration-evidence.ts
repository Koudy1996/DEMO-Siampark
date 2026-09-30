import { DateTime, Schema } from 'effect';
import {
  AssortmentCatalogSelectorSchema,
  AssortmentCommercialScopeSchema,
  AssortmentDecisionPurposeSchema,
  AssortmentDecisionSubjectSchema,
  AssortmentEffectSchema,
  AssortmentEvidenceReferenceSchema,
  AssortmentOwnerResourceRefSchema,
  AssortmentSetCompletenessEvidenceSchema,
} from './decision-contracts.ts';
import { AssortmentCollectionRevisionRefSchema } from '../actions/boundary-administration.ts';

const NonEmptyTextSchema = Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(500));
const DigestSchema = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u));
const InstantSchema = Schema.DateTimeUtcFromString;
const DatasetIdSchema = NonEmptyTextSchema.pipe(Schema.brand('AssortmentMigrationDatasetId'));
const SourceSystemIdSchema = NonEmptyTextSchema.pipe(Schema.brand('AssortmentMigrationSourceSystemId'));
const MigrationTargetKindSchema = Schema.Literals(['BOUNDARY', 'RULE_BINDING']);

export const AssortmentMigrationJourneySchema = Schema.Literals(['VISIBILITY', 'PURCHASE']);

export const AssortmentMigrationDispositionSchema = Schema.Literals(['RETAIN', 'TRANSFORM', 'RETIRE', 'UNRESOLVED']);

export const AssortmentMigrationCorrelationStatusSchema = Schema.Literals(['MATCHED', 'AMBIGUOUS', 'UNRESOLVED']);

export const AssortmentMigrationCorrelationTargetSchema = Schema.Literals([
  'CATALOG',
  'CATEGORY',
  'CHANNEL',
  'COUNTERPARTY',
  'MARKET',
  'PROFILE',
  'STOREFRONT',
]);

export const AssortmentMigrationGapSchema = Schema.Literals([
  'ADMISSION_SET',
  'CANONICAL_IDENTITY',
  'COMMERCIAL_SCOPE',
  'COMPLETENESS',
  'EFFECT',
  'LIFECYCLE',
  'OWNER_EVIDENCE',
  'PURPOSE',
  'SOURCE_OWNER',
  'SOURCE_PROVENANCE',
  'SUBJECT',
]);
export type AssortmentMigrationGap = typeof AssortmentMigrationGapSchema.Type;

const MigrationSubjectSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('SHARED') }),
  AssortmentDecisionSubjectSchema,
]);

const MigrationLifecycleSchema = Schema.Struct({
  effectiveFrom: InstantSchema,
  effectiveTo: Schema.optionalKey(InstantSchema),
}).check(
  Schema.makeFilter((lifecycle) => {
    if (lifecycle.effectiveTo === undefined) {
      return true;
    }
    return DateTime.isLessThan(lifecycle.effectiveFrom, lifecycle.effectiveTo)
      ? true
      : 'migration lifecycle must end after it starts';
  }),
);

const MigrationAdmissionSetSchema = Schema.Struct({
  collectionRevisionRef: AssortmentCollectionRevisionRefSchema,
  contentHash: DigestSchema,
  memberCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  setKind: Schema.Literals(['EMPTY', 'ENTRIES']),
});

const CompleteCanonicalMeaningSchema = Schema.Struct({
  admissionSet: Schema.optionalKey(MigrationAdmissionSetSchema),
  commercialScope: AssortmentCommercialScopeSchema,
  completeness: AssortmentSetCompletenessEvidenceSchema,
  effect: AssortmentEffectSchema,
  lifecycle: MigrationLifecycleSchema,
  purpose: AssortmentDecisionPurposeSchema,
  selector: AssortmentCatalogSelectorSchema,
  subject: MigrationSubjectSchema,
  targetKind: MigrationTargetKindSchema,
}).check(
  Schema.makeFilter((meaning) => {
    if (meaning.completeness.state === 'COMPLETE') {
      if (meaning.targetKind !== 'BOUNDARY' || meaning.admissionSet !== undefined) {
        return true;
      }
      return 'complete Boundary migration meaning requires an Admission Set';
    }
    return 'complete migration meaning requires COMPLETE set evidence';
  }),
);

/** Exact canonical meaning, intentionally partial so unresolved source facts can be recorded. */
export const AssortmentMigrationCanonicalMeaningSchema = Schema.Struct({
  admissionSet: Schema.optionalKey(MigrationAdmissionSetSchema),
  commercialScope: Schema.optionalKey(AssortmentCommercialScopeSchema),
  completeness: Schema.optionalKey(AssortmentSetCompletenessEvidenceSchema),
  effect: Schema.optionalKey(AssortmentEffectSchema),
  lifecycle: Schema.optionalKey(MigrationLifecycleSchema),
  purpose: Schema.optionalKey(AssortmentDecisionPurposeSchema),
  selector: Schema.optionalKey(AssortmentCatalogSelectorSchema),
  subject: Schema.optionalKey(MigrationSubjectSchema),
  targetKind: Schema.optionalKey(MigrationTargetKindSchema),
});
export type AssortmentMigrationCanonicalMeaning = typeof AssortmentMigrationCanonicalMeaningSchema.Type;

/** Source identifiers are represented only by opaque digests; raw IDs and payloads are excluded. */
export const AssortmentMigrationSourceProvenanceSchema = Schema.Struct({
  datasetId: DatasetIdSchema,
  observedAt: InstantSchema,
  sourceLocatorDigest: Schema.optionalKey(DigestSchema),
  sourceOwner: NonEmptyTextSchema,
  sourceRecordDigest: DigestSchema,
  sourceRevision: NonEmptyTextSchema,
  sourceSystemId: SourceSystemIdSchema,
});

export const AssortmentMigrationCorrelationSchema = Schema.Struct({
  canonicalRef: Schema.optionalKey(AssortmentOwnerResourceRefSchema),
  evidenceRef: Schema.optionalKey(AssortmentEvidenceReferenceSchema),
  method: NonEmptyTextSchema,
  sourceRecordDigest: DigestSchema,
  status: AssortmentMigrationCorrelationStatusSchema,
  target: AssortmentMigrationCorrelationTargetSchema,
}).check(
  Schema.makeFilter((correlation) => {
    if (
      correlation.status === 'MATCHED' &&
      (correlation.canonicalRef === undefined || correlation.evidenceRef === undefined)
    ) {
      return 'matched correlations require a canonical reference and owner evidence';
    }
    if (correlation.status !== 'MATCHED' && correlation.canonicalRef !== undefined) {
      return 'ambiguous or unresolved correlations cannot claim a canonical reference';
    }
    return true;
  }),
);

export const AssortmentMigrationClassificationSchema = Schema.Struct({
  disposition: AssortmentMigrationDispositionSchema,
  evidenceRefs: Schema.Array(AssortmentEvidenceReferenceSchema),
  proposedDisposition: Schema.optionalKey(AssortmentMigrationDispositionSchema),
  reason: NonEmptyTextSchema,
});

export const AssortmentMigrationEvidenceRecordSchema = Schema.Struct({
  affectedJourneys: Schema.Array(AssortmentMigrationJourneySchema).check(Schema.isMinLength(1)),
  canonicalMeaning: Schema.optionalKey(AssortmentMigrationCanonicalMeaningSchema),
  classification: AssortmentMigrationClassificationSchema,
  correlations: Schema.Array(AssortmentMigrationCorrelationSchema),
  factFamily: NonEmptyTextSchema,
  gaps: Schema.Array(AssortmentMigrationGapSchema),
  ownerEvidenceRefs: Schema.Array(AssortmentEvidenceReferenceSchema),
  source: AssortmentMigrationSourceProvenanceSchema,
}).check(
  Schema.makeFilter((record) =>
    record.correlations.every((correlation) => correlation.sourceRecordDigest === record.source.sourceRecordDigest)
      ? true
      : 'correlation source digests must identify the containing source record',
  ),
);
export type AssortmentMigrationEvidenceRecord = typeof AssortmentMigrationEvidenceRecordSchema.Type;

const hasCompleteCanonicalMeaning = (record: AssortmentMigrationEvidenceRecord): boolean => {
  const meaning = record.canonicalMeaning;
  return meaning !== undefined && Schema.is(CompleteCanonicalMeaningSchema)(meaning);
};

const hasOwnerMatchedIdentity = (record: AssortmentMigrationEvidenceRecord): boolean =>
  record.ownerEvidenceRefs.length > 0 &&
  record.correlations.length > 0 &&
  record.correlations.every(
    (correlation) =>
      correlation.status === 'MATCHED' &&
      correlation.canonicalRef !== undefined &&
      correlation.evidenceRef !== undefined,
  );

const addMeaningGaps = (
  gaps: Set<AssortmentMigrationGap>,
  meaning: AssortmentMigrationCanonicalMeaning | undefined,
): void => {
  if (meaning === undefined || meaning.subject === undefined) {
    gaps.add('SUBJECT');
  }
  if (meaning === undefined || meaning.purpose === undefined) {
    gaps.add('PURPOSE');
  }
  if (meaning === undefined || meaning.commercialScope === undefined) {
    gaps.add('COMMERCIAL_SCOPE');
  }
  if (meaning === undefined || meaning.effect === undefined) {
    gaps.add('EFFECT');
  }
  if (meaning === undefined || meaning.lifecycle === undefined) {
    gaps.add('LIFECYCLE');
  }
  if (meaning === undefined || meaning.completeness?.state !== 'COMPLETE') {
    gaps.add('COMPLETENESS');
  }
};

const missingMigrationGaps = (record: AssortmentMigrationEvidenceRecord): readonly AssortmentMigrationGap[] => {
  const meaning = record.canonicalMeaning;
  const gaps = new Set<AssortmentMigrationGap>(record.gaps);
  if (!hasOwnerMatchedIdentity(record)) {
    gaps.add('CANONICAL_IDENTITY');
    gaps.add('OWNER_EVIDENCE');
  }
  addMeaningGaps(gaps, meaning);
  if (!hasCompleteCanonicalMeaning(record) && meaning?.targetKind === undefined) {
    gaps.add('CANONICAL_IDENTITY');
  }
  if (meaning === undefined || (meaning.targetKind === 'BOUNDARY' && meaning.admissionSet === undefined)) {
    gaps.add('ADMISSION_SET');
  }
  return [...gaps].toSorted((left, right) => left.localeCompare(right, 'en'));
};

/**
 * Applies the migration safety default: an incomplete or unproven record can
 * only remain UNRESOLVED, regardless of a caller-supplied proposed verdict.
 */
export const normalizeAssortmentMigrationEvidenceRecord = (
  record: AssortmentMigrationEvidenceRecord,
): AssortmentMigrationEvidenceRecord => {
  const gaps = missingMigrationGaps(record);
  const disposition = gaps.length === 0 ? record.classification.disposition : 'UNRESOLVED';
  return {
    ...record,
    classification: { ...record.classification, disposition },
    gaps,
  };
};
