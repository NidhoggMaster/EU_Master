import { NextResponse } from "next/server";
import { z } from "zod";
import { CatalogFetchError, discoverPrograms } from "@/lib/catalog-server";
import { PROGRAM_CATEGORIES } from "@/lib/types";

const requestSchema = z.object({
  universityId: z.string().min(1).max(40),
  category: z.enum(PROGRAM_CATEGORIES),
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    return NextResponse.json(await discoverPrograms(input.universityId, input.category));
  } catch (error) {
    if (error instanceof CatalogFetchError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "项目发现参数不正确。" }, { status: 400 });
    return NextResponse.json({ error: "项目发现暂时不可用。" }, { status: 500 });
  }
}
