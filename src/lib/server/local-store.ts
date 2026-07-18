import "server-only";

import { access, chmod, cp, lstat, mkdir, open, readFile, rename, rmdir, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, parse as parsePath, relative, resolve, sep } from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { seededPrograms, universities as seededUniversities } from "@/lib/catalog-data";
import type {
  ApplicantProfile,
  Application,
  BackupRecords,
  CatalogMode,
  FieldChange,
  Material,
  MaterialType,
  Program,
  ProgramCategory,
  ProgramDetail,
  ProgramSource,
  RankingFact,
  RequirementMatchOverride,
  ScoreSnapshot,
  SourceSnapshot,
  StoredMaterialVersion,
  University,
} from "@/lib/types";
import {
  TABLE_COLUMNS,
  decodeApplication,
  decodeFieldChange,
  decodeMaterial,
  decodeMaterialVersion,
  decodeProfile,
  decodeProgram,
  decodeMatchOverride,
  decodeScoreSnapshot,
  decodeSnapshot,
  decodeUniversity,
  encodeApplication,
  encodeFieldChange,
  encodeMaterial,
  encodeMaterialVersion,
  encodeProfile,
  encodeProgram,
  encodeMatchOverride,
  encodeScoreSnapshot,
  encodeSnapshot,
  encodeUniversity,
  type CsvRow,
  type StoredVersionRecord,
} from "./local-csv-codec";

type TableName = keyof typeof TABLE_COLUMNS;

const TABLE_FILES: Record<TableName, string> = {
  meta: "meta.csv",
  profile: "personal/profile.csv",
  universities: "catalog/universities.csv",
  programs: "catalog/programs.csv",
  materials: "materials.csv",
  materialVersions: "material_versions.csv",
  applications: "applications/applications.csv",
  sourceSnapshots: "catalog/source_snapshots.csv",
  fieldChanges: "catalog/change_history.csv",
  scoreSnapshots: "applications/score_snapshots.csv",
  matchOverrides: "applications/match_overrides.csv",
};

const LEGACY_TABLE_FILES: Partial<Record<TableName, string>> = {
  meta: "meta.csv", profile: "profile.csv", universities: "universities.csv", programs: "programs.csv",
  materials: "materials.csv", materialVersions: "material_versions.csv", applications: "applications.csv",
  sourceSnapshots: "source_snapshots.csv", fieldChanges: "field_changes.csv",
};

const MATERIAL_TABLES = new Set<TableName>(["materials", "materialVersions"]);

declare global {
  var euMasterLocalStoreInit: Promise<void> | undefined;
  var euMasterLocalStoreQueue: Promise<unknown> | undefined;
}

function resolveDirectory(configured: string | undefined, fallback: string, variable: string) {
  const value = configured?.trim();
  const directory = configured
    ? (isAbsolute(value!) ? resolve(/* turbopackIgnore: true */ value!) : resolve(/* turbopackIgnore: true */ process.cwd(), value!))
    : resolve(process.cwd(), fallback);
  if (directory === parsePath(directory).root) throw new Error(`${variable} 不能指向文件系统根目录。`);
  return directory;
}

export function privateDataDirectory() {
  return resolveDirectory(process.env.EU_MASTER_PRIVATE_DATA_DIR ?? process.env.EU_MASTER_DATA_DIR, "Private_Data", "EU_MASTER_PRIVATE_DATA_DIR");
}

export function materialDataDirectory() {
  const legacyOverride = process.env.EU_MASTER_DATA_DIR?.trim();
  const fallback = legacyOverride && !process.env.EU_MASTER_PRIVATE_DATA_DIR ? join(legacyOverride, "material_center") : "material_center";
  return resolveDirectory(process.env.EU_MASTER_MATERIAL_DIR, fallback, "EU_MASTER_MATERIAL_DIR");
}

export function localDataDirectory() {
  return privateDataDirectory();
}

function legacyDataDirectory() {
  return resolve(process.cwd(), "local-data");
}

function tablePath(table: TableName) {
  return join(/* turbopackIgnore: true */ MATERIAL_TABLES.has(table) ? materialDataDirectory() : privateDataDirectory(), TABLE_FILES[table]);
}

export function safeLocalPath(relativePath: string) {
  if (!relativePath || isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) throw new Error("本地文件路径无效。");
  const root = materialDataDirectory();
  const target = resolve(/* turbopackIgnore: true */ root, relativePath);
  if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error("本地文件路径超出数据目录。");
  return target;
}

async function assertNoSymlink(root: string, target: string) {
  const value = relative(root, target);
  if (value.startsWith("..") || isAbsolute(value)) throw new Error("本地文件路径超出数据目录。");
  let current = root;
  for (const part of value.split(sep).filter(Boolean)) {
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error("本地文件路径不能经过符号链接。");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
      throw error;
    }
  }
}

async function exists(path: string) {
  try {
    await access(/* turbopackIgnore: true */ path);
    return true;
  } catch {
    return false;
  }
}

async function writeFileAtomic(path: string, contents: string | Uint8Array) {
  const root = path.startsWith(`${materialDataDirectory()}${sep}`) ? materialDataDirectory() : privateDataDirectory();
  await assertNoSymlink(root, dirname(path));
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, path);
    await chmod(path, 0o600);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

