import { Effect, Schema } from 'effect';
import type { HttpClientError } from '@modern-js/bff-effect/effect-client';

import { AssortmentDependencyFailureError } from '../../shared/domain/decision-contracts.ts';
import type {
  AssortmentCustomerGroupMembershipRequest,
  AssortmentOwnerEvidencePort,
} from '../../shared/domain/ports/owner-evidence.ts';
import type { AssortmentOwnerModuleId as OwnerModuleId } from '../../shared/domain/decision-contracts.ts';
import { AssortmentCustomerGroupMembershipSetSchema } from '../../shared/domain/ports/owner-evidence.ts';

const InstantSchema = Schema.DateTimeUtcFromString;

export interface CommerceCustomerGroupMembershipOwnerRequest {
  readonly asOf: string;
  readonly profile: {
    readonly profileKind: 'COUNTERPARTY' | 'RETAIL';
    readonly profileRef: AssortmentCustomerGroupMembershipRequest['profileRef'];
  };
}

export type CommerceCustomerGroupMembershipExecutor = (
  request: CommerceCustomerGroupMembershipOwnerRequest,
  requestCorrelation: string,
) => Effect.Effect<unknown, HttpClientError.HttpClientError | Schema.SchemaError>;

const dependencyFailure = (ownerModuleId: OwnerModuleId, safeReasonCode = 'DEPENDENCY_UNAVAILABLE' as const) =>
  new AssortmentDependencyFailureError({
    code: 'DEPENDENCY_FAILURE',
    ownerModuleId,
    retryable: true,
    safeReasonCode,
  });

const profileKind = (resourceType: string): 'COUNTERPARTY' | 'RETAIL' =>
  resourceType.endsWith('.counterparty-purchasing-profile') ? 'COUNTERPARTY' : 'RETAIL';

const sanitizeFailure = (ownerModuleId: OwnerModuleId) => () => dependencyFailure(ownerModuleId);

/**
 * Adapts the published Commerce Customer Context read only when its response carries the
 * Assortment completeness proof. The current generated response has items/effectiveAt/profile but
 * no owner-verifiable proof, so it fails closed instead of treating a successful query as complete.
 */
export const adaptCommerceCustomerGroupMemberships = (
  execute: CommerceCustomerGroupMembershipExecutor,
  requestCorrelation: string,
): Pick<AssortmentOwnerEvidencePort, 'resolveCustomerGroupMemberships'> => ({
  resolveCustomerGroupMemberships: (request) => {
    const ownerModuleId = request.profileRef.moduleId;
    if (requestCorrelation.trim().length === 0 || requestCorrelation !== requestCorrelation.trim()) {
      return Effect.fail(dependencyFailure(ownerModuleId));
    }
    return Schema.encodeUnknownEffect(InstantSchema)(request.asOf).pipe(
      Effect.flatMap((asOf) =>
        execute(
          {
            asOf,
            profile: {
              profileKind: profileKind(request.profileRef.resourceType),
              profileRef: request.profileRef,
            },
          },
          requestCorrelation,
        ),
      ),
      Effect.filterOrFail(Schema.is(AssortmentCustomerGroupMembershipSetSchema), () =>
        dependencyFailure(ownerModuleId),
      ),
      Effect.mapError(sanitizeFailure(ownerModuleId)),
    );
  },
});
