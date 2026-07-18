import { z } from "zod";
import { errorResponse } from "@/lib/server/local-api";
import { calculateCatalogScores } from "@/lib/server/score-service";

export const runtime = "nodejs";
const inputSchema = z.object({ programIds: z.array(z.string().min(1).max(120)).min(1).max(100) });

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    return Response.json(await calculateCatalogScores(input.programIds));
  } catch (error) { return errorResponse(error, "预览评分失败。"); }
}
