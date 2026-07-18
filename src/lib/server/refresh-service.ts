import "server-only";

import type { Program } from "@/lib/types";
import { refreshProgramForUniversity } from "@/lib/catalog-server";
import { getProgramDetail, recordRefresh, recordRefreshFailure, updateProgram } from "./catalog-service";

declare global { var euMasterRefreshLocks: Set<string> | undefined; }
const locks = globalThis.euMasterRefreshLocks ?? new Set<string>();
globalThis.euMasterRefreshLocks = locks;

const automaticFields = new Set([
  "name", "degreeType", "language", "duration", "ects", "mode", "intakes", "deadline", "tuition", "tuitionEur", "tuitionAcademicYear",
  "applicationFee", "applicationFeeEur", "applicationPlatform", "premaster", "coreCourses", "admissionCriteria", "requirements", "overview",
  "careerOutcomes", "applicationDates", "testRequirements", "chinaEligibility", "premasterInfo", "applicationLinks", "rankings",
]);

function existingValue(program: Program, field: string) {
  const value = program[field as keyof Program];
  if (value && typeof value === "object") return JSON.stringify(value);
  return Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value);
}

function completeness(program: Program) {
  const values = [
    program.degreeType, program.language, program.duration, program.ects, program.deadline, program.tuition, program.coreCourses.length,
    program.admissionCriteria.length, program.requirements.length, program.city, program.overview, program.applicationDates.length,
    program.testRequirements.length, program.premasterInfo, program.applicationLinks.eligibilityUrl || program.sourceUrl,
  ];
  return Math.round(values.filter(Boolean).length / values.length * 100);
}

function parseChangeValue(field: string, value: string) {
  if (["intakes"].includes(field)) return value.split(/,\s*/).filter(Boolean);
  if (["tuitionEur", "applicationFeeEur"].includes(field)) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  if (["coreCourses", "admissionCriteria", "requirements", "overview", "careerOutcomes", "applicationDates", "testRequirements", "chinaEligibility", "premasterInfo", "applicationLinks", "rankings"].includes(field)) {
    return JSON.parse(value) as unknown;
  }
  return value;
}

function confirmExtractedValue(field: string, value: unknown) {
  if (field === "admissionCriteria" && Array.isArray(value)) return value.map((item) => ({ ...(item as Program["admissionCriteria"][number]), verificationState: "confirmed" as const }));
  if (field === "requirements" && Array.isArray(value)) return value.map((item) => ({ ...(item as Program["requirements"][number]), verificationState: "confirmed" as const }));
  return value;
}

function mergeApplicationLinks(current: Program["applicationLinks"], incoming: Program["applicationLinks"]) {
  const entries = Object.entries(incoming).filter((entry): entry is [keyof Program["applicationLinks"], string] => Boolean(entry[1]?.trim()));
  return { ...current, ...Object.fromEntries(entries), programUrl: incoming.programUrl || current.programUrl };
}

export async function refreshStoredProgram(id: string) {
  if (locks.has(id)) throw Object.assign(new Error("该项目正在更新，请稍后再试。"), { status: 409 });
  locks.add(id);
  let attempted = false;
  try {
    const detail = await getProgramDetail(id);
    if (!detail) throw Object.assign(new Error("找不到这个项目。"), { status: 404 });
    if (detail.lastFetchedAt && Date.now() - new Date(detail.lastFetchedAt).getTime() < 24 * 60 * 60 * 1000) {
      throw Object.assign(new Error("该项目在 24 小时内已更新。"), { status: 429 });
    }
    const university = detail.universities[0];
    if (!university) throw Object.assign(new Error("项目缺少所属学校。"), { status: 422 });
    attempted = true;
    const result = await refreshProgramForUniversity(university, detail.sourceUrl);
    let program: Program = { ...detail };
    const automatic: typeof result.automaticUpdates = [];
    const warnings = [...result.warnings];
    for (const change of [...result.automaticUpdates, ...result.reviewItems]) {
      if (!automaticFields.has(change.field)) continue;
      if (program.fieldLocks.includes(change.field)) {
        warnings.push(`${change.label} 已手工锁定，本次未覆盖。`);
        continue;
      }
      const previousValue = existingValue(program, change.field);
      if (previousValue === change.proposedValue) continue;
      if (!change.proposedValue.trim()) {
        warnings.push(`${change.label} 未返回有效值，保留原数据。`);
        continue;
      }
      try {
        const nextValue = confirmExtractedValue(change.field, parseChangeValue(change.field, change.proposedValue));
        if (change.field === "applicationLinks") {
          program = { ...program, applicationLinks: mergeApplicationLinks(program.applicationLinks, nextValue as Program["applicationLinks"]) };
        } else {
          program = { ...program, [change.field]: nextValue };
        }
        automatic.push({ ...change, previousValue, risk: "low" });
      } catch {
        warnings.push(`${change.label} 的结构化结果无效，保留原数据。`);
      }
    }
    program = { ...program, lastFetchedAt: result.snapshot.fetchedAt, dataCompleteness: completeness(program) };
    await updateProgram(program);
    const stored = await recordRefresh({ program, provider: result.provider ?? "direct", snapshot: result.snapshot, warnings, automatic, review: [] });
    return { program: stored, automaticUpdates: automatic, reviewItems: [], warnings, provider: result.provider };
  } catch (error) {
    if (attempted) await recordRefreshFailure(id, error instanceof Error ? error.message : "Unknown refresh error").catch(() => undefined);
    throw error;
  } finally {
    locks.delete(id);
  }
}
