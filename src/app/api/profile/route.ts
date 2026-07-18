import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { applicantProfileSchema } from "@/lib/profile-schema";
import { assertLocalMutation } from "@/lib/server/local-api";
import { getLocalProfile, saveLocalProfile } from "@/lib/server/local-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROFILE_BYTES = 256 * 1024;

function response(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function serverError(reason: unknown) {
  console.error("Profile local storage operation failed", reason);
  return response({
    error: reason instanceof Error ? reason.message : "个人档案本地存储暂时不可用，请稍后重试。",
  }, 503);
}

export async function GET() {
  try {
    return response({ profile: await getLocalProfile() });
  } catch (reason) {
    return serverError(reason);
  }
}

export async function PUT(request: Request) {
  try {
    assertLocalMutation(request);
  } catch (reason) {
    return response({ error: reason instanceof Error ? reason.message : "请求来源无效。" }, 403);
  }
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_PROFILE_BYTES) {
    return response({ error: "个人档案数据不能超过 256 KB。" }, 413);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return response({ error: "请求必须使用 application/json。" }, 415);
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_PROFILE_BYTES) {
      return response({ error: "个人档案数据不能超过 256 KB。" }, 413);
    }
    const profile = applicantProfileSchema.parse(JSON.parse(rawBody));
    return response({ profile: await saveLocalProfile(profile) });
  } catch (reason) {
    if (reason instanceof SyntaxError) {
      return response({ error: "请求 JSON 格式不正确。" }, 400);
    }
    if (reason instanceof ZodError) {
      return response({
        error: reason.issues[0]?.message || "个人档案字段格式不正确。",
      }, 400);
    }
    return serverError(reason);
  }
}
