import type { ApplicantProfile } from "./types";

async function storedProfile() {
  const response = await fetch("/api/profile", { cache: "no-store", headers: { accept: "application/json" } });
  const body = await response.json() as { profile?: ApplicantProfile; error?: string };
  if (!response.ok) throw new Error(body.error || "读取本地档案失败。");
  return body.profile;
}

export async function getProfile() {
  return storedProfile();
}

export async function saveProfile(profile: ApplicantProfile) {
  const response = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(profile) });
  const body = await response.json() as { profile?: ApplicantProfile; error?: string };
  if (!response.ok) throw new Error(body.error || "保存本地档案失败。");
  if (!body.profile) throw new Error("本地存储未返回保存后的个人档案。");
  return body.profile;
}
