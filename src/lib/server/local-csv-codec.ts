import { z } from "zod";
import { applicantProfileSchema } from "@/lib/profile-schema";
import {
  MATERIAL_TYPES,
  PROGRAM_CATEGORIES,
  type ApplicantProfile,
  type Application,
  type FieldChange,
  type Material,
  type Program,
  type SourceSnapshot,
  type StoredMaterialVersion,
  type University,
} from "@/lib/types";

export type CsvRow = Record<string, string>;
export type StoredVersionRecord = Omit<StoredMaterialVersion, "downloadUrl">;

const text = z.string();
const optionalText = z.string().optional().default("");
const jsonText = z.string().transform((value, context) => {
  try {
    return JSON.parse(value || "null") as unknown;
  } catch {
    context.addIssue({ code: "custom", message: "JSON 列格式不正确" });
    return z.NEVER;
  }
});

function json<T>(value: T) {
  return JSON.stringify(value);
}

function nullableNumber(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`数值列无效：${value}`);
  return parsed;
}

export const TABLE_COLUMNS = {
  meta: ["key", "value"],
  profile: ["id", "basic", "education", "courses", "tests", "experiences", "skills", "preferences", "updatedAt"],
  universities: [
    "id", "name", "shortName", "city", "country", "homepageUrl", "catalogUrl", "allowedHosts", "campusName", "campusArea",
    "locationNotes", "livingCostMonthlyMinEur", "livingCostMonthlyMaxEur", "livingCostSourceUrl", "factsFetchedAt",
  ],
  programs: [
    "id", "institutionIds", "name", "categories", "sourceUrl", "faculty", "degreeType", "language", "duration", "ects", "mode", "intakes",
    "deadline", "tuition", "tuitionEur", "tuitionAcademicYear", "applicationFee", "applicationFeeEur", "applicationPlatform", "premaster", "quota",
    "campusName", "city", "campusArea", "locationNotes", "coreCourses", "admissionCriteria", "requirements", "dataCompleteness", "status",
    "lastFetchedAt", "createdAt", "updatedAt", "seeded",
  ],
  materials: ["id", "title", "type", "status", "currentVersionId", "createdAt", "updatedAt"],
  materialVersions: ["id", "materialId", "version", "fileName", "mimeType", "size", "filePath", "createdAt"],
  applications: ["id", "programId", "programName", "intake", "deadline", "status", "requirements", "tasks", "requirementsSourceUpdatedAt", "createdAt", "updatedAt"],
  sourceSnapshots: ["id", "programId", "sourceUrl", "fetchedAt", "contentHash", "parserVersion", "excerpts", "provider"],
  fieldChanges: ["id", "programId", "field", "label", "previousValue", "proposedValue", "sourceUrl", "excerpt", "confidence", "risk", "status", "createdAt"],
} as const;

const universityRowSchema = z.object({
  id: text.min(1), name: text.min(1), shortName: text.min(1), city: text, country: z.literal("NL"),
  homepageUrl: z.url(), catalogUrl: z.url(), allowedHosts: jsonText.pipe(z.array(z.string().min(1))),
  campusName: optionalText, campusArea: optionalText, locationNotes: optionalText,
  livingCostMonthlyMinEur: optionalText, livingCostMonthlyMaxEur: optionalText,
  livingCostSourceUrl: optionalText, factsFetchedAt: optionalText,
});

const programRowSchema = z.object({
  id: text.min(1), institutionIds: jsonText.pipe(z.array(z.string())), name: text.min(2),
  categories: jsonText.pipe(z.array(z.enum(PROGRAM_CATEGORIES)).min(1)), sourceUrl: z.url(), faculty: optionalText,
  degreeType: optionalText, language: optionalText, duration: optionalText, ects: optionalText, mode: optionalText,
  intakes: jsonText.pipe(z.array(z.string())), deadline: optionalText, tuition: optionalText, tuitionEur: optionalText,
  tuitionAcademicYear: optionalText, applicationFee: optionalText, applicationFeeEur: optionalText, applicationPlatform: optionalText,
  premaster: optionalText, quota: optionalText, campusName: optionalText, city: optionalText, campusArea: optionalText,
  locationNotes: optionalText, coreCourses: jsonText.pipe(z.array(z.unknown())), admissionCriteria: jsonText.pipe(z.array(z.unknown())),
  requirements: jsonText.pipe(z.array(z.unknown())), dataCompleteness: text, status: z.enum(["active", "candidate", "archived"]),
  lastFetchedAt: optionalText, createdAt: text, updatedAt: text, seeded: z.enum(["true", "false"]),
});

