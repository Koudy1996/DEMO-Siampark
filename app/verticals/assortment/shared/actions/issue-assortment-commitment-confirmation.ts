// oxlint-disable-next-line unicorn/prefer-export-from -- Codesmith requires concrete bindings; remove-when: Action HTTP discovery supports direct re-exports.
import {
  AssortmentCommitmentConfirmationPayloadSchema,
  AssortmentCommitmentConfirmationResultSchema,
} from '../domain/commitment-confirmation.ts';

export type { AssortmentCommitmentConfirmationPayload as IssueAssortmentCommitmentConfirmationPayload } from '../domain/commitment-confirmation.ts';

export const IssueAssortmentCommitmentConfirmationPayloadSchema = AssortmentCommitmentConfirmationPayloadSchema;
export const IssueAssortmentCommitmentConfirmationResultSchema = AssortmentCommitmentConfirmationResultSchema;
