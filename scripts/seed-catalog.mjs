import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const DEFAULT_EXPECTED_PROGRAMS = 13;
const DEFAULT_DELAY_MS = 6_000;
const DEFAULT_RETRY_DELAYS_MS = [15_000, 30_000];
const REQUEST_TIMEOUT_MS = 75_000;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function redact(message) {
  return String(message)
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[已隐藏数据库连接串]")
    .replace(/Bearer\s+\S+/gi, "Bearer [已隐藏]");
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function getJson(fetchImpl, url) {
  let response;
  try {
    response = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new Error(`无法连接开发服务 ${url.origin}，请先运行 pnpm dev。`);
  }
  const body = await readJson(response);
  if (!response.ok) throw new Error(body.error || `健康检查返回 HTTP ${response.status}`);
  return body;
}

async function recordCooldownSkip(fetchImpl, origin, program) {
  const response = await fetchImpl(new URL("/api/catalog/collection-skip", origin), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ programId: program.id, lastFetchedAt: program.lastFetchedAt }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await readJson(response);
  if (!response.ok) throw new Error(body.error || `无法记录 ${program.id} 的冷却跳过结果。`);
}

async function refreshWithRetry({ fetchImpl, url, retryDelays, waitImpl }) {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    let response;
    let body = {};
    try {
      response = await fetchImpl(url, { method: "POST", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      body = await readJson(response);
    } catch {
      if (attempt >= retryDelays.length) return { ok: false, status: 0, error: "网络连接或请求超时。" };
      await waitImpl(retryDelays[attempt]);
      continue;
    }
    if (response.ok) return { ok: true, body, status: response.status };
    if (response.status >= 500 && attempt < retryDelays.length) {
      await waitImpl(retryDelays[attempt]);
      continue;
    }
    return { ok: false, status: response.status, error: body.error || `HTTP ${response.status}` };
  }
  return { ok: false, status: 0, error: "未知抓取错误。" };
}

function silentLogger() {
  return { log() {}, error() {} };
}

export async function runCatalogSeed({
  baseUrl = process.env.EU_MASTER_BASE_URL || "http://localhost:3000",
  expectedPrograms = DEFAULT_EXPECTED_PROGRAMS,
  delayMs = DEFAULT_DELAY_MS,
  retryDelays = DEFAULT_RETRY_DELAYS_MS,
  fetchImpl = fetch,
  waitImpl = wait,
  logger = console,
} = {}) {
  const origin = new URL(baseUrl.replace(/\/$/, ""));
  const health = await getJson(fetchImpl, new URL("/api/health", origin));
  if (health.status !== "ready" || !health.storage?.local?.ready) throw new Error("本地 CSV 存储未通过健康检查。");

  const catalog = await getJson(fetchImpl, new URL("/api/catalog/programs", origin));
  if (!Array.isArray(catalog)) throw new Error("项目目录接口返回了无效数据。");
  const programs = catalog
    .filter((program) => program.seeded === true && program.status === "active")
    .sort((left, right) => {
      const leftUniversity = left.institutionIds?.[0] || "";
      const rightUniversity = right.institutionIds?.[0] || "";
      return leftUniversity.localeCompare(rightUniversity) || left.name.localeCompare(right.name);
    });
  if (programs.length !== expectedPrograms) {
    throw new Error(`预置项目数量应为 ${expectedPrograms}，实际为 ${programs.length}；为避免错误抓取，任务已停止。`);
  }

  const summary = {
    total: programs.length,
    succeeded: [],
    skipped: [],
    failed: [],
    providers: { firecrawl: 0, direct: 0 },
    pendingReview: 0,
  };

  logger.log(`[catalog:seed] ${health.storage.catalogMode} 模式健康检查通过，共 ${programs.length} 个预置项目。`);
  if (!health.storage.firecrawl?.configured) logger.log("[catalog:seed] Firecrawl 未配置，将使用合规直连。");
  let attempted = 0;
  for (const program of programs) {
    if (program.lastFetchedAt && Date.now() - new Date(program.lastFetchedAt).getTime() < 24 * 60 * 60 * 1000) {
      await recordCooldownSkip(fetchImpl, origin, program);
      summary.skipped.push(program.id);
      logger.log(`[skip] ${program.id}: 仍在 24 小时冷却期`);
      continue;
    }
    if (attempted > 0 && delayMs > 0) await waitImpl(delayMs);
    attempted += 1;
    const result = await refreshWithRetry({
      fetchImpl,
      url: new URL(`/api/catalog/programs/${encodeURIComponent(program.id)}/refresh`, origin),
      retryDelays,
      waitImpl,
    });
    if (!result.ok) {
      const failure = { id: program.id, status: result.status, error: redact(result.error) };
      summary.failed.push(failure);
      logger.error(`[fail] ${program.id}: ${failure.error}`);
      continue;
    }
    const provider = result.body.provider === "firecrawl" ? "firecrawl" : "direct";
    const reviewCount = Array.isArray(result.body.reviewItems) ? result.body.reviewItems.length : 0;
    summary.providers[provider] += 1;
    summary.pendingReview += reviewCount;
    summary.succeeded.push(program.id);
    logger.log(`[ok] ${program.id}: ${provider}, ${reviewCount} 项待审核`);
  }

  logger.log("[catalog:seed] 完成汇总");
  logger.log(`  成功 ${summary.succeeded.length} · 跳过 ${summary.skipped.length} · 失败 ${summary.failed.length}`);
  logger.log(`  Firecrawl ${summary.providers.firecrawl} · 合规直连 ${summary.providers.direct} · 待审核 ${summary.pendingReview}`);
  return summary;
}

async function main() {
  try {
    const summary = await runCatalogSeed();
    if (summary.failed.length) process.exitCode = 1;
  } catch (error) {
    console.error(`[catalog:seed] ${redact(error instanceof Error ? error.message : "任务失败。")}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

export { redact, refreshWithRetry, silentLogger };