const materialRowSchema = z.object({
  id: text.min(1), title: text.min(1), type: z.enum(MATERIAL_TYPES), status: z.enum(["draft", "ready", "expired"]),
  currentVersionId: text.min(1), createdAt: text, updatedAt: text,
});

const materialVersionRowSchema = z.object({
  id: text.min(1), materialId: text.min(1), version: text, fileName: text.min(1), mimeType: text.min(1), size: text, filePath: text.min(1), createdAt: text,
});

const applicationRowSchema = z.object({
  id: text.min(1), programId: text.min(1), programName: text.min(1), intake: optionalText, deadline: optionalText,
  status: z.enum(["planning", "preparing", "submitted", "offer", "rejected", "withdrawn"]),
  requirements: jsonText.pipe(z.array(z.unknown())), tasks: jsonText.pipe(z.array(z.unknown())), requirementsSourceUpdatedAt: text,
  createdAt: text, updatedAt: text,
});

const snapshotRowSchema = z.object({
  id: text.min(1), programId: text.min(1), sourceUrl: z.url(), fetchedAt: text, contentHash: text,
  parserVersion: text, excerpts: jsonText.pipe(z.array(z.string())), provider: z.enum(["firecrawl", "direct", "seed"]).optional(),
});

const changeRowSchema = z.object({
  id: text.min(1), programId: text.min(1), field: text.min(1), label: text, previousValue: text, proposedValue: text,
  sourceUrl: z.url(), excerpt: text, confidence: text, risk: z.enum(["low", "review"]),
  status: z.enum(["applied", "pending", "accepted", "rejected"]), createdAt: text,
});

export function encodeProfile(profile: ApplicantProfile): CsvRow {
  return {
    id: profile.id, basic: json(profile.basic), education: json(profile.education), courses: json(profile.courses), tests: json(profile.tests),
    experiences: json(profile.experiences), skills: json(profile.skills), preferences: json(profile.preferences), updatedAt: profile.updatedAt,
  };
}

export function decodeProfile(row: CsvRow) {
  const parsed = z.object({ id: z.literal("current"), basic: jsonText, education: jsonText, courses: jsonText, tests: jsonText, experiences: jsonText, skills: jsonText, preferences: jsonText, updatedAt: text }).parse(row);
  return applicantProfileSchema.parse(parsed);
}

export function encodeUniversity(value: University): CsvRow {
  return {
    id: value.id, name: value.name, shortName: value.shortName, city: value.city, country: value.country,
    homepageUrl: value.homepageUrl, catalogUrl: value.catalogUrl, allowedHosts: json(value.allowedHosts), campusName: value.campusName ?? "",
    campusArea: value.campusArea ?? "", locationNotes: value.locationNotes ?? "", livingCostMonthlyMinEur: value.livingCostMonthlyMinEur?.toString() ?? "",
    livingCostMonthlyMaxEur: value.livingCostMonthlyMaxEur?.toString() ?? "", livingCostSourceUrl: value.livingCostSourceUrl ?? "", factsFetchedAt: value.factsFetchedAt ?? "",
  };
}

export function decodeUniversity(row: CsvRow): University {
  const value = universityRowSchema.parse(row);
  return {
    ...value,
    allowedHosts: value.allowedHosts,
    livingCostMonthlyMinEur: nullableNumber(value.livingCostMonthlyMinEur),
    livingCostMonthlyMaxEur: nullableNumber(value.livingCostMonthlyMaxEur),
    livingCostSourceUrl: value.livingCostSourceUrl || undefined,
    factsFetchedAt: value.factsFetchedAt || undefined,
  };
}

