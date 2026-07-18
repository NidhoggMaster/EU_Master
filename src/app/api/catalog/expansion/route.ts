import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { applyCatalogExpansion } from "@/lib/server/catalog-expansion-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertLocalMutation(request);
    return Response.json(await applyCatalogExpansion());
  } catch (error) {
    return errorResponse(error, "同步项目扩展与生活费失败。");
  }
}
