import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { seededPrograms, universities } from "./catalog-data";
import type {
  ApplicantProfile,
  Application,
  BackupRecords,
  DiscoveryCandidate,
  FieldChange,
  Material,
  MaterialVersion,
  LocalCatalogRow,
  Program,
  SourceSnapshot,
  University,
} from "./types";

interface EuMasterDb extends DBSchema {
  meta: { key: string; value: unknown };
  profile: { key: string; value: ApplicantProfile };
  universities: { key: string; value: University };
  programs: { key: string; value: Program };
  materials: { key: string; value: Material };
  materialVersions: {
    key: string;
    value: MaterialVersion;
    indexes: { "by-material": string };
  };
  applications: { key: string; value: Application };
  sourceSnapshots: {
    key: string;
    value: SourceSnapshot;
    indexes: { "by-program": string };
  };
  fieldChanges: {
    key: string;
    value: FieldChange;
    indexes: { "by-program": string };
  };
  catalogTable: { key: string; value: LocalCatalogRow };
}

type StoreName = "meta" | "profile" | "universities" | "programs" | "materials" | "materialVersions" | "applications" | "sourceSnapshots" | "fieldChanges" | "catalogTable";

const DB_NAME = "eu-master-nl";
const DB_VERSION = 2;
let databasePromise: Promise<IDBPDatabase<EuMasterDb>> | undefined;

function openDatabase() {
  if (typeof indexedDB === "undefined") {
    throw new Error("当前环境不支持浏览器本地数据库。");
  }
  databasePromise ??= openDB<EuMasterDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("profile")) db.createObjectStore("profile", { keyPath: "id" });
      if (!db.objectStoreNames.contains("universities")) db.createObjectStore("universities", { keyPath: "id" });
      if (!db.objectStoreNames.contains("programs")) db.createObjectStore("programs", { keyPath: "id" });
      if (!db.objectStoreNames.contains("materials")) db.createObjectStore("materials", { keyPath: "id" });
      if (!db.objectStoreNames.contains("materialVersions")) {
        const versions = db.createObjectStore("materialVersions", { keyPath: "id" });
        versions.createIndex("by-material", "materialId");
      }
      if (!db.objectStoreNames.contains("applications")) db.createObjectStore("applications", { keyPath: "id" });
      if (!db.objectStoreNames.contains("sourceSnapshots")) {
        const snapshots = db.createObjectStore("sourceSnapshots", { keyPath: "id" });
        snapshots.createIndex("by-program", "programId");
      }
      if (!db.objectStoreNames.contains("fieldChanges")) {
        const changes = db.createObjectStore("fieldChanges", { keyPath: "id" });
        changes.createIndex("by-program", "programId");
      }
      if (!db.objectStoreNames.contains("catalogTable")) db.createObjectStore("catalogTable", { keyPath: "id" });
    },
  });
  return databasePromise;
}

export async function ensureDatabase() {
  const db = await openDatabase();
  const seedVersion = await db.get("meta", "seedVersion");
  if (seedVersion === 1) return db;

  const tx = db.transaction(["meta", "universities", "programs"], "readwrite");
  await Promise.all(universities.map((item) => tx.objectStore("universities").put(item)));
  for (const item of seededPrograms) {
    const existing = await tx.objectStore("programs").get(item.id);
    if (!existing) await tx.objectStore("programs").put(item);
  }
  await tx.objectStore("meta").put(1, "seedVersion");
  await tx.done;
  return db;
}

export async function getProfile() {
  return (await ensureDatabase()).get("profile", "current");
}

export async function saveProfile(profile: ApplicantProfile) {
  await (await ensureDatabase()).put("profile", profile);
}

export const getLocalProfile = getProfile;

export async function clearLocalProfile() {
  await (await ensureDatabase()).delete("profile", "current");
}

function toCatalogRow(program: Program, universityNames: string[] = []): LocalCatalogRow {
  const detail = program as Program & { sources?: { sourceUrl: string }[]; universities?: University[] };
  const linkedUniversities = detail.universities ?? [];
  const names = linkedUniversities.length ? linkedUniversities.map((item) => item.name) : universityNames;
  return {
    id: program.id, status: program.status, universityIds: program.institutionIds, universities: names.join(" + "), programName: program.name,
    categories: program.categories.join(" / "), city: program.city || linkedUniversities[0]?.city || "", campus: program.campusName || linkedUniversities[0]?.campusName || "",
    location: program.locationNotes || linkedUniversities[0]?.locationNotes || "", degreeType: program.degreeType, language: program.language, duration: program.duration,
    ects: program.ects, coreCourses: program.coreCourses.map((item) => item.name).join(" | "), admissionCriteria: program.admissionCriteria.map((item) => `${item.title}: ${item.description}`).join(" | "),
    requiredDocuments: program.requirements.filter((item) => item.required).map((item) => item.title).join(" | "), tuitionEur: program.tuitionEur, tuition: program.tuition,
    deadline: program.deadline, sourceUrl: program.sourceUrl, sourceCount: detail.sources?.length ?? 1, dataCompleteness: program.dataCompleteness,
    lastFetchedAt: program.lastFetchedAt ?? "", syncedAt: new Date().toISOString(),
  };
}

