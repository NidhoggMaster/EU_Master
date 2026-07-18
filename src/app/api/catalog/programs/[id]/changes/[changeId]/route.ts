import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { decideFieldChange } from "@/lib/server/catalog-service";
import { assertLocalMutation } from "@/lib/server/local-api";

export const runtime = "nodejs";
const schema = z.object({ decision: z.enum(["accepted", "rejected"]) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; changeId: string }> }) {
  try {
    assertLocalMutation(request);
    const { id, changeId } = await context.params;
    const result = await decideFieldChange(id, changeId, schema.parse(await request.json()).decision);
    return result ? NextResponse.json(result) : NextResponse.json({ error: "找不到待审核变更。" }, { status: 404 });
  } catch (error) { const status = error instanceof z.ZodError ? 400 : error && typeof error === "object" && "status" in error ? Number(error.status) : 500; return NextResponse.json({ error: error instanceof Error ? error.message : "审核失败。" }, { status }); }
}
