import { Pool, PoolClient } from "pg";

// Pool único reutilizado entre hot-reloads do Next.js em dev (evita esgotar
// conexões do Postgres local a cada refresh).
declare global {
  // eslint-disable-next-line no-var
  var __more360LitePool: Pool | undefined;
}

export const pool =
  global.__more360LitePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  global.__more360LitePool = pool;
}

export async function query<T = unknown>(text: string, params?: unknown[]) {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

/**
 * Roda várias queries numa transação só (BEGIN/COMMIT, ROLLBACK em erro).
 * Usado pelas conexões entre módulos (ex: Encomenda entregue → lança no
 * Financeiro) — ou as duas escritas acontecem juntas, ou nenhuma acontece.
 */
export async function withTransaction<T>(
  fn: (tx: <R = unknown>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>
): Promise<T> {
  const client: PoolClient = await pool.connect();
  const tx = async <R = unknown>(text: string, params?: unknown[]) => {
    const result = await client.query(text, params);
    return result.rows as R[];
  };
  try {
    await client.query("BEGIN");
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
