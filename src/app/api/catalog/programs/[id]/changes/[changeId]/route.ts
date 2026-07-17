import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { decideFieldChange } from "@/lib/server/catalog-repository";

export const runtime = "nodejs";
const schema = z.object({ decision: z.enum(["accepted", "rejected"]) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; changeId: string }> }) {
  try {
    const { id, changeId } = await context.params;
    const result = await decideFieldChange(id, changeId, schema.parse(await request.json()).decision);
    return result ? NextResponse.json(result) : NextResponse.json({ error: "找不到待审核变更。" }, { status: 404 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "审核失败。" }, { status: error instanceof z.ZodError ? 400 : 500 }); }
}
