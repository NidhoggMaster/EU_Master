import { NextResponse } from "next/server";
import { withDb } from "@/lib/server/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_SEEDED_PROGRAMS = 13;

export async function GET() {
  const firecrawlConfigured = Boolean(process.env.FIRECRAWL_API_KEY?.trim());
  try {
    const database = await withDb(async (client) => {
      const result = await client.query(`select current_user as role,
        count(*) filter (where seeded and status = 'active')::int as seeded_programs
        from private.programs`);
      const row = result.rows[0];
      return {
        connected: true,
        restrictedRole: row.role === "eu_master_backend",
        seededPrograms: Number(row.seeded_programs),
        expectedSeededPrograms: EXPECTED_SEEDED_PROGRAMS,
      };
    });
    const ready = database.restrictedRole && database.seededPrograms === EXPECTED_SEEDED_PROGRAMS && firecrawlConfigured;
    return NextResponse.json({
      status: ready ? "ready" : "incomplete",
      database,
      firecrawl: { configured: firecrawlConfigured },
    });
  } catch {
    return NextResponse.json({
      status: "error",
      database: {
        connected: false,
        restrictedRole: false,
        seededPrograms: 0,
        expectedSeededPrograms: EXPECTED_SEEDED_PROGRAMS,
      },
      firecrawl: { configured: firecrawlConfigured },
      error: "数据库健康检查失败，请检查服务端 Session Pool 配置。",
    }, { status: 503 });
  }
}
