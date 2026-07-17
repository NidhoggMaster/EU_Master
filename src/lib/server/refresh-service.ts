import "server-only";

import type { Program } from "@/lib/types";
import { refreshProgramForUniversity } from "@/lib/catalog-server";
import { getProgramDetail, recordRefresh, recordRefreshFailure, updateProgram } from "./catalog-repository";

declare global { var euMasterRefreshLocks: Set<string> | undefined; }
const locks = globalThis.euMasterRefreshLocks ?? new Set<string>();
globalThis.euMasterRefreshLocks = locks;

const automaticFields = new Set(["name", "degreeType", "language", "duration", "ects", "mode", "intakes"]);

function existingValue(program: Program, field: string) {
  const value = program[field as keyof Program];
  return Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value);
}

function completeness(program: Program) {
  const values = [program.degreeType, program.language, program.duration, program.ects, program.deadline, program.tuition, program.coreCourses.length, program.admissionCriteria.length, program.requirements.length, program.city];
  return Math.round(values.filter(Boolean).length / values.length * 100);
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
    const deferredReview: typeof result.reviewItems = [];
    for (const change of result.automaticUpdates) {
      if (!automaticFields.has(change.field)) continue;
      const previousValue = existingValue(program, change.field);
      if (previousValue === change.proposedValue) continue;
      if (previousValue) {
        deferredReview.push({ ...change, previousValue, risk: "review" });
        continue;
      }
      const nextValue = change.field === "intakes" ? change.proposedValue.split(/,\s*/) : change.proposedValue;
      program = { ...program, [change.field]: nextValue };
      automatic.push({ ...change, previousValue });
    }
    const review = [
      ...deferredReview,
      ...result.reviewItems.map((change) => ({ ...change, previousValue: existingValue(program, change.field) })),
    ];
    program = { ...program, lastFetchedAt: result.snapshot.fetchedAt, dataCompleteness: completeness(program) };
    await updateProgram(program);
    const stored = await recordRefresh({ program, provider: result.provider ?? "direct", snapshot: result.snapshot, warnings: result.warnings, automatic, review });
    return { program: stored, automaticUpdates: automatic, reviewItems: review, warnings: result.warnings, provider: result.provider };
  } catch (error) {
    if (attempted) await recordRefreshFailure(id, error instanceof Error ? error.message : "Unknown refresh error").catch(() => undefined);
    throw error;
  } finally {
    locks.delete(id);
  }
}
