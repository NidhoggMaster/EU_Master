import { getStorageStatus } from "@/lib/server/storage-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const storage = await getStorageStatus();
    return Response.json({ status: "ready", storage });
  } catch (error) {
    return Response.json({ status: "error", error: error instanceof Error ? error.message : "本地存储初始化失败。" }, { status: 503 });
  }
}