export async function cacheCatalogPrograms(programs: Program[], universityMap: Record<string, string> = {}) {
  if (!programs.length) return;
  const db = await ensureDatabase();
  const tx = db.transaction("catalogTable", "readwrite");
  const existingRows = await tx.store.getAll();
  for (const program of programs) {
    const duplicate = existingRows.find((row) => row.sourceUrl === program.sourceUrl && row.id !== program.id);
    if (duplicate) await tx.store.delete(duplicate.id);
    await tx.store.put(toCatalogRow(program, program.institutionIds.map((id) => universityMap[id]).filter(Boolean)));
  }
  await tx.done;
}

export async function cacheDiscoveryCandidates(candidates: DiscoveryCandidate[], universityMap: Record<string, string> = {}) {
  if (!candidates.length) return;
  const db = await ensureDatabase();
  const tx = db.transaction("catalogTable", "readwrite");
  const timestamp = new Date().toISOString();
  const existingRows = await tx.store.getAll();
  for (const candidate of candidates) {
    const existing = existingRows.find((row) => row.sourceUrl === candidate.sourceUrl);
    await tx.store.put({
      id: existing?.id ?? candidate.sourceUrl, status: "candidate", universityIds: [candidate.universityId], universities: universityMap[candidate.universityId] ?? "",
      programName: candidate.name, categories: candidate.category, city: "", campus: "", location: "", degreeType: "", language: "", duration: "", ects: "",
      coreCourses: "", admissionCriteria: "", requiredDocuments: "", tuitionEur: null, tuition: "", deadline: "", sourceUrl: candidate.sourceUrl,
      sourceCount: 1, dataCompleteness: 0, lastFetchedAt: "", syncedAt: timestamp,
    });
  }
  await tx.done;
}

export async function getLocalCatalogRows() {
  const rows = await (await ensureDatabase()).getAll("catalogTable");
  return rows.sort((a, b) => b.syncedAt.localeCompare(a.syncedAt));
}

export async function getUniversities() {
  return (await ensureDatabase()).getAll("universities");
}

export async function getPrograms() {
  return (await ensureDatabase()).getAll("programs");
}

export async function getProgram(id: string) {
  return (await ensureDatabase()).get("programs", id);
}

export async function saveProgram(program: Program) {
  await (await ensureDatabase()).put("programs", { ...program, updatedAt: new Date().toISOString() });
}

export async function getMaterials() {
  return (await ensureDatabase()).getAll("materials");
}

export async function getMaterial(id: string) {
  return (await ensureDatabase()).get("materials", id);
}

export async function getMaterialVersions(materialId: string) {
  const versions = await (await ensureDatabase()).getAllFromIndex("materialVersions", "by-material", materialId);
  return versions.sort((a, b) => b.version - a.version);
}

export async function createMaterial(title: string, type: Material["type"], status: Material["status"], file: File) {
  const db = await ensureDatabase();
  const timestamp = new Date().toISOString();
  const materialId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const material: Material = {
    id: materialId,
    title,
    type,
    status,
    currentVersionId: versionId,
    createdAt: timestamp,
    updatedAt: timestamp,
    scope: "basic",
    programId: "",
    requirementId: "",
    prepared: status === "ready",
    notes: "",
    archived: false,
  };
  const version: MaterialVersion = {
    id: versionId,
    materialId,
    version: 1,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    blob: file,
    createdAt: timestamp,
  };
  const tx = db.transaction(["materials", "materialVersions"], "readwrite");
  await Promise.all([tx.objectStore("materials").put(material), tx.objectStore("materialVersions").put(version)]);
  await tx.done;
  return material;
}

