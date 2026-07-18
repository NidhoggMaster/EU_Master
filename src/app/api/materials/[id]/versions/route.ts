import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { addLocalMaterialVersion, getLocalMaterial, getLocalMaterialVersions } from "@/lib/server/local-store";
import { validateMaterialFile } from "@/lib/workspace-schema";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return Response.json(await getLocalMaterialVersions((await context.params).id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error, "读取材料版本失败。"); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalMutation(request);
    const id = (await context.params).id;
    if (!(await getLocalMaterial(id))) throw Object.assign(new Error("找不到材料。"), { status: 404 });
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new Error("请选择材料文件。");
    validateMaterialFile(file);
    return Response.json(await addLocalMaterialVersion(id, { name: file.name, mimeType: file.type || "application/octet-stream", bytes: new Uint8Array(await file.arrayBuffer()) }), { status: 201 });
  } catch (error) { return errorResponse(error, "添加材料版本失败。"); }
}
