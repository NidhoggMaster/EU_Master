import { z } from "zod";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { setCatalogMode } from "@/lib/server/local-store";
import { getStorageStatus } from "@/lib/server/storage-status";

export const runtime = "nodejs";
const schema = z.object({ mode: z.enum(["local", "supabase"]) });

export async function PATCH(request: Request) {
  try {
    assertLocalMutation(request);
    const { mode } = schema.parse(await request.json());
    const status = await getStorageStatus();
    if (mode === "supabase" && (!status.supabase.connected || !status.supabase.restrictedRole)) {
      throw Object.assign(new Error(status.supabase.error || "Supabase 健康检查未通过，仍保持本地 CSV 模式。"), { status: 409 });
    }
    await setCatalogMode(mode);
    return Response.json(await getStorageStatus());
  } catch (error) {
    return errorResponse(error, "切换存储模式失败。");
  }
}
