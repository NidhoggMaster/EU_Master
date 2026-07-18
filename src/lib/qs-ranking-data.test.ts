import { describe, expect, it } from "vitest";
import { seededPrograms, universities } from "./catalog-data";
import { QS_RANKED_PROGRAM_IDS, QS_RANKED_UNIVERSITY_IDS, rankingsForProgram, universityRankingsFor } from "./qs-ranking-data";

describe("QS ranking data", () => {
  it("covers the 13 ranked Dutch universities and all seeded programmes", () => {
    expect(QS_RANKED_UNIVERSITY_IDS).toHaveLength(13);
    expect(QS_RANKED_PROGRAM_IDS).toHaveLength(13);
    expect(universities.find((item) => item.id === "ou")?.rankings).toEqual([]);
    expect(seededPrograms.every((program) => program.rankings.length >= 2 && program.fieldLocks.includes("rankings"))).toBe(true);
  });

  it("keeps university totals ahead of relevant subject rankings", () => {
    expect(universityRankingsFor("uva").map((item) => item.rank)).toEqual(["60"]);
    expect(rankingsForProgram({ id: "uva-ds", institutionIds: ["uva"] }).map((item) => item.rank)).toEqual(["60", "51–100", "62", "30"]);
    expect(rankingsForProgram({ id: "jads-dsbe", institutionIds: ["tilburg", "tue"] }).map((item) => item.rank)).toEqual(["429", "152", "=111", "101–200", "117"]);
  });
});
