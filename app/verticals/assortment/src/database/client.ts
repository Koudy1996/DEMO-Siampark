import type { DatabasePoolDeadlines } from '@app/core-runtime';
import { DatabaseConfig, configureDatabasePool } from '@app/core-runtime';
import { PgClient } from '@effect/sql-pg';
import { makeWithDefaults } from 'drizzle-orm/effect-postgres';
import { Context, Effect, Layer, Redacted } from 'effect';
import { Reactivity } from 'effect/unstable/reactivity';
import { AssortmentDatabaseConnectionError } from './connection-error.ts';
import { assortmentRelations } from './schema.ts';
import type { AssortmentDatabaseExecutor } from './types.ts';

export class AssortmentDatabase extends Context.Service<
  AssortmentDatabase,
  { readonly executor: AssortmentDatabaseExecutor }
>()('@app/assortment/database/client/AssortmentDatabase') {}

const connectionFailure = (cause: unknown): AssortmentDatabaseConnectionError =>
  new AssortmentDatabaseConnectionError({
    cause,
    reason: 'Unable to initialize the Assortment native PostgreSQL client',
  });

type ContextServiceContract<Service> =
  Service extends Context.Key<infer _Identifier, infer Contract> ? Contract : never;

export const makeAssortmentDatabase = Effect.fn('AssortmentDatabase.make')(function* makeDatabase(
  configuration: ContextServiceContract<typeof DatabaseConfig> & {
    readonly poolDeadlines?: Partial<DatabasePoolDeadlines>;
  },
) {
  const poolConfiguration = yield* configureDatabasePool(
    Redacted.make(configuration.connectionString),
    configuration.poolDeadlines,
  ).pipe(Effect.mapError((error) => new AssortmentDatabaseConnectionError({ reason: error.reason })));
  const reactivity = yield* Reactivity.make;
  const client = yield* PgClient.make(poolConfiguration).pipe(
    // oxlint-disable-next-line effect-native/no-effect-provide-in-library -- PgClient requires the owner-local Reactivity service during scoped acquisition; expires: 2027-03-31.
    Effect.provideService(Reactivity.Reactivity, reactivity),
    Effect.mapError(connectionFailure),
  );
  return {
    executor: yield* makeWithDefaults({ relations: assortmentRelations }).pipe(
      // oxlint-disable-next-line effect-native/no-effect-provide-in-library -- Drizzle requires the acquired owner-local PgClient; expires: 2027-03-31.
      Effect.provideService(PgClient.PgClient, client),
    ),
  };
});

export const AssortmentDatabaseLive = Layer.effect(
  AssortmentDatabase,
  Effect.gen(function* makeAssortmentDatabaseService() {
    return yield* makeAssortmentDatabase(yield* DatabaseConfig);
  }),
);
