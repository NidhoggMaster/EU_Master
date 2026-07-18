import { z } from "zod";
import { previewCatalogTransfer, transferCatalog } from "@/lib/server/catalog-service";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";

export const runtime = "nodejs";
const schema = z.object({
  action: z.enum(["preview", "execute"]),
  from: z.enum(["local", "supabase"]),
  to: z.enum(["local", "supabase"]),
  overwriteIds: z.array(z.string().min(1).max(100)).max(200).default([]),
}).refine((value) => value.from !== value.to, "来源和目标项目库不能相同。");

export async function POST(request: Request) {
  try {
    assertLocalMutation(request);
    const input = schema.parse(await request.json());
    if (input.action === "preview") return Response.json(await previewCatalogTransfer(input.from, input.to));
    const importedIds = await transferCatalog(input.from, input.to, input.overwriteIds);
    return Response.json({ importedIds });
  } catch (error) {
    return errorResponse(error, "复制项目失败。");
  }
}
