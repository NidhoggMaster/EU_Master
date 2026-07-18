import { inspectLocalBackup, restoreLocalBackup } from "@/lib/server/local-backup";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertLocalMutation(request);
    const form = await request.formData();
    const file = form.get("file");
    const action = form.get("action");
    if (!(file instanceof File)) throw new Error("缺少 IndexedDB 迁移数据。");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (action === "preview") {
      const result = await inspectLocalBackup(bytes);
      return Response.json({ summary: result.summary });
    }
    if (action !== "execute") throw new Error("迁移操作无效。");
    return Response.json(await restoreLocalBackup(bytes, undefined, false));
  } catch (error) {
    return errorResponse(error, "迁移 IndexedDB 数据失败。");
  }
}
