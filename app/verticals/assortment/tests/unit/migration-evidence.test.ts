import { expect, it } from 'effect-rstest';
import { Schema } from 'effect';
import {
  AssortmentMigrationEvidenceRecordSchema,
  normalizeAssortmentMigrationEvidenceRecord,
} from '../../shared/domain/migration-evidence.ts';
import { AssortmentOwnerResourceRefSchema } from '../../shared/domain/decision-contracts.ts';

const tenantId = '018f8b4e-35a2-7b51-8d56-91a4f37d6a11';
const sourceRecordDigest = 'a'.repeat(64);
const ref = (moduleId: string, resourceType: string, resourceId: string) =>
  Schema.decodeUnknownSync(AssortmentOwnerResourceRefSchema)({
    moduleId,
    resourceId,
    resourceType,
    tenantId,
  });

const productRef = ref('catalog.owner', 'catalog.product', 'product-1');
const evidence = {
  evidenceRef: ref('catalog.owner', 'catalog.owner.evidence', 'evidence-1'),
  ownerModuleId: 'catalog.owner',
  sourceRevision: {
    ownerModuleId: 'catalog.owner',
    revision: 'r1',
    sourceRef: ref('catalog.owner', 'catalog.owner.snapshot', 'snapshot-1'),
  },
};

const decodeRecord = Schema.decodeUnknownSync(AssortmentMigrationEvidenceRecordSchema);

const baseRecordInput = () => ({
  affectedJourneys: ['VISIBILITY'],
  canonicalMeaning: {
    commercialScope: {
      channelRef: ref('commerce.channel', 'commerce.channel.channel', 'web'),
      sellingLegalEntityRef: ref('commerce.legal-entity', 'commerce.legal-entity.selling-legal-entity', 'sle-1'),
    },
    completeness: {
      predicate: 'all current facts for migration record',
      proof: evidence,
      scope: 'migration-source-record',
      state: 'COMPLETE',
    },
    effect: 'ALLOW',
    lifecycle: { effectiveFrom: '2026-09-22T10:00:00.000Z' },
    purpose: 'VISIBILITY',
    selector: { kind: 'PRODUCT', productRef },
    subject: { kind: 'SHARED' },
    targetKind: 'RULE_BINDING',
  },
  classification: {
    disposition: 'TRANSFORM',
    evidenceRefs: [evidence],
    reason: 'Owner-backed canonical meaning is complete',
  },
  correlations: [
    {
      canonicalRef: productRef,
      evidenceRef: evidence,
      method: 'owner-qualified-catalog-reference',
      sourceRecordDigest,
      status: 'MATCHED',
      target: 'CATALOG',
    },
  ],
  factFamily: 'test.fact-family',
  gaps: [],
  ownerEvidenceRefs: [evidence],
  source: {
    datasetId: 'test-dataset',
    observedAt: '2026-09-22T10:00:00.000Z',
    sourceLocatorDigest: 'b'.repeat(64),
    sourceOwner: 'test-owner',
    sourceRecordDigest,
    sourceRevision: 'source-revision-1',
    sourceSystemId: 'test-system',
  },
});

const baseRecord = () => decodeRecord(baseRecordInput());

it('preserves a proven transform only when exact meaning, identity, completeness, and owner evidence exist', () => {
  const normalized = normalizeAssortmentMigrationEvidenceRecord(baseRecord());

  expect(normalized.classification.disposition).toBe('TRANSFORM');
  expect(normalized.gaps).toEqual([]);
});

it('forces missing meaning and owner proof to UNRESOLVED instead of inferring a wildcard', () => {
  const record = decodeRecord({
    ...baseRecordInput(),
    canonicalMeaning: { purpose: 'VISIBILITY' },
    classification: {
      disposition: 'RETIRE',
      evidenceRefs: [],
      proposedDisposition: 'RETIRE',
      reason: 'Historical publication candidate',
    },
    correlations: [],
    ownerEvidenceRefs: [],
  });
  const normalized = normalizeAssortmentMigrationEvidenceRecord(record);

  expect(normalized.classification.disposition).toBe('UNRESOLVED');
  expect(normalized.gaps).toContain('CANONICAL_IDENTITY');
  expect(normalized.gaps).toContain('COMMERCIAL_SCOPE');
  expect(normalized.gaps).toContain('COMPLETENESS');
  expect(normalized.gaps).toContain('OWNER_EVIDENCE');
});

it('rejects canonical claims from ambiguous correlations', () => {
  const record = decodeRecord({
    ...baseRecordInput(),
    correlations: [
      {
        method: 'unverified-name-match',
        sourceRecordDigest,
        status: 'AMBIGUOUS',
        target: 'CATALOG',
      },
    ],
    ownerEvidenceRefs: [],
  });
  const normalized = normalizeAssortmentMigrationEvidenceRecord(record);

  expect(normalized.classification.disposition).toBe('UNRESOLVED');
  expect(normalized.gaps).toContain('CANONICAL_IDENTITY');
  expect(normalized.gaps).toContain('OWNER_EVIDENCE');
});

it('requires a complete Admission Set meaning for a Boundary transformation', () => {
  const record = decodeRecord({
    ...baseRecordInput(),
    canonicalMeaning: { ...baseRecordInput().canonicalMeaning, targetKind: 'BOUNDARY' },
  });
  const normalized = normalizeAssortmentMigrationEvidenceRecord(record);

  expect(normalized.classification.disposition).toBe('UNRESOLVED');
  expect(normalized.gaps).toContain('ADMISSION_SET');
});

it('rejects reversed lifecycle intervals and mismatched source correlation digests', () => {
  expect(() =>
    decodeRecord({
      ...baseRecordInput(),
      canonicalMeaning: {
        ...baseRecordInput().canonicalMeaning,
        lifecycle: {
          effectiveFrom: '2026-09-22T12:00:00.000Z',
          effectiveTo: '2026-09-22T10:00:00.000Z',
        },
      },
    }),
  ).toThrow();

  expect(() =>
    decodeRecord({
      ...baseRecordInput(),
      correlations: [
        {
          canonicalRef: productRef,
          evidenceRef: evidence,
          method: 'owner-qualified-catalog-reference',
          sourceRecordDigest: 'c'.repeat(64),
          status: 'MATCHED',
          target: 'CATALOG',
        },
      ],
    }),
  ).toThrow();
});
