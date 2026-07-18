import { getCurrentProfile } from "@/lib/server/catalog-repository";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { getLocalMeta, saveLocalProfile, setLocalMeta } from "@/lib/server/local-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [profile, importedAt] = await Promise.all([getCurrentProfile(), getLocalMeta("remoteProfileImportedAt")]);
    return Response.json({ exists: Boolean(profile), updatedAt: profile?.updatedAt, importedAt });
  } catch (error) {
    return errorResponse(error, "读取 Supabase 旧档案失败。");
  }
}

export async function POST(request: Request) {
  try {
    assertLocalMutation(request);
    if (await getLocalMeta("remoteProfileImportedAt")) throw Object.assign(new Error("Supabase 旧档案已经导入过本地 CSV。"), { status: 409 });
    const profile = await getCurrentProfile();
    if (!profile) throw Object.assign(new Error("Supabase 中没有可导入的旧档案。"), { status: 404 });
    await saveLocalProfile(profile);
    const importedAt = new Date().toISOString();
    await setLocalMeta("remoteProfileImportedAt", importedAt);
    return Response.json({ imported: true, updatedAt: profile.updatedAt, importedAt });
  } catch (error) {
    return errorResponse(error, "导入 Supabase 旧档案失败。");
  }
}
