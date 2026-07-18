import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { similarity } from "@/lib/matching";
import { getProgramDetails, listPrograms } from "@/lib/server/catalog-service";
import { calculateCatalogScores } from "@/lib/server/score-service";
import { MATERIAL_TYPES } from "@/lib/types";

export const runtime = "nodejs";
const schema = z.object({ programIds: z.array(z.string().min(1)).min(2).max(8), materials: z.array(z.object({ type: z.enum(MATERIAL_TYPES), status: z.enum(["draft","ready","expired"]) })).max(100).optional() });

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    const ids = [...new Set(input.programIds)];
    if (ids.length < 2) return NextResponse.json({ error: "请选择至少两个不同项目。" }, { status: 400 });
    const [calculated, catalog] = await Promise.all([calculateCatalogScores(ids), listPrograms()]);
    const programs = calculated.comparisons.map((item) => item.program);
    if (programs.length !== ids.length) return NextResponse.json({ error: "部分项目不存在。" }, { status: 404 });
    const candidateDetails = await getProgramDetails(catalog.filter((item) => !ids.includes(item.id)).map((item) => item.id));
    const recommendations = candidateDetails.map((item) => ({ id: item.id, name: item.name, universities: item.universities.map((university) => university.shortName), similarity: similarity(programs[0], item) })).sort((a,b) => b.similarity-a.similarity).slice(0,5);
    return NextResponse.json({ comparisons: calculated.comparisons, exchangeRate: calculated.exchangeRate, recommendations, disclaimer: "竞争力分基于已确认的官网要求与个人证据；只有存在基础概率时才显示模型区间。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "比较失败。" }, { status: error instanceof z.ZodError ? 400 : 500 }); }
}
