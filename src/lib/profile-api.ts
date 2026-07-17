import type { ApplicantProfile } from "./types";

type ProfileResponse = {
  profile?: ApplicantProfile;
  error?: string;
};

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as ProfileResponse;
  if (!response.ok) {
    throw new Error(payload.error || "个人档案服务暂时不可用。");
  }
  return payload;
}

export async function getRemoteProfile() {
  const response = await fetch("/api/profile", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  return (await readResponse(response)).profile;
}

export async function saveRemoteProfile(profile: ApplicantProfile) {
  const response = await fetch("/api/profile", {
    method: "PUT",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(profile),
  });
  const payload = await readResponse(response);
  if (!payload.profile) throw new Error("数据库未返回保存后的个人档案。");
  return payload.profile;
}
