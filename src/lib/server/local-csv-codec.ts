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
  type RequirementMatchOverride,
  type ScoreSnapshot,
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
const optionalJsonText = z.string().optional().default("").transform((value, context) => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
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
    "locationNotes", "livingCostMonthlyMinEur", "livingCostMonthlyMaxEur", "livingCostSourceUrl", "factsFetchedAt", "rankings",
  ],
  programs: [
    "id", "institutionIds", "name", "categories", "sourceUrl", "faculty", "degreeType", "language", "duration", "ects", "mode", "intakes",
    "deadline", "tuition", "tuitionEur", "tuitionAcademicYear", "applicationFee", "applicationFeeEur", "applicationPlatform", "premaster", "quota",
    "campusName", "city", "campusArea", "locationNotes", "coreCourses", "admissionCriteria", "requirements", "dataCompleteness", "status",
    "lastFetchedAt", "createdAt", "updatedAt", "seeded", "overview", "rankings", "careerOutcomes", "applicationDates", "testRequirements",
    "chinaEligibility", "premasterInfo", "applicationLinks", "admissionProbabilityPrior", "fieldLocks",
  ],
  materials: ["id", "title", "type", "status", "currentVersionId", "createdAt", "updatedAt", "scope", "programId", "requirementId", "prepared", "notes", "archived"],
  materialVersions: ["id", "materialId", "version", "fileName", "mimeType", "size", "filePath", "createdAt"],
  applications: ["id", "programId", "programName", "intake", "deadline", "status", "requirements", "tasks", "requirementsSourceUpdatedAt", "createdAt", "updatedAt"],
  sourceSnapshots: ["id", "programId", "sourceUrl", "fetchedAt", "contentHash", "parserVersion", "excerpts", "provider"],
  fieldChanges: ["id", "programId", "field", "label", "previousValue", "proposedValue", "sourceUrl", "excerpt", "confidence", "risk", "status", "createdAt"],
  scoreSnapshots: ["id", "kind", "programId", "applicationId", "score", "evidenceCoverage", "probabilityMinimum", "probabilityMaximum", "hardRisks", "dimensions", "weights", "weightsVersion", "profileUpdatedAt", "programUpdatedAt", "materialUpdatedAt", "confirmedAt"],
  matchOverrides: ["id", "programId", "criterionId", "state", "note", "updatedAt"],
} as const;

const universityRowSchema = z.object({
  id: text.min(1), name: text.min(1), shortName: text.min(1), city: text, country: z.literal("NL"),
  homepageUrl: z.url(), catalogUrl: z.url(), allowedHosts: jsonText.pipe(z.array(z.string().min(1))),
  campusName: optionalText, campusArea: optionalText, locationNotes: optionalText,
  livingCostMonthlyMinEur: optionalText, livingCostMonthlyMaxEur: optionalText,
  livingCostSourceUrl: optionalText, factsFetchedAt: optionalText, rankings: optionalJsonText,
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
  overview: optionalJsonText, rankings: optionalJsonText, careerOutcomes: optionalJsonText, applicationDates: optionalJsonText,
  testRequirements: optionalJsonText, chinaEligibility: optionalJsonText, premasterInfo: optionalJsonText,
  applicationLinks: optionalJsonText, admissionProbabilityPrior: optionalJsonText, fieldLocks: optionalJsonText,
});

const materialRowSchema = z.object({
  id: text.min(1), title: text.min(1), type: z.enum(MATERIAL_TYPES), status: z.enum(["draft", "ready", "expired"]),
  currentVersionId: text, createdAt: text, updatedAt: text,
  scope: z.enum(["basic", "program"]).optional().default("basic"), programId: optionalText, requirementId: optionalText,
  prepared: z.enum(["true", "false"]).optional(), notes: optionalText, archived: z.enum(["true", "false"]).optional(),
});

const materialVersionRowSchema = z.object({
  id: text.min(1), materialId: text.min(1), version: text, fileName: text.min(1), mimeType: text.min(1), size: text, filePath: text.min(1), createdAt: text,
});

const applicationRowSchema = z.object({
  id: text.min(1), programId: text.min(1), programName: text.min(1), intake: optionalText, deadline: optionalText,
  status: z.enum(["planning", "preparing", "submitted", "offer", "rejected", "withdrawn"]),
  requirements: jsonText.pipe(z.array(z.unknown())), tasks: jsonText.pipe(z.array(z.unknown())), requirementsSourceUpdatedAt: text,
  createdAt: text, updatedAt: text, startDate: optionalText, endDate: optionalText, studielinkUrl: optionalText, scoreSnapshotId: optionalText,
});

const snapshotRowSchema = z.object({
  id: text.min(1), programId: text.min(1), sourceUrl: z.url(), fetchedAt: text, contentHash: text,
  parserVersion: text, excerpts: jsonText.pipe(z.array(z.string())), provider: z.enum(["firecrawl", "direct", "seed"]).optional(),
});

