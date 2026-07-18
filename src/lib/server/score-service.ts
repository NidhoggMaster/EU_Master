import "server-only";

import { compareProgram } from "@/lib/matching";
import { emptyProfile } from "@/lib/progress";
import type { ProgramComparison, ScoreSnapshot } from "@/lib/types";
import { getProgramDetails } from "./catalog-service";
import { getEurCnyRate } from "./exchange-rates";
import {
  getLocalMatchOverrides,
  getLocalMaterials,
  getLocalProfile,
  getLocalScoreSnapshots,
  saveLocalScoreSnapshots,
} from "./local-store";
import { getScoringSettings } from "./scoring-settings";

export async function calculateCatalogScores(programIds: string[]) {
  const ids = [...new Set(programIds)].slice(0, 100);
  const [programs, profile, materials, overrides, exchangeRate, scoringSettings] = await Promise.all([
    getProgramDetails(ids), getLocalProfile(), getLocalMaterials(), getLocalMatchOverrides(ids), getEurCnyRate(), getScoringSettings(),
  ]);
  if (programs.length !== ids.length) throw Object.assign(new Error("部分项目不存在。"), { status: 404 });
  const readyTypes = materials.filter((item) => item.prepared || item.status === "ready").map((item) => item.type);
  const applicant = profile ?? emptyProfile();
  const comparisons = programs.map((program) => compareProgram(program, applicant, readyTypes, exchangeRate.rate, programs[0], overrides, scoringSettings.catalog));
  return { comparisons, exchangeRate, profile: applicant, materials, scoringSettings };
}

export async function confirmCatalogScores(programIds: string[]) {
  const calculated = await calculateCatalogScores(programIds);
  const timestamp = new Date().toISOString();
  const materialUpdatedAt = calculated.materials.map((item) => item.updatedAt).sort().at(-1) ?? "";
  const snapshots: ScoreSnapshot[] = calculated.comparisons.map((comparison) => ({
    id: crypto.randomUUID(), kind: "catalog", programId: comparison.program.id, applicationId: "", score: comparison.score,
    evidenceCoverage: comparison.evidenceCoverage, probabilityMinimum: comparison.probabilityMinimum, probabilityMaximum: comparison.probabilityMaximum,
    hardRisks: comparison.hardRisks, dimensions: comparison.dimensions, weights: calculated.scoringSettings.catalog, weightsVersion: calculated.scoringSettings.version,
    profileUpdatedAt: calculated.profile.updatedAt, programUpdatedAt: comparison.program.updatedAt, materialUpdatedAt, confirmedAt: timestamp,
  }));
  await saveLocalScoreSnapshots(snapshots);
  return { ...calculated, snapshots };
}

export async function latestCatalogScores(programIds?: string[]) {
  const [snapshots, profile, materials, programs] = await Promise.all([
    getLocalScoreSnapshots(programIds), getLocalProfile(), getLocalMaterials(), programIds?.length ? getProgramDetails(programIds) : Promise.resolve([]),
  ]);
  const latest = new Map<string, ScoreSnapshot>();
  for (const snapshot of snapshots) if (snapshot.kind === "catalog" && !latest.has(snapshot.programId)) latest.set(snapshot.programId, snapshot);
  const programVersions = new Map(programs.map((item) => [item.id, item.updatedAt]));
  const materialUpdatedAt = materials.map((item) => item.updatedAt).sort().at(-1) ?? "";
  return [...latest.values()].map((snapshot) => ({
    ...snapshot,
    stale: snapshot.profileUpdatedAt !== (profile?.updatedAt ?? "") || (programVersions.has(snapshot.programId) && snapshot.programUpdatedAt !== programVersions.get(snapshot.programId)) || snapshot.materialUpdatedAt !== materialUpdatedAt,
  }));
}

export function comparisonToPublicScore(comparison: ProgramComparison) {
  return {
    programId: comparison.program.id, score: comparison.score, evidenceCoverage: comparison.evidenceCoverage, scoreStatus: comparison.scoreStatus,
    probabilityMinimum: comparison.probabilityMinimum, probabilityMaximum: comparison.probabilityMaximum, hardRisks: comparison.hardRisks,
    dimensions: comparison.dimensions,
  };
}
