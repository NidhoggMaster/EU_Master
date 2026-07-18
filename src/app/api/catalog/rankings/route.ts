import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { applyQsRankingData } from "@/lib/server/ranking-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertLocalMutation(request);
    return Response.json(await applyQsRankingData());
  } catch (error) {
    return errorResponse(error, "同步 QS 排名失败。");
  }
}
