import { NextResponse } from "next/server";
import { z } from "zod";
import { CatalogFetchError, discoverProgramsForUniversity } from "@/lib/catalog-server";
import { getUniversity, listPrograms, upsertCandidate } from "@/lib/server/catalog-service";
import { assertLocalMutation } from "@/lib/server/local-api";
import { PROGRAM_CATEGORIES } from "@/lib/types";

const requestSchema = z.object({
  universityId: z.string().min(1).max(40),
  category: z.enum(PROGRAM_CATEGORIES),
});

export async function POST(request: Request) {
  try {
    assertLocalMutation(request);
    const input = requestSchema.parse(await request.json());
    const university = await getUniversity(input.universityId);
    if (!university) return NextResponse.json({ error: "找不到所选大学。" }, { status: 404 });
    const existingPrograms = await listPrograms({ universityId: input.universityId, category: input.category });
    const result = await discoverProgramsForUniversity(university, input.category);
    const candidates = await Promise.all(result.candidates.map(async (candidate) => {
      const stored = await upsertCandidate({ universityId: candidate.universityId, name: candidate.name, category: candidate.category, sourceUrl: candidate.sourceUrl, status: "candidate" });
      return { ...candidate, id: stored?.id, alreadyActive: existingPrograms.some((program) => program.sourceUrl === candidate.sourceUrl) };
    }));
    return NextResponse.json({ ...result, candidates, existingPrograms });
  } catch (error) {
    if (error instanceof CatalogFetchError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "项目发现参数不正确。" }, { status: 400 });
    if (error && typeof error === "object" && "status" in error) return NextResponse.json({ error: error instanceof Error ? error.message : "请求来源无效。" }, { status: Number(error.status) });
    return NextResponse.json({ error: "项目发现暂时不可用。" }, { status: 500 });
  }
}
