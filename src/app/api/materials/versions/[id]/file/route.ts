import { errorResponse } from "@/lib/server/local-api";
import { readLocalMaterialFile } from "@/lib/server/local-store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const stored = await readLocalMaterialFile((await context.params).id);
    if (!stored) return Response.json({ error: "找不到材料版本。" }, { status: 404 });
    const fileName = stored.version.fileName.replace(/[\r\n"]/g, "_");
    return new Response(stored.bytes, { headers: { "Content-Type": stored.version.mimeType, "Content-Length": String(stored.bytes.byteLength), "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return errorResponse(error, "读取材料文件失败。"); }
}
