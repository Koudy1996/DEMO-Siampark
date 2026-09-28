import type { OperationalScope, ScopedTransactionExecutor } from '@app/core-runtime';
import { DateTime, Effect } from 'effect';
import { expect, it } from 'effect-rstest';
import { assortmentAuthorizationCurrentForTransaction } from '../../src/services/owner-authorization-current.ts';

const tenantId = '10000000-0000-4000-8000-000000000001';
const legalEntityId = '30000000-0000-4000-8000-000000000001';
const scope = {
  authContextRef: 'owner-current-test',
  authMethod: 'session',
  correlationId: 'owner-current-test',
  legalEntityId,
  principalId: '20000000-0000-4000-8000-000000000001',
  tenantId,
} satisfies OperationalScope;
const at = new Date('2026-09-28T09:00:00.000Z');
const futureAt = new Date('2099-01-01T00:00:00.000Z');
const operationAt = DateTime.makeUnsafe(at);
const afterFutureAt = DateTime.makeUnsafe(futureAt);
const stableRule = {
  createdAt: at,
  stableCode: 'policy.example',
  stableRuleId: 'stable-rule-1',
  tenantId,
};
const stableRuleTarget = {
  moduleId: 'commerce.assortment',
  resourceId: 'stable-rule-1',
  resourceType: 'commerce.assortment.stable-rule',
  tenantId,
} as const;
const revisionTarget = {
  effect: 'ALLOW',
  kind: 'assortment_rule',
  mode: 'revision_create',
  permission: 'assortment.rule.revision.create',
  purpose: 'PURCHASE',
  selector: { kind: 'ALL' },
  stableRule: stableRuleTarget,
} as const;

const query = <Rows extends readonly object[]>(rows: Rows | Effect.Effect<Rows, unknown>) => {
  const effect = (Effect.isEffect(rows) ? rows : Effect.succeed(rows)) as Effect.Effect<Rows> & {
    from: () => typeof effect;
    limit: () => typeof effect;
    where: () => typeof effect;
  };
  effect.from = () => effect;
  effect.limit = () => effect;
  effect.where = () => effect;
  return effect;
};
const transaction = (selects: readonly (readonly object[] | Effect.Effect<readonly object[], unknown>)[]) => {
  let index = 0;
  return {
    scope: { legalEntityId, tenantId },
    select: () => {
      const current = index;
      index += 1;
      return query(selects[current] ?? []);
    },
  } as unknown as ScopedTransactionExecutor;
};

it.effect('rejects an authorization scope that differs from the installed transaction scope', () =>
  Effect.gen(function* rejectsCrossScope() {
    const result = yield* assortmentAuthorizationCurrentForTransaction(transaction([[stableRule], []])).assess({
      operationAt,
      scope: { ...scope, tenantId: '90000000-0000-4000-8000-000000000009' },
      target: revisionTarget,
    });
    expect(result).toEqual({ reason: 'local_currentness_unavailable', status: 'UNAVAILABLE' });
  }),
);

it.effect('proves a current self-contained stable Rule and ALL revision target', () =>
  Effect.gen(function* currentRule() {
    const service = assortmentAuthorizationCurrentForTransaction(transaction([[stableRule], []]));
    const result = yield* service.assess({
      operationAt,
      scope,
      target: {
        kind: 'assortment_rule',
        mode: 'retire',
        permission: 'assortment.rule.retire',
        stableRule: stableRuleTarget,
      },
    });
    expect(result.status).toBe('CURRENT');

    const revision = yield* assortmentAuthorizationCurrentForTransaction(transaction([[stableRule], []])).assess({
      operationAt,
      scope,
      target: revisionTarget,
    });
    expect(revision.status).toBe('CURRENT');
  }),
);

it.effect('evaluates Rule retirement at the trusted operation time', () =>
  Effect.gen(function* retirementTime() {
    const futureRetirement = yield* assortmentAuthorizationCurrentForTransaction(
      transaction([[stableRule], [{ retiredAt: futureAt }]]),
    ).assess({
      operationAt,
      scope,
      target: {
        kind: 'assortment_rule',
        mode: 'retire',
        permission: 'assortment.rule.retire',
        stableRule: stableRuleTarget,
      },
    });
    expect(futureRetirement.status).toBe('CURRENT');

    const effectiveRetirement = yield* assortmentAuthorizationCurrentForTransaction(
      transaction([[stableRule], [{ retiredAt: futureAt }]]),
    ).assess({
      operationAt: afterFutureAt,
      scope,
      target: {
        kind: 'assortment_rule',
        mode: 'retire',
        permission: 'assortment.rule.retire',
        stableRule: stableRuleTarget,
      },
    });
    expect(effectiveRetirement).toEqual({ reason: 'rule_retired', status: 'NOT_CURRENT' });

    const retirementAtInstant = yield* assortmentAuthorizationCurrentForTransaction(
      transaction([[stableRule], [{ retiredAt: futureAt }]]),
    ).assess({
      operationAt: afterFutureAt,
      scope,
      target: {
        kind: 'assortment_rule',
        mode: 'retire',
        permission: 'assortment.rule.retire',
        stableRule: stableRuleTarget,
      },
    });
    expect(retirementAtInstant).toEqual({ reason: 'rule_retired', status: 'NOT_CURRENT' });

    const unavailable = yield* assortmentAuthorizationCurrentForTransaction(transaction([])).assess({
      operationAt,
      scope,
      target: {
        kind: 'assortment_rule',
        mode: 'retire',
        permission: 'assortment.rule.retire',
        stableRule: stableRuleTarget,
      },
    });
    expect(unavailable).toEqual({ reason: 'local_currentness_unavailable', status: 'UNAVAILABLE' });
  }),
);

