import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { deleteLocalMaterial, getLocalMaterial, updateLocalMaterial } from "@/lib/server/local-store";
import { materialSchema } from "@/lib/workspace-schema";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalMutation(request);
    const id = (await context.params).id;
    const material = materialSchema.parse(await request.json());
    if (material.id !== id) throw Object.assign(new Error("材料 ID 不一致。"), { status: 409 });
    if (!(await getLocalMaterial(id))) throw Object.assign(new Error("找不到材料。"), { status: 404 });
    return Response.json(await updateLocalMaterial(material));
  } catch (error) { return errorResponse(error, "更新材料失败。"); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalMutation(request);
    const id = (await context.params).id;
    if (!(await getLocalMaterial(id))) throw Object.assign(new Error("找不到材料。"), { status: 404 });
    await deleteLocalMaterial(id);
    return new Response(null, { status: 204 });
  } catch (error) { return errorResponse(error, "删除材料失败。"); }
}
