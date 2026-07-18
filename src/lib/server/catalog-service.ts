import "server-only";

import type { CatalogMode, FieldChange, Program, ProgramCategory, ProgramDetail, TransferPreview } from "@/lib/types";
import { stableStringify } from "@/lib/stable-json";
import {
  decideFieldChange as decideRemoteFieldChange,
  getProgramDetail as getRemoteProgramDetail,
  getProgramDetails as getRemoteProgramDetails,
  importProgramDetails as importRemoteProgramDetails,
  listPrograms as listRemotePrograms,
  recordRefresh as recordRemoteRefresh,
  recordRefreshFailure as recordRemoteRefreshFailure,
  updateProgram as updateRemoteProgram,
  upsertCandidate as upsertRemoteCandidate,
} from "./catalog-repository";
import {
  decideLocalFieldChange,
  getCatalogMode,
  getLocalProgramDetail,
  getLocalProgramDetails,
  getLocalUniversity,
  importLocalCatalog,
  listLocalPrograms,
  listLocalUniversities,
  previewLocalCatalogImport,
  recordLocalRefresh,
  recordLocalRefreshFailure,
  setCatalogMode,
  updateLocalProgram,
  updateLocalUniversity,
  upsertLocalCandidate,
} from "./local-store";

type Filters = { universityId?: string; category?: ProgramCategory; status?: Program["status"] };
type RefreshInput = Parameters<typeof recordRemoteRefresh>[0];

export { getCatalogMode, setCatalogMode };

export function listUniversities() {
  return listLocalUniversities();
}

export function getUniversity(id: string) {
  return getLocalUniversity(id);
}

export function updateUniversity(university: Parameters<typeof updateLocalUniversity>[0]) {
  return updateLocalUniversity(university);
}

export async function listPrograms(filters: Filters = {}) {
  return (await getCatalogMode()) === "supabase" ? listRemotePrograms(filters) : listLocalPrograms(filters);
}

export async function getProgramDetail(id: string) {
  return (await getCatalogMode()) === "supabase" ? getRemoteProgramDetail(id) : getLocalProgramDetail(id);
}

export async function getProgramDetails(ids: string[]) {
  return (await getCatalogMode()) === "supabase" ? getRemoteProgramDetails(ids) : getLocalProgramDetails(ids);
}

export async function upsertCandidate(input: { id?: string; universityId: string; name: string; category: ProgramCategory; sourceUrl: string; status?: Program["status"] }) {
  return (await getCatalogMode()) === "supabase" ? upsertRemoteCandidate(input) : upsertLocalCandidate(input);
}

export async function updateProgram(program: Program) {
  return (await getCatalogMode()) === "supabase" ? updateRemoteProgram(program) : updateLocalProgram(program);
}

export async function decideFieldChange(programId: string, changeId: string, decision: "accepted" | "rejected") {
  return (await getCatalogMode()) === "supabase"
    ? decideRemoteFieldChange(programId, changeId, decision)
    : decideLocalFieldChange(programId, changeId, decision);
}

export async function recordRefresh(input: RefreshInput) {
  return (await getCatalogMode()) === "supabase" ? recordRemoteRefresh(input) : recordLocalRefresh(input);
}

export async function recordRefreshFailure(programId: string, message: string) {
  return (await getCatalogMode()) === "supabase" ? recordRemoteRefreshFailure(programId, message) : recordLocalRefreshFailure(programId, message);
}

async function programsFor(mode: CatalogMode) {
  return mode === "supabase" ? listRemotePrograms({ status: "active" }) : listLocalPrograms({ status: "active" });
}

async function detailsFor(mode: CatalogMode, ids: string[]) {
  return mode === "supabase" ? getRemoteProgramDetails(ids) : getLocalProgramDetails(ids);
}

function comparable(program: Program) {
  const value = { ...program } as Partial<Program>;
  delete value.updatedAt;
  delete value.createdAt;
  delete value.lastFetchedAt;
  return value;
}

export async function previewCatalogTransfer(from: CatalogMode, to: CatalogMode): Promise<TransferPreview> {
  if (from === to) throw new Error("来源和目标项目库不能相同。");
  const source = await programsFor(from);
  if (to === "local") return { from, to, ...(await previewLocalCatalogImport(source)) };
  const target = await programsFor(to);
  const targetMap = new Map(target.map((item) => [item.id, item]));
  const newItems: TransferPreview["newItems"] = [];
  const conflicts: TransferPreview["conflicts"] = [];
  for (const program of source) {
    const existing = targetMap.get(program.id);
    if (!existing) newItems.push({ id: program.id, name: program.name });
    else conflicts.push({ id: program.id, name: program.name, reason: stableStringify(comparable(existing)) === stableStringify(comparable(program)) ? "identical" : "different" });
  }
  return { from, to, newItems, conflicts };
}

export async function transferCatalog(from: CatalogMode, to: CatalogMode, overwriteIds: string[] = []) {
  if (from === to) throw new Error("来源和目标项目库不能相同。");
  const programs = await programsFor(from);
  const details = await detailsFor(from, programs.map((item) => item.id));
  return to === "local" ? importLocalCatalog(details, overwriteIds) : importRemoteProgramDetails(details, overwriteIds);
}

export async function importProgramDetails(details: ProgramDetail[], overwriteIds: string[] = []) {
  return importLocalCatalog(details, overwriteIds);
}

export type CatalogRefreshInput = RefreshInput;
export type CatalogFieldChange = FieldChange;
