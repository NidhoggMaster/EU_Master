import { z } from "zod";
import { MATCH_DIMENSIONS } from "@/lib/types";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { getScoringSettings, saveScoringSettings } from "@/lib/server/scoring-settings";

export const runtime = "nodejs";
const weights = z.record(z.enum(MATCH_DIMENSIONS), z.number().min(0).max(100));
const inputSchema = z.object({ catalog: weights, application: weights });

export async function GET() {
  try { return Response.json(await getScoringSettings(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error, "读取评分权重失败。"); }
}

export async function PUT(request: Request) {
  try {
    assertLocalMutation(request);
    return Response.json(await saveScoringSettings(inputSchema.parse(await request.json())));
  } catch (error) { return errorResponse(error, "保存评分权重失败。"); }
}
