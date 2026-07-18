import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProgramDetail, updateProgram } from "@/lib/server/catalog-service";
import { assertLocalMutation } from "@/lib/server/local-api";
import { validateOfficialUrl } from "@/lib/catalog-server";
import type { Program } from "@/lib/types";

export const runtime = "nodejs";
const programSchema = z.object({ id: z.string().min(1), institutionIds: z.array(z.string()), name: z.string().min(2).max(180), categories: z.array(z.enum(["business","information","computer","data"])).min(1), sourceUrl: z.url().refine((url) => url.startsWith("https://")), requirements: z.array(z.unknown()), coreCourses: z.array(z.unknown()), admissionCriteria: z.array(z.unknown()), status: z.enum(["active","candidate","archived"]) }).passthrough();

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try { const item = await getProgramDetail((await context.params).id); return item ? NextResponse.json(item) : NextResponse.json({ error: "找不到项目。" }, { status: 404 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "读取项目失败。" }, { status: 500 }); }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalMutation(request);
    const parsed = programSchema.parse(await request.json());
    if (parsed.id !== (await context.params).id) return NextResponse.json({ error: "项目 ID 不一致。" }, { status: 409 });
    const current = await getProgramDetail(parsed.id);
    if (!current) return NextResponse.json({ error: "找不到项目。" }, { status: 404 });
    if (!current.universities.some((university) => { try { validateOfficialUrl(parsed.sourceUrl, university); return true; } catch { return false; } })) return NextResponse.json({ error: "项目链接不属于已关联学校的官方域名。" }, { status: 400 });
    return NextResponse.json(await updateProgram(parsed as unknown as Program));
  } catch (error) { const status = error instanceof z.ZodError ? 400 : error && typeof error === "object" && "status" in error ? Number(error.status) : 500; return NextResponse.json({ error: error instanceof Error ? error.message : "保存项目失败。" }, { status }); }
}
