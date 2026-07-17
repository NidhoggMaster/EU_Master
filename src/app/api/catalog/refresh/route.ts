import { NextResponse } from "next/server";
import { z } from "zod";
import { CatalogFetchError, refreshProgram } from "@/lib/catalog-server";

const requestSchema = z.object({
  programId: z.string().min(1).max(120),
  universityId: z.string().min(1).max(40),
  sourceUrl: z.string().url().max(500),
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    return NextResponse.json(await refreshProgram(input.universityId, input.sourceUrl));
  } catch (error) {
    if (error instanceof CatalogFetchError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "项目更新参数不正确。" }, { status: 400 });
    return NextResponse.json({ error: "官网数据更新暂时不可用。" }, { status: 500 });
  }
}
