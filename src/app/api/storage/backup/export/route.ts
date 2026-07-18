import { z } from "zod";
import { createLocalBackup } from "@/lib/server/local-backup";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";

export const runtime = "nodejs";
const schema = z.object({ password: z.string().min(8).max(200).optional() });

export async function POST(request: Request) {
  try {
    assertLocalMutation(request);
    const { password } = schema.parse(await request.json());
    const bytes = await createLocalBackup(password);
    const extension = password ? "eumaster" : "zip";
    return new Response(bytes, { headers: {
      "content-type": password ? "application/octet-stream" : "application/zip",
      "content-disposition": `attachment; filename="eu-master-backup-${new Date().toISOString().slice(0, 10)}.${extension}"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    return errorResponse(error, "生成本地备份失败。");
  }
}
