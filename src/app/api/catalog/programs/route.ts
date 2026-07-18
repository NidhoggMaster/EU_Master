import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PROGRAM_CATEGORIES } from "@/lib/types";
import { validateOfficialUrl } from "@/lib/catalog-server";
import { getUniversity, listPrograms, upsertCandidate } from "@/lib/server/catalog-service";
import { assertLocalMutation } from "@/lib/server/local-api";

export const runtime = "nodejs";
const candidateSchema = z.object({ universityId: z.string().min(1).max(80), name: z.string().min(3).max(180), category: z.enum(PROGRAM_CATEGORIES), sourceUrl: z.url().refine((url) => url.startsWith("https://")), status: z.enum(["active", "candidate"]).optional() });

export async function GET(request: NextRequest) {
  const universityId = request.nextUrl.searchParams.get("universityId") || undefined;
  const categoryValue = request.nextUrl.searchParams.get("category");
  const category = categoryValue ? z.enum(PROGRAM_CATEGORIES).safeParse(categoryValue) : undefined;
  if (category && !category.success) return NextResponse.json({ error: "项目类型无效。" }, { status: 400 });
  try { return NextResponse.json(await listPrograms({ universityId, category: category?.data })); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "读取项目失败。" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    assertLocalMutation(request);
    const input = candidateSchema.parse(await request.json());
    const university = await getUniversity(input.universityId);
    if (!university) return NextResponse.json({ error: "找不到所选学校。" }, { status: 404 });
    validateOfficialUrl(input.sourceUrl, university);
    return NextResponse.json(await upsertCandidate(input), { status: 201 });
  }
  catch (error) { const status = error instanceof z.ZodError ? 400 : error && typeof error === "object" && "status" in error ? Number(error.status) : 500; return NextResponse.json({ error: error instanceof Error ? error.message : "保存候选项目失败。" }, { status }); }
}
