import "server-only";

import {
  programRankingUpdates,
  QS_RANKED_PROGRAM_IDS,
  QS_RANKED_UNIVERSITY_IDS,
  QS_RANKING_DATA_UPDATED_AT,
  universityRankingUpdates,
} from "@/lib/qs-ranking-data";
import { updateProgramRankings } from "./catalog-repository";
import { listLocalPrograms, updateLocalRankingData } from "./local-store";

export async function applyQsRankingData() {
  const localPrograms = await listLocalPrograms({ status: "active" });
  const programRankings = programRankingUpdates(localPrograms);
  if (QS_RANKED_PROGRAM_IDS.some((id) => !programRankings[id])) {
    const present = new Set(Object.keys(programRankings));
    throw new Error(`本地目录缺少排名目标项目：${QS_RANKED_PROGRAM_IDS.filter((id) => !present.has(id)).join("、")}`);
  }
  const universityRankings = universityRankingUpdates();
  if (Object.keys(universityRankings).length !== QS_RANKED_UNIVERSITY_IDS.length) throw new Error("学校排名数据不完整。");

  const remote = await updateProgramRankings(programRankings, QS_RANKING_DATA_UPDATED_AT);
  const local = await updateLocalRankingData(universityRankings, programRankings, QS_RANKING_DATA_UPDATED_AT);
  return { version: "QS World 2027 / QS by Subject 2026", updatedAt: QS_RANKING_DATA_UPDATED_AT, local, supabase: remote };
}