const changeRowSchema = z.object({
  id: text.min(1), programId: text.min(1), field: text.min(1), label: text, previousValue: text, proposedValue: text,
  sourceUrl: z.url(), excerpt: text, confidence: text, risk: z.enum(["low", "review"]),
  status: z.enum(["applied", "pending", "accepted", "rejected", "superseded"]), createdAt: text,
});

const scoreSnapshotRowSchema = z.object({
  id: text.min(1), kind: z.enum(["catalog", "application"]), programId: text.min(1), applicationId: optionalText,
  score: optionalText, evidenceCoverage: text, probabilityMinimum: optionalText, probabilityMaximum: optionalText,
  hardRisks: jsonText, dimensions: jsonText, weights: jsonText, weightsVersion: text,
  profileUpdatedAt: optionalText, programUpdatedAt: text, materialUpdatedAt: optionalText, confirmedAt: text,
});

const matchOverrideRowSchema = z.object({
  id: text.min(1), programId: text.min(1), criterionId: text.min(1), state: z.enum(["matched", "partial", "not_matched", "unknown"]),
  note: optionalText, updatedAt: text,
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
    rankings: json(value.rankings ?? []),
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
    rankings: (value.rankings as University["rankings"]) ?? [],
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
    createdAt: value.createdAt, updatedAt: value.updatedAt, seeded: String(value.seeded), overview: json(value.overview), rankings: json(value.rankings),
    careerOutcomes: json(value.careerOutcomes), applicationDates: json(value.applicationDates), testRequirements: json(value.testRequirements),
    chinaEligibility: json(value.chinaEligibility), premasterInfo: json(value.premasterInfo), applicationLinks: json(value.applicationLinks),
    admissionProbabilityPrior: json(value.admissionProbabilityPrior), fieldLocks: json(value.fieldLocks),
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
    overview: (value.overview as Program["overview"]) ?? null,
    rankings: (value.rankings as Program["rankings"]) ?? [],
    careerOutcomes: (value.careerOutcomes as Program["careerOutcomes"]) ?? [],
    applicationDates: (value.applicationDates as Program["applicationDates"]) ?? [],
    testRequirements: (value.testRequirements as Program["testRequirements"]) ?? [],
    chinaEligibility: (value.chinaEligibility as Program["chinaEligibility"]) ?? null,
    premasterInfo: (value.premasterInfo as Program["premasterInfo"]) ?? null,
    applicationLinks: (value.applicationLinks as Program["applicationLinks"]) ?? {
      programUrl: value.sourceUrl, curriculumUrl: "", eligibilityUrl: "", materialsUrl: "", careersUrl: "", premasterUrl: "", studielinkUrl: "https://www.studielink.nl/",
    },
    admissionProbabilityPrior: (value.admissionProbabilityPrior as Program["admissionProbabilityPrior"]) ?? null,
    fieldLocks: (value.fieldLocks as string[] | undefined) ?? [],
  };
}

export const encodeMaterial = (value: Material): CsvRow => ({ ...value, prepared: String(value.prepared), archived: String(value.archived) });
export function decodeMaterial(row: CsvRow): Material {
  const value = materialRowSchema.parse(row);
  return { ...value, prepared: value.prepared ? value.prepared === "true" : value.status === "ready", archived: value.archived === "true" };
}

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
  return {
    ...value, requirements: value.requirements as Application["requirements"], tasks: value.tasks as Application["tasks"],
    startDate: value.startDate || undefined, endDate: value.endDate || undefined, studielinkUrl: value.studielinkUrl || undefined,
    scoreSnapshotId: value.scoreSnapshotId || undefined,
  };
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

export function encodeScoreSnapshot(value: ScoreSnapshot): CsvRow {
  return {
    ...value, score: value.score?.toString() ?? "", evidenceCoverage: String(value.evidenceCoverage),
    probabilityMinimum: value.probabilityMinimum?.toString() ?? "", probabilityMaximum: value.probabilityMaximum?.toString() ?? "",
    hardRisks: json(value.hardRisks), dimensions: json(value.dimensions), weights: json(value.weights),
  };
}

export function decodeScoreSnapshot(row: CsvRow): ScoreSnapshot {
  const value = scoreSnapshotRowSchema.parse(row);
  const evidenceCoverage = Number(value.evidenceCoverage);
  if (!Number.isFinite(evidenceCoverage) || evidenceCoverage < 0 || evidenceCoverage > 100) throw new Error("评分证据覆盖率无效。");
  return {
    ...value, score: nullableNumber(value.score), evidenceCoverage,
    probabilityMinimum: nullableNumber(value.probabilityMinimum), probabilityMaximum: nullableNumber(value.probabilityMaximum),
    hardRisks: value.hardRisks as string[], dimensions: value.dimensions as ScoreSnapshot["dimensions"], weights: value.weights as Record<string, number>,
  };
}

export const encodeMatchOverride = (value: RequirementMatchOverride): CsvRow => ({ ...value });
export const decodeMatchOverride = (row: CsvRow): RequirementMatchOverride => matchOverrideRowSchema.parse(row);
