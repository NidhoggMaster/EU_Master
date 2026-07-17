import { describe, expect, it } from "vitest";
import { discoverFromHtml, findSupportingUrls, parseProgramHtml, validateOfficialUrl } from "./catalog-server";
import { getUniversity } from "./catalog-data";

describe("catalog safety and parsing", () => {
  const tilburg = getUniversity("tilburg")!;

  it("rejects non-official and non-https URLs", () => {
    expect(() => validateOfficialUrl("https://example.com/master", tilburg)).toThrow("官方域名");
    expect(() => validateOfficialUrl("http://www.tilburguniversity.edu/master", tilburg)).toThrow("HTTPS");
  });

  it("discovers candidates by category and keeps official links only", () => {
    const html = `
      <a href="/education/masters-programs/information-management">Information Management</a>
      <a href="https://example.com/data-science">Data Science</a>
      <a href="/news/business-event">Business event</a>
    `;
    const result = discoverFromHtml(html, tilburg.catalogUrl, tilburg, "information");
    expect(result).toHaveLength(1);
    expect(result[0].sourceUrl).toContain("tilburguniversity.edu");
  });

  it("extracts low-risk fields and queues admission facts for review", async () => {
    const html = `<html><body><h1>Business Information Technology</h1>
      <p>Master of Science. Language of instruction English. Full-time, 2 years, 120 ECTS.</p>
      <h2>Admission requirements</h2><p>A relevant bachelor degree is required.</p>
      <p>Application deadline before 1 May.</p></body></html>`;
    const result = await parseProgramHtml(html, "https://www.utwente.nl/en/education/master/programmes/business-information-technology/");
    expect(result.automaticUpdates.some((item) => item.field === "duration" && item.proposedValue === "2 years")).toBe(true);
    expect(result.automaticUpdates.some((item) => item.field === "ects" && item.proposedValue === "120 ECTS")).toBe(true);
    expect(result.reviewItems.some((item) => item.field === "requirements")).toBe(true);
  });

  it("limits supporting pages to official admissions and tuition links", () => {
    const html = `<a href="/education/master/example/admissions">Admissions</a>
      <a href="/education/master/example/tuition-fees">Tuition fees</a>
      <a href="https://example.com/admissions">External admissions</a>`;
    const urls = findSupportingUrls(html, tilburg.catalogUrl, tilburg);
    expect(urls).toHaveLength(2);
    expect(urls.every((url) => url.includes("tilburguniversity.edu"))).toBe(true);
  });
});
