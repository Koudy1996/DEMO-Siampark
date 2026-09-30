import { expect, it } from 'effect-rstest';
import { Effect, Schema } from 'effect';

import {
  AssortmentDependencyFailureError,
  AssortmentOwnerResourceRefSchema,
} from '../../shared/domain/decision-contracts.ts';
import {
  AssortmentCategoryClassificationSchema,
  AssortmentCustomerGroupMembershipRequestSchema,
  AssortmentCustomerGroupMembershipSetSchema,
  AssortmentFactCurrentnessRequestSchema,
  AssortmentFactCurrentnessResultSchema,
  AssortmentSetCompletenessRequestSchema,
  AssortmentSetCompletenessResultSchema,
  AssortmentTrustedCommerceContextRequestSchema,
  AssortmentOwnerEvidenceUnavailableLive,
  AssortmentOwnerEvidence,
} from '../../shared/domain/ports/owner-evidence.ts';
import { adaptCommerceCustomerGroupMemberships } from '../../src/adapters/commerce-customer-group-memberships.ts';

const tenantId = '018f8b4e-35a2-7b51-8d56-91a4f37d6a11';
const otherTenantId = '018f8b4e-35a2-7b51-8d56-91a4f37d6a22';
const instant = '2026-09-22T10:00:00.000Z';

const ref = (moduleId: string, resourceType: string, resourceId: string, nextTenantId = tenantId) =>
  Schema.decodeUnknownSync(AssortmentOwnerResourceRefSchema)({
    moduleId,
    resourceId,
    resourceType,
    tenantId: nextTenantId,
  });

const evidence = (resourceId: string, nextTenantId = tenantId) => ({
  evidenceRef: ref('owner.evidence', 'owner.evidence.proof', resourceId, nextTenantId),
  ownerModuleId: 'owner.evidence',
  sourceRevision: {
    ownerModuleId: 'owner.evidence',
    revision: 'r1',
    sourceRef: ref('owner.evidence', 'owner.evidence.revision', `${resourceId}-revision`, nextTenantId),
  },
});

const profileRef = () =>
  ref('commerce.customer-context', 'commerce.customer-context.retail-customer-profile', 'profile-1');

const membershipSet = (nextTenantId = tenantId) =>
  Schema.decodeUnknownSync(AssortmentCustomerGroupMembershipSetSchema)({
    asOf: instant,
    completeness: {
      predicate: 'all current memberships for profile',
      proof: evidence('membership-set-proof'),
      scope: 'commerce.customer-context.customer-group-membership',
      state: 'COMPLETE',
    },
    items: [
      {
        effectiveFrom: instant,
        effectiveTo: '2026-09-23T10:00:00.000Z',
        groupRef: ref('commerce.customer-context', 'commerce.customer-context.customer-group', 'group-1', nextTenantId),
        membershipRef: ref(
          'commerce.customer-context',
          'commerce.customer-context.customer-group-membership',
          'membership-1',
          nextTenantId,
        ),
        profileRef: ref(
          'commerce.customer-context',
          'commerce.customer-context.retail-customer-profile',
          'profile-1',
          nextTenantId,
        ),
        revision: 'r1',
        state: 'VALID',
      },
    ],
    profileRef: ref(
      'commerce.customer-context',
      'commerce.customer-context.retail-customer-profile',
      'profile-1',
      nextTenantId,
    ),
  });

it('accepts complete membership, currentness, and set proof values without using time as proof', () => {
  const memberships = membershipSet();
  expect(memberships.completeness.state).toBe('COMPLETE');
  expect(memberships.items[0]?.effectiveTo).not.toBeNull();

  const currentness = Schema.decodeUnknownSync(AssortmentFactCurrentnessResultSchema)({
    evidence: {
      factRef: ref('commerce.assortment', 'commerce.assortment.binding', 'binding-1'),
      proof: evidence('binding-currentness'),
      state: 'CURRENT',
    },
    observedAt: instant,
  });
  expect(currentness.evidence.state).toBe('CURRENT');

  const completeness = Schema.decodeUnknownSync(AssortmentSetCompletenessResultSchema)({
    evidence: memberships.completeness,
  });
  expect(completeness.evidence.state).toBe('COMPLETE');
});