it.effect('keeps Catalog-dependent Rule targets unavailable without foreign Currentness', () =>
  Effect.gen(function* foreignSelector() {
    const result = yield* assortmentAuthorizationCurrentForTransaction(transaction([[stableRule], []])).assess({
      operationAt,
      scope,
      target: {
        ...revisionTarget,
        selector: {
          kind: 'PRODUCT',
          target: {
            moduleId: 'commerce.catalog',
            resourceId: 'product-1',
            resourceType: 'catalog.product',
          },
        },
      },
    });
    expect(result).toEqual({ reason: 'foreign_currentness_unavailable', status: 'UNAVAILABLE' });
  }),
);

it.effect('evaluates Boundary intervals and keeps live foreign references unavailable', () =>
  Effect.gen(function* boundaryEnd() {
    const boundary = {
      channelResourceId: 'channel-1',
      closedBoundaryId: 'boundary-1',
      effectiveFrom: at,
      legalEntityId,
      marketResourceId: null,
      purpose: 'PURCHASE',
      semanticFingerprint: 'b'.repeat(64),
      storefrontResourceId: null,
      subjectKind: 'COUNTERPARTY',
      subjectResourceId: 'counterparty-1',
      tenantId,
    };
    const target = {
      boundary: {
        moduleId: 'commerce.assortment',
        resourceId: 'boundary-1',
        resourceType: 'commerce.assortment.closed-assortment-boundary',
        tenantId,
      },
      kind: 'assortment_boundary',
      mode: 'end',
      permission: 'assortment.boundary.end',
    } as const;
    const ended = yield* assortmentAuthorizationCurrentForTransaction(
      transaction([[boundary], [{ effectiveTo: futureAt }]]),
    ).assess({ operationAt, scope, target });
    expect(ended).toEqual({ reason: 'foreign_currentness_unavailable', status: 'UNAVAILABLE' });

    const effectiveEnd = yield* assortmentAuthorizationCurrentForTransaction(
      transaction([[boundary], [{ effectiveTo: futureAt }]]),
    ).assess({ operationAt: afterFutureAt, scope, target });
    expect(effectiveEnd).toEqual({ reason: 'resource_ended', status: 'NOT_CURRENT' });

    const notYetEffective = yield* assortmentAuthorizationCurrentForTransaction(
      transaction([[{ ...boundary, effectiveFrom: futureAt }], []]),
    ).assess({ operationAt, scope, target });
    expect(notYetEffective).toEqual({ reason: 'resource_not_yet_effective', status: 'NOT_CURRENT' });

    const startsAtInstant = yield* assortmentAuthorizationCurrentForTransaction(
      transaction([[{ ...boundary, effectiveFrom: futureAt }], []]),
    ).assess({ operationAt: afterFutureAt, scope, target });
    expect(startsAtInstant).toEqual({ reason: 'foreign_currentness_unavailable', status: 'UNAVAILABLE' });

    const active = yield* assortmentAuthorizationCurrentForTransaction(transaction([[boundary], []])).assess({
      operationAt,
      scope,
      target,
    });
    expect(active).toEqual({ reason: 'foreign_currentness_unavailable', status: 'UNAVAILABLE' });
  }),
);

it.effect('evaluates Binding intervals while preserving foreign failure for active rows', () =>
  Effect.gen(function* bindingEnd() {
    const binding = {
      applicabilityBindingId: 'binding-1',
      bindingKind: 'SHARED',
      channelResourceId: 'channel-1',
      customerGroupResourceId: null,
      effectiveFrom: at,
      legalEntityId,
      marketResourceId: null,
      ruleRevisionId: 'rule-revision-1',
      storefrontResourceId: null,
      subjectKind: null,
      subjectResourceId: null,
      tenantId,
    };
    const revision = {
      effect: 'ALLOW',
      purpose: 'PURCHASE',
      recordedAt: at,
      revisionNumber: 1,
      ruleRevisionId: 'rule-revision-1',
      selectorKind: 'ALL',
      semanticFingerprint: 'a'.repeat(64),
      tenantId,
    };
    const target = {
      binding: {
        moduleId: 'commerce.assortment',
        resourceId: 'binding-1',
        resourceType: 'commerce.assortment.applicability-binding',
        tenantId,
      },
      kind: 'assortment_binding',
      mode: 'end',
      permission: 'assortment.binding.end',
    } as const;
    const ended = yield* assortmentAuthorizationCurrentForTransaction(
      transaction([[binding], [revision], [{ effectiveTo: futureAt }]]),
    ).assess({ operationAt, scope, target });
    expect(ended).toEqual({ reason: 'foreign_currentness_unavailable', status: 'UNAVAILABLE' });

    const effectiveEnd = yield* assortmentAuthorizationCurrentForTransaction(
      transaction([[binding], [revision], [{ effectiveTo: futureAt }]]),
    ).assess({ operationAt: afterFutureAt, scope, target });
    expect(effectiveEnd).toEqual({ reason: 'resource_ended', status: 'NOT_CURRENT' });

    const notYetEffective = yield* assortmentAuthorizationCurrentForTransaction(
      transaction([[{ ...binding, effectiveFrom: futureAt }], [revision], []]),
    ).assess({ operationAt, scope, target });
    expect(notYetEffective).toEqual({ reason: 'resource_not_yet_effective', status: 'NOT_CURRENT' });

    const active = yield* assortmentAuthorizationCurrentForTransaction(transaction([[binding], [revision], []])).assess(
      { operationAt, scope, target },
    );
    expect(active).toEqual({ reason: 'foreign_currentness_unavailable', status: 'UNAVAILABLE' });
  }),
);
