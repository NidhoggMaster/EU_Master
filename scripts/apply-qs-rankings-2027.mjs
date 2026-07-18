const baseUrl = process.env.EU_MASTER_BASE_URL || "http://127.0.0.1:3000";

async function main() {
  try {
    const response = await fetch(new URL("/api/catalog/rankings", baseUrl), { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    console.log(`[catalog:rankings] 本地学校 ${body.local.universities} 所、本地项目 ${body.local.programs} 个、Supabase 项目 ${body.supabase.programs} 个已更新。`);
  } catch (error) {
    console.error(`[catalog:rankings] ${error instanceof Error ? error.message : "同步失败。"}`);
    process.exitCode = 1;
  }
}

await main();
