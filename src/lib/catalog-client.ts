import type { Program, ProgramCategory, ProgramDetail, University } from "./types";

async function json<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "请求失败。");
  return body as T;
}

export async function getUniversities(): Promise<University[]> {
  return json(await fetch("/api/catalog/universities", { cache: "no-store" }));
}

export async function getPrograms(filters: { universityId?: string; category?: ProgramCategory } = {}): Promise<Program[]> {
  const params = new URLSearchParams();
  if (filters.universityId) params.set("universityId", filters.universityId);
  if (filters.category) params.set("category", filters.category);
  return json(await fetch(`/api/catalog/programs${params.size ? `?${params}` : ""}`, { cache: "no-store" }));
}

export async function getProgram(id: string): Promise<ProgramDetail | undefined> {
  const response = await fetch(`/api/catalog/programs/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (response.status === 404) return undefined;
  return json(response);
}

export async function saveProgram(program: Program): Promise<ProgramDetail> {
  return json(await fetch(`/api/catalog/programs/${encodeURIComponent(program.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(program) }));
}

export async function addCandidate(input: { universityId: string; name: string; category: ProgramCategory; sourceUrl: string; status?: Program["status"] }): Promise<ProgramDetail> {
  return json(await fetch("/api/catalog/programs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }));
}
