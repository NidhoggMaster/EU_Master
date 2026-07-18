import type { Application, Material, MaterialType, StoredMaterialVersion } from "./types";

async function json<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || fallback);
  return body;
}

export async function getMaterials() {
  return json<Material[]>(await fetch("/api/materials", { cache: "no-store" }), "读取材料失败。");
}

export async function createMaterial(title: string, type: MaterialType, status: Material["status"], file: File) {
  const form = new FormData();
  form.set("title", title); form.set("type", type); form.set("status", status); form.set("file", file);
  return json<Material>(await fetch("/api/materials", { method: "POST", body: form }), "创建材料失败。");
}

export async function getMaterialVersions(materialId: string) {
  return json<StoredMaterialVersion[]>(await fetch(`/api/materials/${encodeURIComponent(materialId)}/versions`, { cache: "no-store" }), "读取材料版本失败。");
}

export async function addMaterialVersion(materialId: string, file: File) {
  const form = new FormData(); form.set("file", file);
  return json<StoredMaterialVersion>(await fetch(`/api/materials/${encodeURIComponent(materialId)}/versions`, { method: "POST", body: form }), "添加材料版本失败。");
}

export async function updateMaterial(material: Material) {
  return json<Material>(await fetch(`/api/materials/${encodeURIComponent(material.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(material) }), "更新材料失败。");
}

export async function deleteMaterial(materialId: string) {
  const response = await fetch(`/api/materials/${encodeURIComponent(materialId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error((await response.json()).error || "删除材料失败。");
}

export async function getApplications() {
  return json<Application[]>(await fetch("/api/applications", { cache: "no-store" }), "读取申请失败。");
}

export async function getApplication(id: string) {
  return json<Application>(await fetch(`/api/applications/${encodeURIComponent(id)}`, { cache: "no-store" }), "读取申请失败。");
}

export async function saveApplication(application: Application) {
  return json<Application>(await fetch(`/api/applications/${encodeURIComponent(application.id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(application) }), "保存申请失败。");
}

export async function deleteApplication(id: string) {
  const response = await fetch(`/api/applications/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error((await response.json()).error || "删除申请失败。");
}
