import { describe, expect, it } from "vitest";
import { seededPrograms, universities } from "./catalog-data";
import { compareProgram, similarity, standardTags } from "./matching";
import { emptyProfile } from "./progress";
import type { ProgramDetail } from "./types";

function programme(): ProgramDetail {
  return {
    ...structuredClone(seededPrograms[0]),
    tuitionEur: 20_000,
    applicationFeeEur: 100,
    dataCompleteness: 80,
    coreCourses: [{ name: "Statistics and Python", tags: ["statistics", "programming"] }],
    admissionCriteria: [
      { id: "course", kind: "prerequisite", title: "Statistics and programming", description: "Prior statistics and programming", required: true, tags: ["statistics", "programming"], sourceUrl: "https://example.edu", verificationState: "confirmed" },
      { id: "degree", kind: "degree", title: "Relevant bachelor", description: "Bachelor in business or information systems", required: true, tags: ["business"], sourceUrl: "https://example.edu", verificationState: "confirmed" },
      { id: "gpa", kind: "gpa", title: "GPA", description: "Minimum 7.5", required: true, tags: [], minimum: 7.5, sourceUrl: "https://example.edu", verificationState: "confirmed" },
      { id: "language", kind: "language", title: "IELTS", description: "IELTS 6.5", required: true, tags: [], minimum: 6.5, testType: "IELTS", sourceUrl: "https://example.edu", verificationState: "confirmed" },
    ],
    requirements: [{ id: "transcript", category: "documents", materialType: "transcript", required: true, title: "Transcript", originalText: "Official transcript", structuredRequirement: "", intake: "", sourceUrl: "https://example.edu", verificationState: "confirmed" }],
    universities: [{ ...universities[10], livingCostMonthlyMinEur: 900, livingCostMonthlyMaxEur: 1200 }],
    sources: [], pendingChanges: [],
  };
}

describe("transparent programme matching", () => {
  it("uses the fixed weights and only counts ready material types", () => {
    const profile = emptyProfile();
    profile.education = [{ id: "e", institution: "Test", degree: "Bachelor", major: "Business", gpa: "8.0", startYear: "2022", endYear: "2026" }];
    profile.courses = [{ id: "c", name: "Statistics with Python", grade: "8", credits: "6", category: "statistics programming" }];
    profile.tests = [{ id: "t", type: "IELTS", score: "7", testDate: "2026-01-01" }];
    const result = compareProgram(programme(), profile, ["transcript"], 8);
    expect(result.dimensions.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
    expect(result.readyMaterials).toEqual(["transcript"]);
    expect(result.hardRisks).toEqual([]);
    expect(result.firstYearMaxCny).toBe((20_000 + 14_400 + 100) * 8);
  });

  it("scores missing profile and official evidence as zero and exposes hard risks", () => {
    const result = compareProgram(programme(), emptyProfile(), [], 8);
    expect(result.dimensions.find((item) => item.key === "gpa")?.score).toBe(0);
    expect(result.dimensions.find((item) => item.key === "materials")?.missingEvidence).toContain("transcript");
    expect(result.hardRisks.length).toBeGreaterThan(0);
  });

  it("normalizes course tags and keeps similarity bounded", () => {
    expect(standardTags(["Linear algebra, SQL and research methods"])).toEqual(expect.arrayContaining(["mathematics", "database", "research_methods"]));
    expect(similarity(programme(), programme())).toBeLessThanOrEqual(100);
  });
});