it('preserves negative proof states and rejects cross-tenant nested evidence', () => {
  const completeMemberships = membershipSet();
  expect(
    Schema.is(AssortmentCustomerGroupMembershipSetSchema)({
      ...completeMemberships,
      completeness: { ...completeMemberships.completeness, state: 'UNVERIFIABLE' },
    }),
  ).toBe(true);
  const [membership] = completeMemberships.items;
  if (membership !== undefined && membership.effectiveTo !== null) {
    expect(
      Schema.is(AssortmentCustomerGroupMembershipSetSchema)({
        ...completeMemberships,
        asOf: membership.effectiveTo,
      }),
    ).toBe(false);
  }
  expect(
    Schema.decodeUnknownSync(AssortmentFactCurrentnessResultSchema)({
      evidence: {
        factRef: ref('commerce.assortment', 'commerce.assortment.binding', 'binding-1'),
        proof: evidence('binding-stale'),
        state: 'STALE',
      },
      observedAt: instant,
    }).evidence.state,
  ).toBe('STALE');
  const crossTenantMembershipSet = membershipSet();
  const crossTenantGroupRef = ref(
    'commerce.customer-context',
    'commerce.customer-context.customer-group',
    'group-other',
    otherTenantId,
  );
  expect(
    Schema.is(AssortmentCustomerGroupMembershipSetSchema)({
      ...crossTenantMembershipSet,
      items: crossTenantMembershipSet.items.map((item) => ({ ...item, groupRef: crossTenantGroupRef })),
    }),
  ).toBe(false);
  expect(() =>
    Schema.decodeUnknownSync(AssortmentCategoryClassificationSchema)({
      ancestries: [],
      classifications: [ref('catalog.owner', 'catalog.category', 'category-1', otherTenantId)],
      completeness: {
        predicate: 'all current category classifications',
        proof: evidence('category-proof'),
        scope: 'catalog.category-classification',
        state: 'COMPLETE',
      },
      currentness: [],
      productRef: ref('catalog.owner', 'catalog.product', 'product-1'),
    }),
  ).toThrow();
});

it('requires trusted context and owner-qualified set scopes rather than client context claims', () => {
  const contextRequest = Schema.decodeUnknownSync(AssortmentTrustedCommerceContextRequestSchema)({
    trustedContextRef: ref('commerce.context-owner', 'commerce.context-owner.trusted-context', 'context-1'),
  });
  expect(contextRequest.trustedContextRef.moduleId).toBe('commerce.context-owner');
  expect(() =>
    Schema.decodeUnknownSync(AssortmentTrustedCommerceContextRequestSchema)({
      channelRef: ref('commerce.channel', 'channel', 'web'),
      operationTime: instant,
      sellingLegalEntityRef: ref('commerce.legal-entity', 'legal-entity', 'sle-1'),
      tenantId,
    }),
  ).toThrow();

  expect(() =>
    Schema.decodeUnknownSync(AssortmentCustomerGroupMembershipRequestSchema)({
      asOf: instant,
      profileRef: ref(
        'commerce.customer-context',
        'commerce.customer-context.retail-customer-profile',
        'profile-1',
        otherTenantId,
      ),
      tenantId,
    }),
  ).toThrow();
  expect(() =>
    Schema.decodeUnknownSync(AssortmentFactCurrentnessRequestSchema)({
      factRef: ref('owner.fact', 'owner.fact.binding', 'fact-1', otherTenantId),
      observedAt: instant,
      tenantId,
    }),
  ).toThrow();
  expect(() =>
    Schema.decodeUnknownSync(AssortmentSetCompletenessRequestSchema)({
      asOf: instant,
      predicate: 'all current facts',
      scope: 'owner-defined exact set',
      scopeRef: ref('owner.set', 'owner.set.scope', 'set-1', otherTenantId),
      tenantId,
    }),
  ).toThrow();
});

it.effect('fails closed with sanitized owner failures and rejects incomplete Customer Context responses', () =>
  Effect.gen(function* failClosed() {
    const request = Schema.decodeUnknownSync(AssortmentFactCurrentnessRequestSchema)({
      factRef: ref('owner.currentness', 'owner.currentness.fact', 'fact-1'),
      observedAt: instant,
      tenantId,
    });
    const unavailable = yield* AssortmentOwnerEvidence.pipe(
      Effect.flatMap((ports) => ports.verifyFactCurrentness(request)),
      Effect.provide(AssortmentOwnerEvidenceUnavailableLive),
      Effect.flip,
    );
    expect(Schema.is(AssortmentDependencyFailureError)(unavailable)).toBe(true);

    const adapter = adaptCommerceCustomerGroupMemberships(
      () =>
        Effect.succeed({
          effectiveAt: instant,
          items: [],
          profile: { profileKind: 'RETAIL', profileRef: profileRef() },
        }),
      'correlation-1',
    );
    const failure = yield* adapter
      .resolveCustomerGroupMemberships(
        Schema.decodeUnknownSync(AssortmentCustomerGroupMembershipRequestSchema)({
          asOf: instant,
          profileRef: profileRef(),
          tenantId,
        }),
      )
      .pipe(Effect.flip);
    expect(Schema.is(AssortmentDependencyFailureError)(failure)).toBe(true);
  }),
);
