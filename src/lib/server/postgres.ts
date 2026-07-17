import "server-only";

import { Pool, type PoolClient } from "pg";

declare global {
  var euMasterPostgresPool: Pool | undefined;
}

function sessionPoolUrl() {
  const raw = process.env.SUPABASE_SESSION_POOLER_URL || process.env.SUPABASE_SESSION_POOL_URL;
  if (!raw) throw new Error("缺少 SUPABASE_SESSION_POOLER_URL，无法连接项目数据库。");
  const url = new URL(raw);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("SUPABASE_SESSION_POOLER_URL 必须是 PostgreSQL 连接地址。");
  if (url.port !== "5432" || !url.hostname.endsWith(".pooler.supabase.com")) {
    throw new Error("SUPABASE_SESSION_POOLER_URL 必须使用 Supavisor Session Pool（pooler.supabase.com:5432）。");
  }
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

function poolSize() {
  const requested = Number.parseInt(process.env.SUPABASE_SESSION_POOL_MAX || "3", 10);
  return Number.isFinite(requested) ? Math.min(3, Math.max(1, requested)) : 3;
}

export function getPool() {
  globalThis.euMasterPostgresPool ??= new Pool({
    connectionString: sessionPoolUrl(),
    max: poolSize(),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: true,
    application_name: "eu-master-next-backend",
    ssl: { rejectUnauthorized: true },
  });
  return globalThis.euMasterPostgresPool;
}

export async function withDb<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role eu_master_backend");
    await client.query("set local statement_timeout = '10s'");
    await client.query("set local idle_in_transaction_session_timeout = '15s'");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
