import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { calculateApplicationScore, confirmApplicationScore, latestApplicationScore } from "@/lib/server/application-score-service";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    return Response.json({ latest: await latestApplicationScore(id), preview: await calculateApplicationScore(id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error, "读取申请评分失败。"); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalMutation(request);
    return Response.json(await confirmApplicationScore((await context.params).id), { status: 201 });
  } catch (error) { return errorResponse(error, "确认申请评分失败。"); }
}
