import type { DatabasePoolDeadlines } from '@app/core-runtime';
import { DatabaseConfig, configureDatabasePool } from '@app/core-runtime';
import { PgClient } from '@effect/sql-pg';
import { makeWithDefaults } from 'drizzle-orm/effect-postgres';
import type { Scope } from 'effect';
import { Context, Effect, Layer, Redacted } from 'effect';
import { Reactivity } from 'effect/unstable/reactivity';
import type { PoolConfig } from 'pg';
import { Pool } from 'pg';
import { AssortmentDatabaseConnectionError } from './connection-error.ts';
import { assortmentRelations } from './schema.ts';
import type { AssortmentDatabaseExecutor } from './types.ts';

export class AssortmentDatabase extends Context.Service<
  AssortmentDatabase,
  { readonly executor: AssortmentDatabaseExecutor }
>()('@app/assortment/database/client/AssortmentDatabase') {}

interface AssortmentPoolResource {
  // eslint-disable-next-line effect-native/no-promise-shaped-port -- pg is the only foreign resource at this boundary; remove-when: pool driver exposes Effect finalizers.
  readonly end: () => Promise<void>;
}

const failure = (cause: unknown): AssortmentDatabaseConnectionError =>
  Object.defineProperty(
    new AssortmentDatabaseConnectionError({ reason: 'Unable to initialize the Assortment PostgreSQL connection pool' }),
    'cause',
    { value: cause },
  );

const acquirePool = <Resource extends AssortmentPoolResource>(
  acquire: () => Resource,
): Effect.Effect<Resource, AssortmentDatabaseConnectionError, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.try({ catch: failure, try: acquire }),
    // pg overloads end(callback); invoke it with no arguments so the AbortSignal is never a callback.
    // eslint-disable-next-line typescript/promise-function-async -- Effect owns this foreign Promise boundary.
    (pool) => Effect.promise(() => pool.end()),
  );

export type AssortmentPoolFactory = (configuration: PoolConfig) => Pool;
const defaultPoolFactory: AssortmentPoolFactory = (configuration) => new Pool(configuration);

type ContextServiceContract<Service> =
  Service extends Context.Key<infer _Identifier, infer Contract> ? Contract : never;

export const makeAssortmentDatabase = Effect.fn('AssortmentDatabase.make')(function* makeDatabase(
  configuration: ContextServiceContract<typeof DatabaseConfig> & {
    readonly poolDeadlines?: Partial<DatabasePoolDeadlines>;
  },
  poolFactory: AssortmentPoolFactory = defaultPoolFactory,
) {
  const poolConfiguration = yield* configureDatabasePool(
    Redacted.make(configuration.connectionString),
    configuration.poolDeadlines,
  ).pipe(Effect.mapError((error) => new AssortmentDatabaseConnectionError({ reason: error.reason })));
  const pool = yield* acquirePool(() => poolFactory(poolConfiguration));
  const reactivity = yield* Reactivity.make;
  const client = yield* PgClient.fromPool({ acquire: Effect.succeed(pool) }).pipe(
    // oxlint-disable-next-line effect-native/no-effect-provide-in-library -- The native PgClient must receive the acquired pool-local Reactivity service; remove-when: PgClient exposes a pool-scoped Layer constructor.
    Effect.provideService(Reactivity.Reactivity, reactivity),
    Effect.mapError(failure),
  );
  return {
    executor: yield* makeWithDefaults({ relations: assortmentRelations }).pipe(
      // oxlint-disable-next-line effect-native/no-effect-provide-in-library -- Drizzle's owner-local executor must receive its acquired PgClient; remove-when: makeWithDefaults accepts an Effect service layer.
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
