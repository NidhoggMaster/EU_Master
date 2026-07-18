import "server-only";

import { z } from "zod";
import { APPLICATION_SCORE_WEIGHTS, CATALOG_SCORE_WEIGHTS } from "@/lib/matching";
import { MATCH_DIMENSIONS, type MatchDimension, type ScoringSettings } from "@/lib/types";
import { getLocalMeta, setLocalMeta } from "./local-store";

const weightsSchema = z.object(Object.fromEntries(MATCH_DIMENSIONS.map((key) => [key, z.number().min(0).max(100)])) as Record<MatchDimension, z.ZodNumber>);
const scoringSettingsSchema = z.object({
  catalog: weightsSchema,
  application: weightsSchema,
  version: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const DEFAULT_SCORING_SETTINGS: ScoringSettings = {
  catalog: CATALOG_SCORE_WEIGHTS,
  application: APPLICATION_SCORE_WEIGHTS,
  version: "score-v2.0",
  updatedAt: "",
};

function assertTotal(weights: Record<MatchDimension, number>, label: string) {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 100) > 0.001) throw Object.assign(new Error(`${label}权重合计必须为 100%，当前为 ${total}%。`), { status: 400 });
}

export async function getScoringSettings(): Promise<ScoringSettings> {
  const stored = await getLocalMeta("scoringSettings");
  if (!stored) return structuredClone(DEFAULT_SCORING_SETTINGS);
  try {
    const parsed = scoringSettingsSchema.parse(JSON.parse(stored));
    assertTotal(parsed.catalog, "项目目录");
    assertTotal(parsed.application, "项目申请");
    return parsed;
  } catch {
    return structuredClone(DEFAULT_SCORING_SETTINGS);
  }
}

export async function saveScoringSettings(input: Pick<ScoringSettings, "catalog" | "application">) {
  const parsed = scoringSettingsSchema.pick({ catalog: true, application: true }).parse(input);
  assertTotal(parsed.catalog, "项目目录");
  assertTotal(parsed.application, "项目申请");
  const timestamp = new Date().toISOString();
  const settings: ScoringSettings = { ...parsed, version: `custom-${timestamp}`, updatedAt: timestamp };
  await setLocalMeta("scoringSettings", JSON.stringify(settings));
  return settings;
}
