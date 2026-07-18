import { z } from "zod";
import { MATERIAL_TYPES } from "@/lib/types";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { createLocalMaterial, getLocalMaterials } from "@/lib/server/local-store";
import { validateMaterialFile } from "@/lib/workspace-schema";

export const runtime = "nodejs";
const formSchema = z.object({
  title: z.string().min(1).max(180), type: z.enum(MATERIAL_TYPES), status: z.enum(["draft", "ready", "expired"]),
  scope: z.enum(["basic", "program"]).default("basic"), programId: z.string().max(120).default(""), requirementId: z.string().max(120).default(""),
  prepared: z.enum(["true", "false"]).default("false"), notes: z.string().max(5_000).default(""),
});

export async function GET() {
  try { return Response.json(await getLocalMaterials(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error, "读取材料失败。"); }
}

export async function POST(request: Request) {
  try {
    assertLocalMutation(request);
    const form = await request.formData();
    const input = formSchema.parse({
      title: form.get("title"), type: form.get("type"), status: form.get("status"), scope: form.get("scope"), programId: form.get("programId"),
      requirementId: form.get("requirementId"), prepared: form.get("prepared"), notes: form.get("notes"),
    });
    const file = form.get("file");
    if (file instanceof File && file.size) validateMaterialFile(file);
    const storedFile = file instanceof File && file.size ? { name: file.name, mimeType: file.type || "application/octet-stream", bytes: new Uint8Array(await file.arrayBuffer()) } : undefined;
    return Response.json(await createLocalMaterial(input.title, input.type, input.status, storedFile, {
      scope: input.scope, programId: input.programId, requirementId: input.requirementId, prepared: input.prepared === "true", notes: input.notes,
    }), { status: 201 });
  } catch (error) { return errorResponse(error, "创建材料失败。"); }
}
