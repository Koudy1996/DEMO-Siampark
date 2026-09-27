// @effect-diagnostics nodeBuiltinImport:off -- Contract test reads checked-in generated SQL; expires: 2027-03-31.
import { getTableConfig } from 'drizzle-orm/pg-core';
import { expect, it } from 'effect-rstest';
import { Array as EffectArray, Order } from 'effect';
import { readdirSync, readFileSync } from 'node:fs';
import {
  ASSORTMENT_SCHEMA_NAME,
  ASSORTMENT_TABLE_INVENTORY,
  ASSORTMENT_TABLES,
  admissionSetEntries,
  admissionSets,
  closedBoundaries,
  collectionRevisions,
  commitmentConfirmations,
  decisionEvidence,
  ruleRevisions,
  stableRules,
} from '../../src/database/schema.ts';

const migrationRoot = new URL('../../drizzle/', import.meta.url);
const migrations = () =>
  EffectArray.sort(readdirSync(migrationRoot), Order.String)
    .map((folder) => readFileSync(new URL(`${folder}/migration.sql`, migrationRoot), 'utf-8'))
    .join('\n');

it('owns only the private, tenant/legal-entity-scoped Assortment policy catalog', () => {
  const names = EffectArray.sort(
    ASSORTMENT_TABLES.map((table) => {
      const config = getTableConfig(table);
      return `${config.schema}.${config.name}`;
    }),
    Order.String,
  );
  expect(ASSORTMENT_SCHEMA_NAME).toBe('assortment');
  expect(names).toEqual(
    EffectArray.sort(
      ASSORTMENT_TABLE_INVENTORY.map((name) => `assortment.${name}`),
      Order.String,
    ),
  );
  for (const table of ASSORTMENT_TABLES) {
    const config = getTableConfig(table);
    expect(config.enableRLS, `${config.name} enables RLS`).toBe(true);
    expect(config.columns.some(({ name, notNull }) => name === 'tenant_id' && notNull)).toBe(true);
    const isTenantOwned =
      config.name.startsWith('assortment_stable_rules') || config.name.startsWith('assortment_rule_');
    expect(config.columns.some(({ name, notNull }) => name === 'legal_entity_id' && notNull)).toBe(!isTenantOwned);
    expect(config.policies.map((policy) => policy.for)).toEqual(['select', 'insert', 'update', 'delete']);
  }
});

it('models immutable lifecycle facts and collection provenance', () => {
  expect(getTableConfig(closedBoundaries).columns.some(({ name }) => name === 'effective_from')).toBe(true);
  expect(getTableConfig(admissionSets).columns.some(({ name }) => name === 'collection_revision_id')).toBe(true);
  expect(getTableConfig(admissionSets).columns.some(({ name }) => name === 'closed_boundary_id')).toBe(true);
  expect(getTableConfig(admissionSets).foreignKeys.map((key) => key.getName())).toContain(
    'assortment_admission_sets_boundary_fk',
  );
  expect(getTableConfig(admissionSets).foreignKeys.map((key) => key.getName())).toContain(
    'assortment_admission_sets_collection_fk',
  );
  expect(getTableConfig(collectionRevisions).columns.some(({ name }) => name === 'purpose')).toBe(true);
  expect(getTableConfig(collectionRevisions).foreignKeys.map((key) => key.getName())).toContain(
    'assortment_collection_revisions_boundary_fk',
  );
  expect(getTableConfig(admissionSets).columns.some(({ name }) => name === 'legal_entity_id')).toBe(true);
  expect(getTableConfig(closedBoundaries).columns.some(({ name }) => name === 'admission_set_id')).toBe(false);
  expect(getTableConfig(admissionSetEntries).columns.some(({ name }) => name === 'target_resource_id')).toBe(true);
  const sql = migrations();
  expect(sql).toContain('FORCE ROW LEVEL SECURITY');
  expect(sql).toContain('assortment_stable_rules_append_only');
  expect(sql).toContain('assortment_admission_entries_append_only');
  expect(sql).toContain("set_kind <> 'ENTRIES'");
  expect(sql).toContain("coverage_kind = 'ALL'");
  expect(sql).toContain('CREATE CONSTRAINT TRIGGER "assortment_admission_sets_complete_ct"');
  expect(sql).toContain('member_count <> 0');
  expect(sql).toContain('v_count <> v_collection.member_count');
  expect(sql).toContain('v_collection.aggregate_id <> v_set.closed_boundary_id');
  const evidence = getTableConfig(decisionEvidence);
  expect(evidence.columns.map(({ name }) => name)).toContain('request_json');
  expect(evidence.columns.map(({ name }) => name)).toContain('decision_json');
  expect(evidence.columns.some(({ name, notNull }) => name === 'tenant_id' && notNull)).toBe(true);
  expect(evidence.columns.some(({ name, notNull }) => name === 'legal_entity_id' && notNull)).toBe(true);
  expect(evidence.policies.map((policy) => policy.for)).toEqual(['select', 'insert', 'update', 'delete']);
  expect(sql).toContain('assortment_decision_evidence_append_only');
  expect(sql).toContain('assortment_decision_evidence_lookup_idx');
  const confirmations = getTableConfig(commitmentConfirmations);
  expect(confirmations.columns.map(({ name }) => name)).toEqual(
    expect.arrayContaining([
      'attempt_module_id',
      'attempt_resource_id',
      'attempt_resource_type',
      'prospective_meaning_json',
      'constituent_json',
      'candidate_json',
      'decision_evidence_json',
      'issued_at',
      'expires_at',
      'action_invocation_id',
      'actor_principal_id',
    ]),
  );
  expect(confirmations.policies.map((policy) => policy.for)).toEqual(['select', 'insert', 'update', 'delete']);
  expect(sql).toContain('assortment_commitment_confirmations_append_only');
  expect(sql).toContain('assortment_commitment_confirmations_active_idx');
  expect(sql).toContain('assortment_commitment_confirmations_validity_ck');
  const initialMigration = readFileSync(
    new URL(`${EffectArray.sort(readdirSync(migrationRoot), Order.String)[0]}/migration.sql`, migrationRoot),
    'utf-8',
  );
  expect(initialMigration).not.toContain('FORCE ROW LEVEL SECURITY');
  expect(initialMigration).not.toContain('CREATE TRIGGER');
  expect(sql).not.toContain('"assortment_closed_boundaries"."admission_set_id"');
});

it('keeps the tenant-owned Rule lineage reusable across Selling Legal Entities', () => {
  for (const table of [getTableConfig(stableRules), getTableConfig(ruleRevisions)]) {
    expect(table.columns.some(({ name }) => name === 'legal_entity_id')).toBe(false);
    expect(table.policies.every((policy) => policy.to === 'ontos_runtime')).toBe(true);
  }
});