async function writeRows(table: TableName, rows: CsvRow[]) {
  const columns = [...TABLE_COLUMNS[table]];
  const output = stringify(rows, { header: true, columns, bom: true, record_delimiter: "windows" });
  await writeFileAtomic(tablePath(table), output);
}

async function migrateLegacyStore() {
  if (process.env.EU_MASTER_DATA_DIR || process.env.EU_MASTER_PRIVATE_DATA_DIR || process.env.EU_MASTER_MATERIAL_DIR) return false;
  const legacy = legacyDataDirectory();
  if (!(await exists(join(legacy, "meta.csv"))) || await exists(join(privateDataDirectory(), "meta.csv"))) return false;
  await mkdir(join(privateDataDirectory(), "migrations", "legacy-local-data"), { recursive: true, mode: 0o700 });
  await cp(legacy, join(privateDataDirectory(), "migrations", "legacy-local-data"), { recursive: true, force: false, errorOnExist: false });
  for (const [table, legacyName] of Object.entries(LEGACY_TABLE_FILES) as Array<[TableName, string]>) {
    const source = join(legacy, legacyName);
    if (!(await exists(source))) continue;
    const target = tablePath(table);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await cp(source, target, { force: false, errorOnExist: false });
    await chmod(target, 0o600);
  }
  if (await exists(join(legacy, "files"))) await cp(join(legacy, "files"), join(materialDataDirectory(), "files"), { recursive: true, force: false, errorOnExist: false });
  return true;
}

