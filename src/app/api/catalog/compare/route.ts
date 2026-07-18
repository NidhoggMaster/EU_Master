import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { compareProgram, similarity } from "@/lib/matching";
import { emptyProfile } from "@/lib/progress";
import { getProgramDetails, listPrograms } from "@/lib/server/catalog-service";
import { getLocalProfile } from "@/lib/server/local-store";
import { getEurCnyRate } from "@/lib/server/exchange-rates";
import { MATERIAL_TYPES } from "@/lib/types";

export const runtime = "nodejs";
const schema = z.object({ programIds: z.array(z.string().min(1)).min(2).max(4), materials: z.array(z.object({ type: z.enum(MATERIAL_TYPES), status: z.enum(["draft","ready","expired"]) })).max(100) });

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    const ids = [...new Set(input.programIds)];
    if (ids.length < 2) return NextResponse.json({ error: "请选择至少两个不同项目。" }, { status: 400 });
    const [programs, profile, exchangeRate, catalog] = await Promise.all([getProgramDetails(ids), getLocalProfile(), getEurCnyRate(), listPrograms()]);
    if (programs.length !== ids.length) return NextResponse.json({ error: "部分项目不存在。" }, { status: 404 });
    const ready = input.materials.filter((item) => item.status === "ready").map((item) => item.type);
    const candidateDetails = await getProgramDetails(catalog.filter((item) => !ids.includes(item.id)).map((item) => item.id));
    const recommendations = candidateDetails.map((item) => ({ id: item.id, name: item.name, universities: item.universities.map((university) => university.shortName), similarity: similarity(programs[0], item) })).sort((a,b) => b.similarity-a.similarity).slice(0,5);
    return NextResponse.json({ comparisons: programs.map((program) => compareProgram(program, profile ?? emptyProfile(), ready, exchangeRate.rate, programs[0])), exchangeRate, recommendations, disclaimer: "匹配度参考仅依据官网明确要求和已填写证据计算，不代表录取概率。" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "比较失败。" }, { status: error instanceof z.ZodError ? 400 : 500 }); }
}
