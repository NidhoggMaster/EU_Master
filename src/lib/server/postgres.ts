import "server-only";

import { readFileSync } from "node:fs";
import { Pool, type PoolClient } from "pg";

declare global {
  var euMasterPostgresPool: Pool | undefined;
}

function sessionPoolConfig() {
  const raw = process.env.SUPABASE_SESSION_POOLER_URL || process.env.SUPABASE_SESSION_POOL_URL;
  if (!raw) throw new Error("缺少 SUPABASE_SESSION_POOLER_URL，无法连接项目数据库。");
  if (/YOUR_|PASSWORD/i.test(raw)) throw new Error("SUPABASE_SESSION_POOLER_URL 仍包含占位密码。");
  const url = new URL(raw);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("SUPABASE_SESSION_POOLER_URL 必须是 PostgreSQL 连接地址。");
  if (url.port !== "5432" || !url.hostname.endsWith(".pooler.supabase.com")) {
    throw new Error("SUPABASE_SESSION_POOLER_URL 必须使用 Supavisor Session Pool（pooler.supabase.com:5432）。");
  }
  const caPath = process.env.SUPABASE_CA_CERT_PATH?.trim();
  if (!caPath) throw new Error("缺少 SUPABASE_CA_CERT_PATH，无法执行 verify-full 证书校验。");
  let ca: string;
  try {
    ca = readFileSync(caPath, "utf8");
  } catch {
    throw new Error("无法读取 SUPABASE_CA_CERT_PATH 指向的证书文件。");
  }
  if (!ca.includes("BEGIN CERTIFICATE")) throw new Error("SUPABASE_CA_CERT_PATH 不是有效的 PEM 证书。");
  return {
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "") || "postgres"),
    ssl: { ca, rejectUnauthorized: true },
  };
}

function poolSize() {
  const requested = Number.parseInt(process.env.SUPABASE_SESSION_POOL_MAX || "3", 10);
  return Number.isFinite(requested) ? Math.min(3, Math.max(1, requested)) : 3;
}

export function getPool() {
  globalThis.euMasterPostgresPool ??= new Pool({
    ...sessionPoolConfig(),
    max: poolSize(),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: true,
    application_name: "eu-master-next-backend",
  });
  return globalThis.euMasterPostgresPool;
}

export function isSupabaseConfigured() {
  try {
    sessionPoolConfig();
    return true;
  } catch {
    return false;
  }
}

export async function checkSupabaseHealth() {
  return withDb(async (client) => {
    const result = await client.query(`select current_user as role,
      count(*) filter (where seeded and status = 'active')::int as seeded_programs
      from private.programs`);
    const row = result.rows[0];
    return {
      connected: true,
      restrictedRole: row.role === "eu_master_backend",
      seededPrograms: Number(row.seeded_programs),
    };
  });
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
