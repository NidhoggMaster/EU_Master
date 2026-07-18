const baseUrl = process.env.EU_MASTER_BASE_URL || "http://127.0.0.1:3000";

async function main() {
  try {
    const response = await fetch(new URL("/api/catalog/expansion", baseUrl), { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    console.log(`[catalog:expand] 本地 ${body.local.programs} 个新增项目、Supabase ${body.supabase.programs} 个新增项目及 ${body.local.universities} 所学校生活费已同步。`);
  } catch (error) {
    console.error(`[catalog:expand] ${error instanceof Error ? error.message : "同步失败。"}`);
    process.exitCode = 1;
  }
}

await main();
