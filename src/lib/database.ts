
import { Pool, type PoolClient } from "pg";

declare global {
  var uevsPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return new Pool({
    connectionString,
    max: 12,
    idleTimeoutMillis: 30_000,
  });
}

/**
 * Lazily initializes and returns the PostgreSQL connection pool.
 */
export function getDatabase(): Pool {
  if (!globalThis.uevsPool) {
    globalThis.uevsPool = createPool();
  }

  return globalThis.uevsPool;
}

/**
 * Executes an operation within a database transaction.
 */
export async function inTransaction<T>(
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getDatabase().connect();

  try {
    await client.query("BEGIN");

    const result = await operation(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}











// import { Pool, type PoolClient } from "pg";

// declare global {
//   // eslint-disable-next-line no-var
//   var uevsPool: Pool | undefined;
// }

// function createPool() {
//   const connectionString = process.env.DATABASE_URL;
//   if (!connectionString) throw new Error("DATABASE_URL is not configured.");
//   return new Pool({ connectionString, max: 12, idleTimeoutMillis: 30_000 });
// }

// export const database = globalThis.uevsPool ?? createPool();
// if (process.env.NODE_ENV !== "production") globalThis.uevsPool = database;

// export async function inTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
//   const client = await database.connect();
//   try {
//     await client.query("BEGIN");
//     const result = await operation(client);
//     await client.query("COMMIT");
//     return result;
//   } catch (error) {
//     await client.query("ROLLBACK");
//     throw error;
//   } finally {
//     client.release();
//   }
// }
