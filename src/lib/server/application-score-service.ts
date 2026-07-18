import "server-only";

import { baseProbabilityInterval, compareProgram, weightedGeometricScore } from "@/lib/matching";
import { emptyProfile } from "@/lib/progress";
import type { MatchDimension, MatchDimensionScore, ScoreSnapshot } from "@/lib/types";
import { getProgramDetail } from "./catalog-service";
import { getEurCnyRate } from "./exchange-rates";
import {
  getLocalApplication,
  getLocalMatchOverrides,
  getLocalMaterials,
  getLocalProfile,
  getLocalScoreSnapshots,
  saveLocalScoreSnapshots,
} from "./local-store";
import { getScoringSettings } from "./scoring-settings";

export { APPLICATION_SCORE_WEIGHTS } from "@/lib/matching";
const BASIC_TYPES = new Set(["transcript", "degree_certificate", "cv", "passport", "english_test"]);

function materialDimension(key: "basicMaterials" | "specialMaterials", label: string, required: string[], ready: string[], weight: number): MatchDimensionScore {
  const unique = [...new Set(required)];
  const complete = unique.filter((type) => ready.includes(type));
  return {
    key, label, weight, score: unique.length ? Math.round(complete.length / unique.length * 100) : 100, earned: 0, known: true,
    reasons: [`已准备 ${complete.length}/${unique.length || 0} 类。`], missingEvidence: unique.filter((type) => !ready.includes(type)),
  };
}

function adjustedProbability(minimum: number, maximum: number, score: number) {
  const adjust = (value: number) => {
    const p = Math.max(0.001, Math.min(0.999, value));
    const shifted = Math.log(p / (1 - p)) + 0.8 * ((score - 50) / 25);
    return Math.max(1, Math.min(99, Math.round(100 / (1 + Math.exp(-shifted)))));
  };
  return { minimum: adjust(minimum), maximum: adjust(maximum) };
}

export async function calculateApplicationScore(applicationId: string) {
  const application = await getLocalApplication(applicationId);
  if (!application) throw Object.assign(new Error("找不到申请。"), { status: 404 });
  const [program, profile, materials, overrides, rate, scoringSettings] = await Promise.all([
    getProgramDetail(application.programId), getLocalProfile(), getLocalMaterials(), getLocalMatchOverrides([application.programId]), getEurCnyRate(), getScoringSettings(),
  ]);
  if (!program) throw Object.assign(new Error("申请关联的项目不存在。"), { status: 404 });
  const readyMaterials = materials.filter((item) => item.prepared || item.status === "ready");
  const catalog = compareProgram(program, profile ?? emptyProfile(), readyMaterials.map((item) => item.type), rate.rate, undefined, overrides);
  const catalogByKey = new Map(catalog.dimensions.map((item) => [item.key, item]));
  const requiredTypes = program.requirements.filter((item) => item.required).map((item) => item.materialType);
  const basicRequired = [...BASIC_TYPES].filter((type) => requiredTypes.includes(type as never) || materials.some((item) => item.scope === "basic" && item.type === type));
  const specialRequired = requiredTypes.filter((type) => !BASIC_TYPES.has(type));
  const basicReady = readyMaterials.filter((item) => item.scope === "basic").map((item) => item.type);
  const specialReady = readyMaterials
    .filter((item) => item.scope === "program" && item.programId === program.id)
    .map((item) => item.type);
  const keys: MatchDimension[] = ["language", "courses", "degree", "gpa", "project"];
  const dimensions = keys.map((key) => ({ ...(catalogByKey.get(key)!), weight: scoringSettings.application[key] ?? 0 }));
  dimensions.push(materialDimension("basicMaterials", "基本材料", basicRequired, basicReady, scoringSettings.application.basicMaterials));
  dimensions.push(materialDimension("specialMaterials", "项目特需材料", specialRequired, specialReady, scoringSettings.application.specialMaterials));
  const aggregate = weightedGeometricScore(dimensions);
  const taskReadiness = application.tasks.length ? application.tasks.filter((item) => item.completed).length / application.tasks.length : 1;
  const basicFraction = dimensions.find((item) => item.key === "basicMaterials")!.score / 100;
  const specialFraction = dimensions.find((item) => item.key === "specialMaterials")!.score / 100;
  const readiness = Math.round((basicFraction * 0.6 + specialFraction * 0.3 + taskReadiness * 0.1) * 100);
  const baseProbability = program.admissionProbabilityPrior ? baseProbabilityInterval(program.admissionProbabilityPrior) : null;
  const probability = baseProbability && aggregate.score != null && !catalog.hardRisks.length
    ? adjustedProbability(baseProbability.minimum, baseProbability.maximum, aggregate.score)
    : { minimum: null, maximum: null };
  return { application, program, materials, profile: profile ?? emptyProfile(), dimensions, score: aggregate.score, evidenceCoverage: aggregate.coverage, readiness, hardRisks: catalog.hardRisks, probabilityMinimum: probability.minimum, probabilityMaximum: probability.maximum, scoringSettings };
}

export async function confirmApplicationScore(applicationId: string) {
  const result = await calculateApplicationScore(applicationId);
  const timestamp = new Date().toISOString();
  const snapshot: ScoreSnapshot = {
    id: crypto.randomUUID(), kind: "application", programId: result.program.id, applicationId, score: result.score,
    evidenceCoverage: result.evidenceCoverage, probabilityMinimum: result.probabilityMinimum, probabilityMaximum: result.probabilityMaximum,
    hardRisks: result.hardRisks, dimensions: result.dimensions, weights: result.scoringSettings.application, weightsVersion: result.scoringSettings.version,
    profileUpdatedAt: result.profile.updatedAt, programUpdatedAt: result.program.updatedAt,
    materialUpdatedAt: result.materials.map((item) => item.updatedAt).sort().at(-1) ?? "", confirmedAt: timestamp,
  };
  await saveLocalScoreSnapshots([snapshot]);
  return { ...result, snapshot };
}

export async function latestApplicationScore(applicationId: string) {
  return (await getLocalScoreSnapshots()).find((item) => item.kind === "application" && item.applicationId === applicationId);
}
