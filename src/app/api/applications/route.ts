import { errorResponse } from "@/lib/server/local-api";
import { getLocalApplications } from "@/lib/server/local-store";

export const runtime = "nodejs";
export async function GET() {
  try { return Response.json(await getLocalApplications(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error, "读取申请失败。"); }
}
