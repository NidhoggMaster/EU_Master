import { z } from "zod";
import { MATERIAL_TYPES } from "@/lib/types";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { createLocalMaterial, getLocalMaterials } from "@/lib/server/local-store";
import { validateMaterialFile } from "@/lib/workspace-schema";

export const runtime = "nodejs";
const formSchema = z.object({ title: z.string().min(1).max(180), type: z.enum(MATERIAL_TYPES), status: z.enum(["draft", "ready", "expired"]) });

export async function GET() {
  try { return Response.json(await getLocalMaterials(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error, "读取材料失败。"); }
}

export async function POST(request: Request) {
  try {
    assertLocalMutation(request);
    const form = await request.formData();
    const input = formSchema.parse({ title: form.get("title"), type: form.get("type"), status: form.get("status") });
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("请选择材料文件。");
    validateMaterialFile(file);
    return Response.json(await createLocalMaterial(input.title, input.type, input.status, { name: file.name, mimeType: file.type || "application/octet-stream", bytes: new Uint8Array(await file.arrayBuffer()) }), { status: 201 });
  } catch (error) { return errorResponse(error, "创建材料失败。"); }
}
