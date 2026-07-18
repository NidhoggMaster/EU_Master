import { describe, expect, it, vi } from "vitest";
import { applyOfficialCatalog } from "./apply-official-catalog-2026.mjs";

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json" },
});

describe("official catalog baseline", () => {
  it("applies the verified Tilburg 2026/27 tuition and living costs", async () => {
    const savedPrograms = [];
    let savedUniversity;
    const fetchImpl = vi.fn(async (input, init = {}) => {
      const url = new URL(input);
      if (url.pathname === "/api/health") return json({ status: "ready", storage: { catalogMode: "local" } });
      if (url.pathname === "/api/catalog/universities/tilburg" && init.method === "PATCH") {
        savedUniversity = JSON.parse(init.body);
        return json({ id: "tilburg", ...savedUniversity });
      }
      const match = url.pathname.match(/^\/api\/catalog\/programs\/(.+)$/);
      if (match && !init.method) {
        return json({
          id: decodeURIComponent(match[1]),
          institutionIds: ["tilburg"],
          name: "Tilburg program",
          categories: ["data"],
          sourceUrl: "https://www.tilburguniversity.edu/education/masters-programs",
          requirements: [],
          coreCourses: [],
          admissionCriteria: [],
          status: "active",
          createdAt: "2026-07-17T00:00:00.000Z",
          applicationLinks: {},
        });
      }
      if (match && init.method === "PATCH") {
        const saved = JSON.parse(init.body);
        savedPrograms.push(saved);
        return json(saved);
      }
      return json({ error: `Unexpected request: ${url.pathname}` }, 500);
    });

    await applyOfficialCatalog({
      fetchImpl,
      logger: { log: vi.fn() },
      programIds: ["tilburg-im-strategy", "tilburg-im-intelligence", "tilburg-dss-business", "jads-dsbe"],
      universityIds: ["tilburg"],
    });

    expect(savedUniversity).toMatchObject({
      livingCostMonthlyMinEur: 1000,
      livingCostMonthlyMaxEur: 1200,
      livingCostSourceUrl: expect.stringContaining("tilburguniversity.edu"),
    });
    expect(savedPrograms).toHaveLength(4);
    expect(savedPrograms.every((program) => program.tuitionEur === 23900 && program.tuitionAcademicYear === "2026/27")).toBe(true);
    expect(savedPrograms.every((program) => program.applicationLinks.tuitionCalculatorUrl.includes("landbot.pro"))).toBe(true);
  });
});
