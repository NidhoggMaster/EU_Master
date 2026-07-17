import type { ApplicantProfile } from "./types";
import { clearLocalProfile, getLocalProfile } from "./db";

async function remoteProfile() {
  const response = await fetch("/api/profile", { cache: "no-store", headers: { accept: "application/json" } });
  const body = await response.json() as { profile?: ApplicantProfile; error?: string };
  if (!response.ok) throw new Error(body.error || "读取远端档案失败。");
  return body.profile;
}

export async function getProfile() {
  const remote = await remoteProfile();
  if (remote) return remote;
  const local = await getLocalProfile();
  if (!local) return undefined;
  await saveProfile(local);
  const verified = await remoteProfile();
  if (!verified || verified.updatedAt !== local.updatedAt) throw new Error("本地档案迁移后校验失败。");
  await clearLocalProfile();
  return verified;
}

export async function saveProfile(profile: ApplicantProfile) {
  const response = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(profile) });
  const body = await response.json() as { profile?: ApplicantProfile; error?: string };
  if (!response.ok) throw new Error(body.error || "保存远端档案失败。");
  if (!body.profile) throw new Error("数据库未返回保存后的个人档案。");
  return body.profile;
}