export async function addMaterialVersion(materialId: string, file: File) {
  const db = await ensureDatabase();
  const material = await db.get("materials", materialId);
  if (!material) throw new Error("找不到这份材料。");
  const versions = await db.getAllFromIndex("materialVersions", "by-material", materialId);
  const timestamp = new Date().toISOString();
  const version: MaterialVersion = {
    id: crypto.randomUUID(),
    materialId,
    version: Math.max(0, ...versions.map((item) => item.version)) + 1,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    blob: file,
    createdAt: timestamp,
  };
  const tx = db.transaction(["materials", "materialVersions"], "readwrite");
  await Promise.all([
    tx.objectStore("materialVersions").put(version),
    tx.objectStore("materials").put({ ...material, currentVersionId: version.id, updatedAt: timestamp }),
  ]);
  await tx.done;
  return version;
}

export async function updateMaterial(material: Material) {
  await (await ensureDatabase()).put("materials", { ...material, updatedAt: new Date().toISOString() });
}

export async function deleteMaterial(materialId: string) {
  const db = await ensureDatabase();
  const versions = await db.getAllFromIndex("materialVersions", "by-material", materialId);
  const tx = db.transaction(["materials", "materialVersions"], "readwrite");
  tx.objectStore("materials").delete(materialId);
  versions.forEach((version) => tx.objectStore("materialVersions").delete(version.id));
  await tx.done;
}

export async function getApplications() {
  return (await ensureDatabase()).getAll("applications");
}

export async function getApplication(id: string) {
  return (await ensureDatabase()).get("applications", id);
}

export async function saveApplication(application: Application) {
  await (await ensureDatabase()).put("applications", { ...application, updatedAt: new Date().toISOString() });
}

export async function deleteApplication(applicationId: string) {
  await (await ensureDatabase()).delete("applications", applicationId);
}

export async function addCatalogRefresh(
  program: Program,
  snapshot: SourceSnapshot,
  changes: FieldChange[],
) {
  const db = await ensureDatabase();
  const tx = db.transaction(["programs", "sourceSnapshots", "fieldChanges"], "readwrite");
  const operations: Promise<unknown>[] = [
    tx.objectStore("programs").put(program),
    tx.objectStore("sourceSnapshots").put(snapshot),
  ];
  changes.forEach((change) => operations.push(tx.objectStore("fieldChanges").put(change)));
  await Promise.all(operations);
  await tx.done;
}

export async function getProgramChanges(programId: string) {
  const changes = await (await ensureDatabase()).getAllFromIndex("fieldChanges", "by-program", programId);
  return changes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveFieldChange(change: FieldChange) {
  await (await ensureDatabase()).put("fieldChanges", change);
}

export async function readBackupRecords(): Promise<{ records: BackupRecords; versions: MaterialVersion[] }> {
  const db = await ensureDatabase();
  const [profile, universities, programs, materials, versions, applications, sourceSnapshots, fieldChanges, catalogTableRows] = await Promise.all([
    db.get("profile", "current"),
    db.getAll("universities"),
    db.getAll("programs"),
    db.getAll("materials"),
    db.getAll("materialVersions"),
    db.getAll("applications"),
    db.getAll("sourceSnapshots"),
    db.getAll("fieldChanges"),
    db.getAll("catalogTable"),
  ]);
  return {
    records: {
      profile,
      universities,
      programs,
      materials,
      materialVersions: versions.map((version) => {
        const metadata = { ...version } as Partial<MaterialVersion>;
        delete metadata.blob;
        return metadata as Omit<MaterialVersion, "blob">;
      }),
      applications,
      sourceSnapshots,
      fieldChanges,
      catalogTableRows,
    },
    versions,
  };
}

export async function replaceBackupRecords(records: BackupRecords, versions: MaterialVersion[]) {
  const db = await ensureDatabase();
  const stores: StoreName[] = ["materials", "materialVersions", "applications", "catalogTable"];
  const tx = db.transaction(stores, "readwrite");
  stores.forEach((store) => tx.objectStore(store).clear());
  const operations: Promise<unknown>[] = [];
  records.materials.forEach((item) => operations.push(tx.objectStore("materials").put(item)));
  versions.forEach((item) => operations.push(tx.objectStore("materialVersions").put(item)));
  records.applications.forEach((item) => operations.push(tx.objectStore("applications").put(item)));
  records.catalogTableRows?.forEach((item) => operations.push(tx.objectStore("catalogTable").put(item)));
  await Promise.all(operations);
  await tx.done;
}

export async function resetUserData() {
  const db = await ensureDatabase();
  const stores: StoreName[] = ["profile", "materials", "materialVersions", "applications", "sourceSnapshots", "fieldChanges", "catalogTable"];
  const tx = db.transaction(stores, "readwrite");
  stores.forEach((store) => tx.objectStore(store).clear());
  await tx.done;
}
