import { restoreLocalBackup } from "@/lib/server/local-backup";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertLocalMutation(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("请选择备份文件。");
    if (file.size > 500 * 1024 * 1024) throw new Error("备份文件不能超过 500 MB。");
    return Response.json(await restoreLocalBackup(new Uint8Array(await file.arrayBuffer()), String(form.get("password") || "") || undefined, true));
  } catch (error) {
    return errorResponse(error, "恢复本地备份失败。");
  }
}
