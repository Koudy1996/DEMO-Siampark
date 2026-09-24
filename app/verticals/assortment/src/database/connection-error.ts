import { Schema } from 'effect';

export class AssortmentDatabaseConnectionError extends Schema.TaggedError<AssortmentDatabaseConnectionError>()(
  'AssortmentDatabaseConnectionError',
  { reason: Schema.String },
) {}
