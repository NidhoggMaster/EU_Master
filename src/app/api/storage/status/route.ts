import { getStorageStatus } from "@/lib/server/storage-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getStorageStatus());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取存储状态失败。" }, { status: 500 });
  }
}
