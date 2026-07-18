import { applicationSchema } from "@/lib/workspace-schema";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { deleteLocalApplication, getLocalApplication, saveLocalApplication } from "@/lib/server/local-store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const item = await getLocalApplication((await context.params).id);
    return item ? Response.json(item, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "找不到申请。" }, { status: 404 });
  } catch (error) { return errorResponse(error, "读取申请失败。"); }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalMutation(request);
    const id = (await context.params).id;
    const application = applicationSchema.parse(await request.json());
    if (application.id !== id) throw Object.assign(new Error("申请 ID 不一致。"), { status: 409 });
    return Response.json(await saveLocalApplication(application));
  } catch (error) { return errorResponse(error, "保存申请失败。"); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalMutation(request);
    await deleteLocalApplication((await context.params).id);
    return new Response(null, { status: 204 });
  } catch (error) { return errorResponse(error, "删除申请失败。"); }
}
