import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { applicantProfileSchema } from "@/lib/profile-schema";
import { getStoredProfile, upsertStoredProfile } from "@/lib/profile-postgres";

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
  console.error("Profile API database operation failed", reason);
  const configurationError = reason instanceof Error
    && reason.message.includes("SUPABASE_SESSION_POOL");
  return response({
    error: configurationError
      ? reason.message
      : "个人档案数据库暂时不可用，请稍后重试。",
  }, 503);
}

export async function GET() {
  try {
    return response({ profile: await getStoredProfile() });
  } catch (reason) {
    return serverError(reason);
  }
}

export async function PUT(request: Request) {
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
    return response({ profile: await upsertStoredProfile(profile) });
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
