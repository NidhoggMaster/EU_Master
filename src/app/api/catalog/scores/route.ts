import { z } from "zod";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { confirmCatalogScores, latestCatalogScores } from "@/lib/server/score-service";

export const runtime = "nodejs";
const inputSchema = z.object({ programIds: z.array(z.string().min(1).max(120)).min(1).max(100) });

export async function GET(request: Request) {
  try {
    const ids = new URL(request.url).searchParams.get("programIds")?.split(",").filter(Boolean);
    return Response.json(await latestCatalogScores(ids), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error, "读取评分快照失败。"); }
}

export async function POST(request: Request) {
  try {
    assertLocalMutation(request);
    const input = inputSchema.parse(await request.json());
    return Response.json(await confirmCatalogScores(input.programIds), { status: 201 });
  } catch (error) { return errorResponse(error, "确认评分失败。"); }
}