async function initializeStore() {
  const privateRoot = privateDataDirectory();
  const materialRoot = materialDataDirectory();
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await mkdir(materialRoot, { recursive: true, mode: 0o700 });
  await chmod(privateRoot, 0o700);
  await chmod(materialRoot, 0o700);
  for (const directory of ["basic", "programs", "files"]) {
    await mkdir(join(materialRoot, directory), { recursive: true, mode: 0o700 });
    await chmod(join(materialRoot, directory), 0o700);
  }
  const migrated = await migrateLegacyStore();

  const initialRows: Record<TableName, CsvRow[]> = {
    meta: [{ key: "schemaVersion", value: "3" }, { key: "catalogMode", value: "local" }, { key: "migratedFromLegacy", value: String(migrated) }],
    profile: [],
    universities: seededUniversities.map(encodeUniversity),
    programs: seededPrograms.map(encodeProgram),
    materials: [],
    materialVersions: [],
    applications: [],
    sourceSnapshots: [],
    fieldChanges: [],
    scoreSnapshots: [],
    matchOverrides: [],
  };
  for (const table of Object.keys(TABLE_FILES) as TableName[]) {
    if (!(await exists(tablePath(table)))) await writeRows(table, initialRows[table]);
  }
  const meta = await readFile(tablePath("meta"), "utf8");
  const metaRows = parse(meta, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[];
  const nextMeta = metaRows.filter((row) => !["schemaVersion", "migratedFromLegacy"].includes(row.key));
  nextMeta.push({ key: "schemaVersion", value: "3" }, { key: "migratedFromLegacy", value: String(migrated || metaRows.some((row) => row.key === "migratedFromLegacy" && row.value === "true")) });
  await writeRows("meta", nextMeta);
  const changeInput = await readFile(tablePath("fieldChanges"), "utf8");
  const changeRows = parse(changeInput, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[];
  if (changeRows.some((row) => row.status === "pending")) await writeRows("fieldChanges", changeRows.map((row) => row.status === "pending" ? { ...row, status: "superseded" } : row));
}

export function ensureLocalStore() {
  globalThis.euMasterLocalStoreInit ??= initializeStore().catch((error) => {
    globalThis.euMasterLocalStoreInit = undefined;
    throw error;
  });
  return globalThis.euMasterLocalStoreInit;
}

async function readRows(table: TableName) {
  await ensureLocalStore();
  const input = await readFile(/* turbopackIgnore: true */ tablePath(table), "utf8");
  try {
    return parse(input, { bom: true, columns: true, skip_empty_lines: true, trim: false }) as CsvRow[];
  } catch (error) {
    throw new Error(`${TABLE_FILES[table]} 无法解析：${error instanceof Error ? error.message : "CSV 格式错误"}`);
  }
}

async function readTable<T>(table: TableName, decoder: (row: CsvRow) => T) {
  return (await readRows(table)).map((row, index) => {
    try {
      return decoder(row);
    } catch (error) {
      throw new Error(`${TABLE_FILES[table]} 第 ${index + 2} 行无效：${error instanceof Error ? error.message : "字段错误"}`);
    }
  });
}

function serializeWrite<T>(work: () => Promise<T>) {
  const previous = globalThis.euMasterLocalStoreQueue ?? Promise.resolve();
  const result = previous.then(work, work);
  globalThis.euMasterLocalStoreQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function writeTable<T>(table: TableName, values: T[], encoder: (value: T) => CsvRow) {
  await ensureLocalStore();
  await writeRows(table, values.map(encoder));
}

export async function getCatalogMode(): Promise<CatalogMode> {
  const row = (await readRows("meta")).find((item) => item.key === "catalogMode");
  return row?.value === "supabase" ? "supabase" : "local";
}

export async function getLocalMeta(key: string) {
  return (await readRows("meta")).find((item) => item.key === key)?.value;
}

export function setLocalMeta(key: string, value: string) {
  return serializeWrite(async () => {
    const rows = (await readRows("meta")).filter((row) => row.key !== key);
    rows.push({ key, value });
    await writeRows("meta", rows);
  });
}

export function setCatalogMode(mode: CatalogMode) {
  return serializeWrite(async () => {
    const rows = await readRows("meta");
    const next = rows.filter((row) => row.key !== "catalogMode");
    next.push({ key: "catalogMode", value: mode });
    await writeRows("meta", next);
    return mode;
  });
}

export async function listLocalUniversities() {
  return (await readTable("universities", decodeUniversity)).sort((left, right) => left.name.localeCompare(right.name));
}

export async function getLocalUniversity(id: string) {
  return (await listLocalUniversities()).find((item) => item.id === id);
}

export function updateLocalUniversity(university: University) {
  return serializeWrite(async () => {
    const universities = await listLocalUniversities();
    if (!universities.some((item) => item.id === university.id)) throw new Error("找不到学校。");
    await writeTable("universities", [...universities.filter((item) => item.id !== university.id), university], encodeUniversity);
    return getLocalUniversity(university.id) as Promise<University>;
  });
}

export async function listLocalPrograms(filters: { universityId?: string; category?: ProgramCategory; status?: Program["status"] } = {}) {
  const programs = await readTable("programs", decodeProgram);
  return programs.filter((program) => {
    if (program.status !== (filters.status ?? "active")) return false;
    if (filters.universityId && !program.institutionIds.includes(filters.universityId)) return false;
    if (filters.category && !program.categories.includes(filters.category)) return false;
    return true;
  }).sort((left, right) => left.name.localeCompare(right.name));
}

async function allLocalPrograms() {
  return readTable("programs", decodeProgram);
}

export function updateLocalRankingData(
  universityRankings: Record<string, RankingFact[]>,
  programRankings: Record<string, RankingFact[]>,
  updatedAt: string,
) {
  return serializeWrite(async () => {
    const [universities, programs] = await Promise.all([listLocalUniversities(), allLocalPrograms()]);
    const universityIds = new Set(universities.map((item) => item.id));
    const programIds = new Set(programs.map((item) => item.id));
    const missingUniversities = Object.keys(universityRankings).filter((id) => !universityIds.has(id));
    const missingPrograms = Object.keys(programRankings).filter((id) => !programIds.has(id));
    if (missingUniversities.length || missingPrograms.length) {
      throw new Error(`排名目标不存在：${[...missingUniversities, ...missingPrograms].join("、")}`);
    }
    const nextUniversities = universities.map((item) => universityRankings[item.id]
      ? { ...item, rankings: universityRankings[item.id].map((ranking) => ({ ...ranking })) }
      : item);
    const nextPrograms = programs.map((item) => programRankings[item.id]
      ? {
          ...item,
          rankings: programRankings[item.id].map((ranking) => ({ ...ranking })),
          fieldLocks: [...new Set([...item.fieldLocks, "rankings"])],
          updatedAt,
        }
      : item);
    await writeTable("universities", nextUniversities, encodeUniversity);
    await writeTable("programs", nextPrograms, encodeProgram);
    return { universities: Object.keys(universityRankings).length, programs: Object.keys(programRankings).length };
  });
}

function snapshotToSource(snapshot: SourceSnapshot, program: Program) {
  return {
    id: snapshot.id,
    programId: snapshot.programId,
    sourceUrl: snapshot.sourceUrl,
    sourceKind: "program",
    title: program.name,
    provider: snapshot.provider ?? "direct",
    contentHash: snapshot.contentHash,
    excerpts: snapshot.excerpts,
    verificationState: "confirmed" as const,
    fetchedAt: snapshot.fetchedAt,
  };
}

export async function getLocalProgramDetail(id: string): Promise<ProgramDetail | undefined> {
  const [programs, universities, snapshots, changes] = await Promise.all([
    allLocalPrograms(), listLocalUniversities(), readTable("sourceSnapshots", decodeSnapshot), readTable("fieldChanges", decodeFieldChange),
  ]);
  const program = programs.find((item) => item.id === id);
  if (!program) return undefined;
  const linked = universities.filter((item) => program.institutionIds.includes(item.id));
  const sources: ProgramSource[] = snapshots.filter((item) => item.programId === id).map((item) => snapshotToSource(item, program));
  if (!sources.length) {
    sources.push({ id: `seed-${program.id}`, programId: program.id, sourceUrl: program.sourceUrl, sourceKind: "program", title: program.name, provider: "seed", contentHash: "", excerpts: [], verificationState: "confirmed", fetchedAt: undefined });
  }
  return { ...program, universities: linked, sources, pendingChanges: changes.filter((item) => item.programId === id && item.status === "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}

export async function getLocalProgramDetails(ids: string[]) {
  return (await Promise.all(ids.map(getLocalProgramDetail))).filter(Boolean) as ProgramDetail[];
}

export function upsertLocalCandidate(input: { id?: string; universityId: string; name: string; category: ProgramCategory; sourceUrl: string; status?: Program["status"] }) {
  return serializeWrite(async () => {
    const programs = await allLocalPrograms();
    const existing = programs.find((item) => item.sourceUrl === input.sourceUrl || item.id === input.id);
    const timestamp = new Date().toISOString();
    const program: Program = existing ? {
      ...existing,
      name: input.name,
      institutionIds: [...new Set([...existing.institutionIds, input.universityId])],
      categories: [...new Set([...existing.categories, input.category])],
      status: existing.status === "active" ? "active" : input.status ?? "candidate",
      updatedAt: timestamp,
    } : {
      id: input.id ?? crypto.randomUUID(), institutionIds: [input.universityId], name: input.name, categories: [input.category], sourceUrl: input.sourceUrl,
      faculty: "", degreeType: "", language: "", duration: "", ects: "", mode: "", intakes: [], deadline: "", tuition: "", tuitionEur: null,
      tuitionAcademicYear: "", applicationFee: "", applicationFeeEur: null, applicationPlatform: "", premaster: "", quota: "", campusName: "", city: "",
      campusArea: "", locationNotes: "", coreCourses: [], admissionCriteria: [], requirements: [], dataCompleteness: 0,
      status: input.status ?? "candidate", lastFetchedAt: undefined, createdAt: timestamp, updatedAt: timestamp, seeded: false,
      overview: null, rankings: [], careerOutcomes: [], applicationDates: [], testRequirements: [], chinaEligibility: null,
      premasterInfo: null, applicationLinks: { programUrl: input.sourceUrl, curriculumUrl: "", eligibilityUrl: "", materialsUrl: "", careersUrl: "", premasterUrl: "", studielinkUrl: "https://www.studielink.nl/" },
      admissionProbabilityPrior: null, fieldLocks: [],
    };
    await writeTable("programs", [...programs.filter((item) => item.id !== program.id), program], encodeProgram);
    return getLocalProgramDetail(program.id) as Promise<ProgramDetail>;
  });
}

export function updateLocalProgram(program: Program) {
  return serializeWrite(async () => {
    const programs = await allLocalPrograms();
    if (!programs.some((item) => item.id === program.id)) throw new Error("找不到项目。");
    const next = { ...program, updatedAt: new Date().toISOString() };
    await writeTable("programs", [...programs.filter((item) => item.id !== program.id), next], encodeProgram);
    return getLocalProgramDetail(program.id) as Promise<ProgramDetail>;
  });
}

export async function getLocalProfile() {
  return (await readTable("profile", decodeProfile))[0];
}

export function saveLocalProfile(profile: ApplicantProfile) {
  return serializeWrite(async () => {
    await writeTable("profile", [profile], encodeProfile);
    return profile;
  });
}

export async function getLocalMaterials() {
  return (await readTable("materials", decodeMaterial)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getLocalMaterial(id: string) {
  return (await getLocalMaterials()).find((item) => item.id === id);
}

function withDownloadUrl(version: StoredVersionRecord): StoredMaterialVersion {
  return { ...version, downloadUrl: `/api/materials/versions/${encodeURIComponent(version.id)}/file` };
}

export async function getLocalMaterialVersions(materialId: string) {
  return (await readTable("materialVersions", decodeMaterialVersion)).filter((item) => item.materialId === materialId).sort((a, b) => b.version - a.version).map(withDownloadUrl);
}

function safeFileName(value: string) {
  const cleaned = basename(value).normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 160);
  return cleaned || "file.bin";
}

function materialFolder(material: Material | undefined) {
  if (!material) return "files";
  const label = `${material.id.slice(0, 8)} ${safeFileName(material.title)}`;
  return material.scope === "program" && material.programId ? join("programs", safeFileName(material.programId), label) : join("basic", label);
}

async function storeMaterialBytes(versionId: string, fileName: string, bytes: Uint8Array, material?: Material, versionNumber = 1) {
  const folder = materialFolder(material);
  const directory = safeLocalPath(join(folder, material ? "versions" : versionId));
  await assertNoSymlink(materialDataDirectory(), directory);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const storedName = material ? `v${String(versionNumber).padStart(3, "0")}--${safeFileName(fileName)}` : safeFileName(fileName);
  const relativePath = join(folder, material ? "versions" : versionId, storedName);
  await writeFileAtomic(safeLocalPath(relativePath), bytes);
  return relativePath;
}

export function createLocalMaterial(
  title: string,
  type: MaterialType,
  status: Material["status"],
  file?: { name: string; mimeType: string; bytes: Uint8Array },
  options: { scope?: Material["scope"]; programId?: string; requirementId?: string; prepared?: boolean; notes?: string } = {},
) {
  return serializeWrite(async () => {
    const [materials, versions] = await Promise.all([getLocalMaterials(), readTable("materialVersions", decodeMaterialVersion)]);
    const timestamp = new Date().toISOString();
    const materialId = crypto.randomUUID();
    const material: Material = {
      id: materialId, title, type, status, currentVersionId: "", createdAt: timestamp, updatedAt: timestamp,
      scope: options.scope ?? "basic", programId: options.programId ?? "", requirementId: options.requirementId ?? "",
      prepared: options.prepared ?? status === "ready", notes: options.notes ?? "", archived: false,
    };
    let nextVersions = versions;
    if (file) {
      const versionId = crypto.randomUUID();
      const filePath = await storeMaterialBytes(versionId, file.name, file.bytes, material, 1);
      material.currentVersionId = versionId;
      nextVersions = [...versions, { id: versionId, materialId, version: 1, fileName: file.name, mimeType: file.mimeType, size: file.bytes.byteLength, filePath, createdAt: timestamp }];
    }
    await writeTable("materialVersions", nextVersions, encodeMaterialVersion);
    await writeTable("materials", [...materials, material], encodeMaterial);
    return material;
  });
}

export function addLocalMaterialVersion(materialId: string, file: { name: string; mimeType: string; bytes: Uint8Array }) {
  return serializeWrite(async () => {
    const [materials, versions] = await Promise.all([getLocalMaterials(), readTable("materialVersions", decodeMaterialVersion)]);
    const material = materials.find((item) => item.id === materialId);
    if (!material) throw new Error("找不到这份材料。");
    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();
    const versionNumber = Math.max(0, ...versions.filter((item) => item.materialId === materialId).map((item) => item.version)) + 1;
    const filePath = await storeMaterialBytes(id, file.name, file.bytes, material, versionNumber);
    const version: StoredVersionRecord = { id, materialId, version: versionNumber, fileName: file.name, mimeType: file.mimeType, size: file.bytes.byteLength, filePath, createdAt: timestamp };
    await writeTable("materialVersions", [...versions, version], encodeMaterialVersion);
    await writeTable("materials", materials.map((item) => item.id === materialId ? { ...item, currentVersionId: id, updatedAt: timestamp } : item), encodeMaterial);
    return withDownloadUrl(version);
  });
}

export function updateLocalMaterial(material: Material) {
  return serializeWrite(async () => {
    const materials = await getLocalMaterials();
    const next = { ...material, updatedAt: new Date().toISOString() };
    await writeTable("materials", materials.map((item) => item.id === material.id ? next : item), encodeMaterial);
    return next;
  });
}

export function deleteLocalMaterial(materialId: string) {
  return serializeWrite(async () => {
    const [materials, versions, applications] = await Promise.all([getLocalMaterials(), readTable("materialVersions", decodeMaterialVersion), getLocalApplications()]);
    if (applications.some((application) => application.requirements.some((requirement) => requirement.materialId === materialId))) {
      throw Object.assign(new Error("该材料仍被申请引用，请先解除关联。"), { status: 409 });
    }
    const removed = versions.filter((item) => item.materialId === materialId);
    await writeTable("materials", materials.filter((item) => item.id !== materialId), encodeMaterial);
    await writeTable("materialVersions", versions.filter((item) => item.materialId !== materialId), encodeMaterialVersion);
    await Promise.all(removed.map(async (item) => {
      const path = safeLocalPath(item.filePath);
      await unlink(path).catch(() => undefined);
      await rmdir(dirname(path)).catch(() => undefined);
    }));
  });
}

export async function readLocalMaterialFile(versionId: string) {
  const version = (await readTable("materialVersions", decodeMaterialVersion)).find((item) => item.id === versionId);
  if (!version) return undefined;
  const path = safeLocalPath(version.filePath);
  await assertNoSymlink(materialDataDirectory(), path);
  return { version: withDownloadUrl(version), bytes: await readFile(/* turbopackIgnore: true */ path) };
}

export async function getLocalApplications() {
  return (await readTable("applications", decodeApplication)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getLocalApplication(id: string) {
  return (await getLocalApplications()).find((item) => item.id === id);
}

export function saveLocalApplication(application: Application) {
  return serializeWrite(async () => {
    const applications = await getLocalApplications();
    const existing = applications.find((item) => item.id === application.id);
    const next = { ...application, createdAt: existing?.createdAt ?? application.createdAt, updatedAt: new Date().toISOString() };
    await writeTable("applications", [...applications.filter((item) => item.id !== application.id), next], encodeApplication);
    return next;
  });
}

export function deleteLocalApplication(id: string) {
  return serializeWrite(async () => {
    await writeTable("applications", (await getLocalApplications()).filter((item) => item.id !== id), encodeApplication);
  });
}

export async function getLocalScoreSnapshots(programIds?: string[]) {
  const snapshots = await readTable("scoreSnapshots", decodeScoreSnapshot);
  const filter = programIds?.length ? new Set(programIds) : undefined;
  return snapshots.filter((item) => !filter || filter.has(item.programId)).sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));
}

export function saveLocalScoreSnapshots(values: ScoreSnapshot[]) {
  return serializeWrite(async () => {
    const current = await readTable("scoreSnapshots", decodeScoreSnapshot);
    const replaced = new Set(values.map((item) => item.id));
    const next = [...current.filter((item) => !replaced.has(item.id)), ...values];
    await writeTable("scoreSnapshots", next, encodeScoreSnapshot);
    return values;
  });
}

export async function getLocalMatchOverrides(programIds?: string[]) {
  const values = await readTable("matchOverrides", decodeMatchOverride);
  const filter = programIds?.length ? new Set(programIds) : undefined;
  return values.filter((item) => !filter || filter.has(item.programId));
}

export function saveLocalMatchOverride(value: RequirementMatchOverride) {
  return serializeWrite(async () => {
    const current = await readTable("matchOverrides", decodeMatchOverride);
    const next = { ...value, updatedAt: new Date().toISOString() };
    await writeTable("matchOverrides", [...current.filter((item) => item.id !== value.id && !(item.programId === value.programId && item.criterionId === value.criterionId)), next], encodeMatchOverride);
    return next;
  });
}

function calculateCompleteness(program: Program) {
  const facts = [program.degreeType, program.language, program.duration, program.ects, program.deadline, program.tuition, program.coreCourses.length, program.admissionCriteria.length, program.requirements.length, program.city];
  return Math.round(facts.filter(Boolean).length / facts.length * 100);
}

function parseChangeValue(change: FieldChange) {
  if (["coreCourses", "admissionCriteria", "requirements"].includes(change.field)) {
    try {
      return JSON.parse(change.proposedValue) as unknown;
    } catch {
      if (change.field !== "requirements") throw new Error("待审核变更的 JSON 内容无效。");
    }
  }
  return change.proposedValue;
}

export function decideLocalFieldChange(programId: string, changeId: string, decision: "accepted" | "rejected") {
  return serializeWrite(async () => {
    const [programs, changes] = await Promise.all([allLocalPrograms(), readTable("fieldChanges", decodeFieldChange)]);
    const program = programs.find((item) => item.id === programId);
    const change = changes.find((item) => item.id === changeId && item.programId === programId && item.status === "pending");
    if (!program || !change) return undefined;
    let nextProgram = program;
    if (decision === "accepted") {
      const allowed = new Set(["name", "degreeType", "language", "duration", "ects", "mode", "intakes", "deadline", "tuition", "coreCourses", "admissionCriteria", "requirements", "applicationFee", "premaster"]);
      if (!allowed.has(change.field)) throw new Error("该字段不允许通过审核接口写入。");
      const value = parseChangeValue(change);
      if (change.field === "requirements") {
        const additions = Array.isArray(value)
          ? value.map((item) => ({ ...(item as Program["requirements"][number]), verificationState: "confirmed" as const }))
          : [{ id: crypto.randomUUID(), category: "官网抓取", materialType: "other" as const, required: true, title: change.label, originalText: change.proposedValue, structuredRequirement: change.proposedValue, intake: "", sourceUrl: change.sourceUrl, fetchedAt: new Date().toISOString(), verificationState: "confirmed" as const, confidence: change.confidence }];
        nextProgram = { ...program, requirements: [...program.requirements, ...additions.filter((addition) => !program.requirements.some((item) => item.materialType === addition.materialType && item.title === addition.title))] };
      } else if (change.field === "admissionCriteria") {
        const criteria = Array.isArray(value) ? value.map((item) => ({ ...(item as Program["admissionCriteria"][number]), verificationState: "confirmed" as const })) : [];
        nextProgram = { ...program, admissionCriteria: criteria };
      } else if (change.field === "coreCourses") {
        nextProgram = { ...program, coreCourses: Array.isArray(value) ? value as Program["coreCourses"] : [] };
      } else if (change.field === "intakes") {
        nextProgram = { ...program, intakes: String(value).split(/,\s*/).filter(Boolean) };
      } else {
        nextProgram = { ...program, [change.field]: String(value) };
      }
      nextProgram = { ...nextProgram, dataCompleteness: calculateCompleteness(nextProgram), updatedAt: new Date().toISOString() };
      await writeTable("programs", programs.map((item) => item.id === programId ? nextProgram : item), encodeProgram);
    }
    await writeTable("fieldChanges", changes.map((item) => item.id === changeId ? { ...item, status: decision } : item), encodeFieldChange);
    return getLocalProgramDetail(programId);
  });
}

export function recordLocalRefresh(input: {
  program: Program;
  provider: string;
  snapshot: { sourceUrl: string; fetchedAt: string; contentHash: string; excerpts: string[]; parserVersion?: string };
  warnings: string[];
  automatic: Omit<FieldChange, "id" | "programId" | "status" | "createdAt">[];
  review: Omit<FieldChange, "id" | "programId" | "status" | "createdAt">[];
}) {
  return serializeWrite(async () => {
    const [programs, snapshots, changes] = await Promise.all([
      allLocalPrograms(), readTable("sourceSnapshots", decodeSnapshot), readTable("fieldChanges", decodeFieldChange),
    ]);
    const timestamp = input.snapshot.fetchedAt;
    const program = { ...input.program, lastFetchedAt: timestamp, dataCompleteness: calculateCompleteness(input.program), updatedAt: new Date().toISOString() };
    const snapshot: SourceSnapshot = {
      id: crypto.randomUUID(), programId: program.id, sourceUrl: input.snapshot.sourceUrl, fetchedAt: timestamp,
      contentHash: input.snapshot.contentHash, parserVersion: input.snapshot.parserVersion ?? "1.1.0", excerpts: input.snapshot.excerpts,
      provider: input.provider === "firecrawl" ? "firecrawl" : "direct",
    };
    const automatic = input.automatic.map((item) => ({ ...item, id: crypto.randomUUID(), programId: program.id, status: "applied" as const, createdAt: timestamp }));
    const review = input.review.map((item) => ({ ...item, id: crypto.randomUUID(), programId: program.id, status: "pending" as const, createdAt: timestamp }));
    await writeTable("sourceSnapshots", [...snapshots.filter((item) => !(item.programId === program.id && item.sourceUrl === snapshot.sourceUrl)), snapshot], encodeSnapshot);
    await writeTable("fieldChanges", [...changes, ...automatic, ...review], encodeFieldChange);
    await writeTable("programs", [...programs.filter((item) => item.id !== program.id), program], encodeProgram);
    const meta = await readRows("meta");
    await writeRows("meta", meta.filter((item) => item.key !== `refreshError:${program.id}` && item.key !== `refreshWarnings:${program.id}`).concat({ key: `refreshWarnings:${program.id}`, value: JSON.stringify(input.warnings) }));
    return getLocalProgramDetail(program.id) as Promise<ProgramDetail>;
  });
}

export function recordLocalRefreshFailure(programId: string, message: string) {
  return serializeWrite(async () => {
    const rows = await readRows("meta");
    await writeRows("meta", rows.filter((item) => item.key !== `refreshError:${programId}`).concat({ key: `refreshError:${programId}`, value: JSON.stringify({ message: message.slice(0, 1000), at: new Date().toISOString() }) }));
  });
}

export function recordLocalCollectionSkip(programId: string, lastFetchedAt: string) {
  return serializeWrite(async () => {
    const rows = await readRows("meta");
    const recordedAt = new Date().toISOString();
    const key = `collectionSkip:${recordedAt}:${programId}`;
    await writeRows("meta", rows.concat({ key, value: JSON.stringify({ programId, status: "skipped", reason: "cooldown", lastFetchedAt, recordedAt }) }));
  });
}

export async function previewLocalCatalogImport(programs: Program[]) {
  const existing = await allLocalPrograms();
  const existingMap = new Map(existing.map((item) => [item.id, item]));
  const newItems: Array<{ id: string; name: string }> = [];
  const conflicts: Array<{ id: string; name: string; reason: "different" | "identical" }> = [];
  for (const program of programs) {
    const current = existingMap.get(program.id);
    if (!current) newItems.push({ id: program.id, name: program.name });
    else conflicts.push({ id: program.id, name: program.name, reason: JSON.stringify(encodeProgram(current)) === JSON.stringify(encodeProgram(program)) ? "identical" : "different" });
  }
  return { newItems, conflicts };
}

export function importLocalCatalog(details: ProgramDetail[], overwriteIds: string[] = []) {
  return serializeWrite(async () => {
    const [programs, snapshots, changes] = await Promise.all([
      allLocalPrograms(), readTable("sourceSnapshots", decodeSnapshot), readTable("fieldChanges", decodeFieldChange),
    ]);
    const overwrite = new Set(overwriteIds);
    const importedIds = new Set<string>();
    const nextPrograms = [...programs];
    const nextSnapshots = [...snapshots];
    const nextChanges = [...changes];
    for (const detail of details) {
      const index = nextPrograms.findIndex((item) => item.id === detail.id);
      if (index >= 0 && !overwrite.has(detail.id)) continue;
      const program: Program = { ...detail };
      delete (program as Partial<ProgramDetail>).universities;
      delete (program as Partial<ProgramDetail>).sources;
      delete (program as Partial<ProgramDetail>).pendingChanges;
      if (index >= 0) nextPrograms[index] = program;
      else nextPrograms.push(program);
      nextSnapshots.splice(0, nextSnapshots.length, ...nextSnapshots.filter((item) => item.programId !== detail.id));
      for (const source of detail.sources) {
        nextSnapshots.push({ id: source.id, programId: detail.id, sourceUrl: source.sourceUrl, fetchedAt: source.fetchedAt ?? detail.lastFetchedAt ?? new Date().toISOString(), contentHash: source.contentHash, parserVersion: "remote-import", excerpts: source.excerpts, provider: source.provider });
      }
      nextChanges.splice(0, nextChanges.length, ...nextChanges.filter((item) => item.programId !== detail.id || item.status !== "pending"));
      nextChanges.push(...detail.pendingChanges);
      importedIds.add(detail.id);
    }
    await writeTable("programs", nextPrograms, encodeProgram);
    await writeTable("sourceSnapshots", nextSnapshots, encodeSnapshot);
    await writeTable("fieldChanges", nextChanges, encodeFieldChange);
    return [...importedIds];
  });
}

export async function readLocalBackupRecords(): Promise<{ records: BackupRecords; versions: StoredVersionRecord[] }> {
  const [profile, universities, programs, materials, versions, applications, sourceSnapshots, fieldChanges, scoreSnapshots, matchOverrides] = await Promise.all([
    getLocalProfile(), listLocalUniversities(), allLocalPrograms(), getLocalMaterials(), readTable("materialVersions", decodeMaterialVersion),
    getLocalApplications(), readTable("sourceSnapshots", decodeSnapshot), readTable("fieldChanges", decodeFieldChange),
    getLocalScoreSnapshots(), getLocalMatchOverrides(),
  ]);
  return {
    records: {
      profile, universities, programs, materials,
      materialVersions: versions.map((version) => {
        const metadata = { ...version } as Partial<StoredVersionRecord>;
        delete metadata.filePath;
        return metadata as Omit<StoredVersionRecord, "filePath">;
      }),
      applications, sourceSnapshots, fieldChanges, scoreSnapshots, matchOverrides,
    },
    versions,
  };
}

type ImportedVersion = Omit<StoredVersionRecord, "filePath"> & { bytes: Uint8Array };

function mergeById<T extends { id: string }>(current: T[], incoming: T[], replace: boolean) {
  if (replace) return incoming;
  const known = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !known.has(item.id))];
}

export function importLocalBackupRecords(records: BackupRecords, importedVersions: ImportedVersion[], replace = false) {
  return serializeWrite(async () => {
    const [currentProfile, currentUniversities, currentPrograms, currentMaterials, currentVersions, currentApplications, currentSnapshots, currentChanges, currentScores, currentOverrides] = await Promise.all([
      getLocalProfile(), listLocalUniversities(), allLocalPrograms(), getLocalMaterials(), readTable("materialVersions", decodeMaterialVersion),
      getLocalApplications(), readTable("sourceSnapshots", decodeSnapshot), readTable("fieldChanges", decodeFieldChange),
      getLocalScoreSnapshots(), getLocalMatchOverrides(),
    ]);

    const profile = records.profile ? decodeProfile(encodeProfile(records.profile)) : undefined;
    const universities = records.universities.map((item) => decodeUniversity(encodeUniversity(item)));
    const programs = records.programs.map((item) => decodeProgram(encodeProgram(item)));
    const materials = records.materials.map((item) => decodeMaterial(encodeMaterial(item)));
    const applications = records.applications.map((item) => decodeApplication(encodeApplication(item)));
    const snapshots = records.sourceSnapshots.map((item) => decodeSnapshot(encodeSnapshot(item)));
    const changes = records.fieldChanges.map((item) => decodeFieldChange(encodeFieldChange(item)));
    const scores = (records.scoreSnapshots ?? []).map((item) => decodeScoreSnapshot(encodeScoreSnapshot(item)));
    const overrides = (records.matchOverrides ?? []).map((item) => decodeMatchOverride(encodeMatchOverride(item)));

    const incomingStored: StoredVersionRecord[] = [];
    for (const version of importedVersions) {
      const filePath = await storeMaterialBytes(version.id, version.fileName, version.bytes);
      incomingStored.push(decodeMaterialVersion(encodeMaterialVersion({ ...version, filePath })));
    }

    const nextUniversities = replace && universities.length ? universities : mergeById(currentUniversities, universities, false);
    const nextPrograms = replace && programs.length ? programs : mergeById(currentPrograms, programs, false);
    const nextMaterials = mergeById(currentMaterials, materials, replace);
    const nextVersions = mergeById(currentVersions, incomingStored, replace);
    const nextApplications = mergeById(currentApplications, applications, replace);
    const nextSnapshots = mergeById(currentSnapshots, snapshots, replace);
    const nextChanges = mergeById(currentChanges, changes, replace);
    const nextScores = mergeById(currentScores, scores, replace);
    const nextOverrides = mergeById(currentOverrides, overrides, replace);

    if (profile && (replace || !currentProfile)) await writeTable("profile", [profile], encodeProfile);
    await writeTable("universities", nextUniversities, encodeUniversity);
    await writeTable("programs", nextPrograms, encodeProgram);
    await writeTable("materials", nextMaterials, encodeMaterial);
    await writeTable("materialVersions", nextVersions, encodeMaterialVersion);
    await writeTable("applications", nextApplications, encodeApplication);
    await writeTable("sourceSnapshots", nextSnapshots, encodeSnapshot);
    await writeTable("fieldChanges", nextChanges, encodeFieldChange);
    await writeTable("scoreSnapshots", nextScores, encodeScoreSnapshot);
    await writeTable("matchOverrides", nextOverrides, encodeMatchOverride);

    if (replace) {
      const kept = new Set(nextVersions.map((item) => item.id));
      await Promise.all(currentVersions.filter((item) => !kept.has(item.id)).map((item) => unlink(safeLocalPath(item.filePath)).catch(() => undefined)));
    }
    return {
      profile: profile && (replace || !currentProfile) ? 1 : 0,
      programs: nextPrograms.length - currentPrograms.length,
      materials: nextMaterials.length - currentMaterials.length,
      materialVersions: nextVersions.length - currentVersions.length,
      applications: nextApplications.length - currentApplications.length,
      sourceSnapshots: nextSnapshots.length - currentSnapshots.length,
      fieldChanges: nextChanges.length - currentChanges.length,
    };
  });
}

export async function localStoreCounts() {
  const [universities, programs] = await Promise.all([listLocalUniversities(), allLocalPrograms()]);
  return { universities: universities.length, programs: programs.length };
}
