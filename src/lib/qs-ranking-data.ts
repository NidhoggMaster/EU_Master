import data from "./qs-ranking-data.json";
import type { Program, RankingFact } from "./types";

const universityRankings = data.universityRankings as Record<string, RankingFact>;
const programSubjectRankings = data.programSubjectRankings as Record<string, RankingFact[]>;

export const QS_RANKING_DATA_UPDATED_AT = data.updatedAt;
export const QS_RANKED_UNIVERSITY_IDS = Object.freeze(Object.keys(universityRankings));
export const QS_RANKED_PROGRAM_IDS = Object.freeze(Object.keys(programSubjectRankings));

function cloneRanking(ranking: RankingFact): RankingFact {
  return { ...ranking };
}

export function universityRankingsFor(universityId: string): RankingFact[] {
  const ranking = universityRankings[universityId];
  return ranking ? [cloneRanking(ranking)] : [];
}

export function rankingsForProgram(program: Pick<Program, "id" | "institutionIds">): RankingFact[] {
  const worldRankings = program.institutionIds.flatMap(universityRankingsFor);
  const subjectRankings = programSubjectRankings[program.id]?.map(cloneRanking) ?? [];
  return [...worldRankings, ...subjectRankings];
}

export function universityRankingUpdates(): Record<string, RankingFact[]> {
  return Object.fromEntries(QS_RANKED_UNIVERSITY_IDS.map((id) => [id, universityRankingsFor(id)]));
}

export function programRankingUpdates(programs: Array<Pick<Program, "id" | "institutionIds">>): Record<string, RankingFact[]> {
  return Object.fromEntries(programs.filter((program) => programSubjectRankings[program.id]).map((program) => [program.id, rankingsForProgram(program)]));
}
