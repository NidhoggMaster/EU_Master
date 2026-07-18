import { z } from "zod";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { getLocalMatchOverrides, saveLocalMatchOverride } from "@/lib/server/local-store";

export const runtime = "nodejs";
const inputSchema = z.object({
  id: z.string().max(100).optional(), programId: z.string().min(1).max(120), criterionId: z.string().min(1).max(120),
  state: z.enum(["matched", "partial", "not_matched", "unknown"]), note: z.string().max(2_000).default(""),
});

export async function GET(request: Request) {
  try {
    const ids = new URL(request.url).searchParams.get("programIds")?.split(",").filter(Boolean);
    return Response.json(await getLocalMatchOverrides(ids), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error, "读取课程匹配失败。"); }
}

export async function PUT(request: Request) {
  try {
    assertLocalMutation(request);
    const input = inputSchema.parse(await request.json());
    return Response.json(await saveLocalMatchOverride({ ...input, id: input.id ?? crypto.randomUUID(), updatedAt: new Date().toISOString() }));
  } catch (error) { return errorResponse(error, "保存课程匹配失败。"); }
}
