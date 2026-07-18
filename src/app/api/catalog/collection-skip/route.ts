import { z } from "zod";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { recordLocalCollectionSkip } from "@/lib/server/local-store";

export const runtime = "nodejs";
const schema = z.object({ programId: z.string().min(1).max(100), lastFetchedAt: z.string().datetime() });

export async function POST(request: Request) {
  try {
    assertLocalMutation(request);
    const input = schema.parse(await request.json());
    await recordLocalCollectionSkip(input.programId, input.lastFetchedAt);
    return Response.json({ recorded: true });
  } catch (error) {
    return errorResponse(error, "记录抓取跳过结果失败。");
  }
}
