import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateOfficialUrl } from "@/lib/catalog-server";
import { assertLocalMutation } from "@/lib/server/local-api";
import { getUniversity, updateUniversity } from "@/lib/server/catalog-service";

export const runtime = "nodejs";

const factsSchema = z.object({
  livingCostMonthlyMinEur: z.number().nonnegative(),
  livingCostMonthlyMaxEur: z.number().nonnegative(),
  livingCostSourceUrl: z.url().refine((url) => url.startsWith("https://")),
  factsFetchedAt: z.string().datetime(),
}).refine((value) => value.livingCostMonthlyMinEur <= value.livingCostMonthlyMaxEur, {
  message: "生活费下限不能高于上限。",
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalMutation(request);
    const id = (await context.params).id;
    const current = await getUniversity(id);
    if (!current) return NextResponse.json({ error: "找不到学校。" }, { status: 404 });
    const facts = factsSchema.parse(await request.json());
    validateOfficialUrl(facts.livingCostSourceUrl, current);
    return NextResponse.json(await updateUniversity({ ...current, ...facts }));
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : error && typeof error === "object" && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存学校事实失败。" }, { status });
  }
}
