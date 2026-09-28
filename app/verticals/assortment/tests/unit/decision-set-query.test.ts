import { DateTime, Schema } from 'effect';
import { expect, it } from 'effect-rstest';
import {
  AssortmentApplicableBoundaryQueryV1Schema,
  AssortmentOrdinaryCandidateQueryV1Schema,
} from '../../shared/domain/decision-set-query.ts';

const tenantId = '10000000-0000-4000-8000-000000000001';
const legalEntityId = '30000000-0000-4000-8000-000000000001';
const at = DateTime.makeUnsafe(new Date('2026-09-28T09:00:00.000Z'));
const ref = (moduleId: string, resourceId: string, resourceType: string) => ({
  moduleId,
  resourceId,
  resourceType,
  tenantId,
});
const trustedContext = {
  channelRef: ref('commerce.channel', 'channel-1', 'commerce.channel.channel'),
  operationTime: at,
  sellingLegalEntityRef: ref('party.registry', legalEntityId, 'party.registry.legal-entity'),
  tenantId,
};

it('accepts exact tenant, legal entity, and transaction time for a complete Boundary query', () => {
  expect(
    Schema.is(AssortmentApplicableBoundaryQueryV1Schema)({
      decisionPurpose: 'PURCHASE',
      kind: 'APPLICABLE_BOUNDARIES',
      legalEntityId,
      operationTime: at,
      subject: {
        kind: 'RETAIL_CUSTOMER_PROFILE',
        profileRef: ref('commerce.customer-context', 'profile-1', 'commerce.customer-context.retail-customer-profile'),
      },
      target: { kind: 'PRODUCT', productRef: ref('commerce.catalog', 'product-1', 'commerce.catalog.product') },
      tenantId,
      trustedContext,
      version: 1,
    }),
  ).toBe(true);
});

it('rejects Candidate queries that change the trusted operation instant', () => {
  expect(
    Schema.is(AssortmentOrdinaryCandidateQueryV1Schema)({
      decisionPurpose: 'PURCHASE',
      kind: 'ORDINARY_CANDIDATES',
      legalEntityId,
      operationTime: DateTime.makeUnsafe(new Date('2026-09-28T09:00:01.000Z')),
      subject: {
        kind: 'IDENTIFIED',
        subject: {
          kind: 'RETAIL_CUSTOMER_PROFILE',
          profileRef: ref(
            'commerce.customer-context',
            'profile-1',
            'commerce.customer-context.retail-customer-profile',
          ),
        },
      },
      target: { kind: 'PRODUCT', productRef: ref('commerce.catalog', 'product-1', 'commerce.catalog.product') },
      tenantId,
      trustedContext,
      version: 1,
    }),
  ).toBe(false);
});

it('rejects cross-tenant targets even when the trusted context itself is valid', () => {
  expect(
    Schema.is(AssortmentApplicableBoundaryQueryV1Schema)({
      decisionPurpose: 'PURCHASE',
      kind: 'APPLICABLE_BOUNDARIES',
      legalEntityId,
      operationTime: at,
      subject: {
        counterpartyRef: ref('party.registry', 'counterparty-1', 'party.registry.counterparty'),
        kind: 'COUNTERPARTY',
      },
      target: {
        kind: 'PRODUCT',
        productRef: {
          ...ref('commerce.catalog', 'product-1', 'commerce.catalog.product'),
          tenantId: '40000000-0000-4000-8000-000000000001',
        },
      },
      tenantId,
      trustedContext,
      version: 1,
    }),
  ).toBe(false);
});