export function encodeProgram(value: Program): CsvRow {
  return {
    id: value.id, institutionIds: json(value.institutionIds), name: value.name, categories: json(value.categories), sourceUrl: value.sourceUrl,
    faculty: value.faculty, degreeType: value.degreeType, language: value.language, duration: value.duration, ects: value.ects, mode: value.mode,
    intakes: json(value.intakes), deadline: value.deadline, tuition: value.tuition, tuitionEur: value.tuitionEur?.toString() ?? "",
    tuitionAcademicYear: value.tuitionAcademicYear, applicationFee: value.applicationFee, applicationFeeEur: value.applicationFeeEur?.toString() ?? "",
    applicationPlatform: value.applicationPlatform, premaster: value.premaster, quota: value.quota, campusName: value.campusName, city: value.city,
    campusArea: value.campusArea, locationNotes: value.locationNotes, coreCourses: json(value.coreCourses), admissionCriteria: json(value.admissionCriteria),
    requirements: json(value.requirements), dataCompleteness: String(value.dataCompleteness), status: value.status, lastFetchedAt: value.lastFetchedAt ?? "",
    createdAt: value.createdAt, updatedAt: value.updatedAt, seeded: String(value.seeded),
  };
}

export function decodeProgram(row: CsvRow): Program {
  const value = programRowSchema.parse(row);
  const completeness = Number(value.dataCompleteness);
  if (!Number.isFinite(completeness) || completeness < 0 || completeness > 100) throw new Error("项目完整度必须在 0 到 100 之间。");
  return {
    ...value,
    coreCourses: value.coreCourses as Program["coreCourses"], admissionCriteria: value.admissionCriteria as Program["admissionCriteria"],
    requirements: value.requirements as Program["requirements"], tuitionEur: nullableNumber(value.tuitionEur),
    applicationFeeEur: nullableNumber(value.applicationFeeEur), dataCompleteness: completeness,
    lastFetchedAt: value.lastFetchedAt || undefined, seeded: value.seeded === "true",
  };
}

export const encodeMaterial = (value: Material): CsvRow => ({ ...value });
export const decodeMaterial = (row: CsvRow): Material => materialRowSchema.parse(row);

export function encodeMaterialVersion(value: StoredVersionRecord): CsvRow {
  return { ...value, version: String(value.version), size: String(value.size) };
}

export function decodeMaterialVersion(row: CsvRow): StoredVersionRecord {
  const value = materialVersionRowSchema.parse(row);
  const version = Number(value.version);
  const size = Number(value.size);
  if (!Number.isInteger(version) || version < 1 || !Number.isInteger(size) || size < 0) throw new Error("材料版本数值字段无效。");
  return { ...value, version, size };
}

export function encodeApplication(value: Application): CsvRow {
  return { ...value, requirements: json(value.requirements), tasks: json(value.tasks) };
}

export function decodeApplication(row: CsvRow): Application {
  const value = applicationRowSchema.parse(row);
  return { ...value, requirements: value.requirements as Application["requirements"], tasks: value.tasks as Application["tasks"] };
}

export function encodeSnapshot(value: SourceSnapshot): CsvRow {
  return { ...value, excerpts: json(value.excerpts), provider: value.provider ?? "direct" };
}

export function decodeSnapshot(row: CsvRow): SourceSnapshot {
  const value = snapshotRowSchema.parse(row);
  return { ...value, provider: value.provider ?? "direct" };
}

export function encodeFieldChange(value: FieldChange): CsvRow {
  return { ...value, confidence: String(value.confidence) };
}

export function decodeFieldChange(row: CsvRow): FieldChange {
  const value = changeRowSchema.parse(row);
  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error("字段变更置信度必须在 0 到 1 之间。");
  return { ...value, confidence };
}
