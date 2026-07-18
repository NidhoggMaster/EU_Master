import "server-only";

export function assertLocalMutation(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw Object.assign(new Error("请求来源无效。"), { status: 403 });
  }
  if (!host || originHost !== host) throw Object.assign(new Error("拒绝跨站修改本地数据。"), { status: 403 });
}

export function errorResponse(error: unknown, fallback: string) {
  const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 400;
  return Response.json({ error: error instanceof Error ? error.message : fallback }, { status: Number.isFinite(status) ? status : 400 });
}
