import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverFromHtml, fetchOfficialPage, findSupportingUrls, parseProgramHtml, validateOfficialUrl } from "./catalog-server";
import { getUniversity } from "./catalog-data";

describe("catalog safety and parsing", () => {
  const tilburg = getUniversity("tilburg")!;
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.FIRECRAWL_API_KEY;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.FIRECRAWL_API_KEY = originalKey;
    globalThis.euMasterRequestTimes?.clear();
    globalThis.euMasterRobotsCache?.clear();
    vi.restoreAllMocks();
  });

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
    expect(result.reviewItems.some((item) => item.field === "admissionCriteria")).toBe(true);
  });

  it("rejects navigation and error-page titles", async () => {
    const result = await parseProgramHtml(
      `<html><body><h1>Page not found</h1><main>${"Official programme details. ".repeat(12)}</main></body></html>`,
      "https://www.uva.nl/en/programmes/masters/example.html",
      "uva",
    );
    expect(result.automaticUpdates.some((item) => item.field === "name")).toBe(false);
  });

  it("does not mistake pre-master credits for master programme ECTS", async () => {
    const result = await parseProgramHtml(
      `<html><body><h1>Information Sciences</h1><main>
        <p>This pre-master programme is worth 30 ECTS credits.</p>
        <p>The master programme is a one year programme worth 60 ECTS.</p>
      </main></body></html>`,
      "https://vu.nl/en/education/master/information-sciences",
      "vu",
    );
    expect(result.automaticUpdates.find((item) => item.field === "ects")?.proposedValue).toBe("60 ECTS");
  });

  it("limits supporting pages to official admissions and tuition links", () => {
    const html = `<a href="/education/master/example/admissions">Admissions</a>
      <a href="/education/master/example/tuition-fees">Tuition fees</a>
      <a href="https://example.com/admissions">External admissions</a>`;
    const urls = findSupportingUrls(html, tilburg.catalogUrl, tilburg);
    expect(urls).toHaveLength(2);
    expect(urls.every((url) => url.includes("tilburguniversity.edu"))).toBe(true);
  });

  it("uses Firecrawl after the robots check", async () => {
    process.env.FIRECRAWL_API_KEY = "test-key";
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response("User-agent: *\nAllow: /", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { html: "<main><h1>Official programme</h1></main>", metadata: { sourceURL: tilburg.catalogUrl } } }), { status: 200, headers: { "content-type": "application/json" } }));
    const result = await fetchOfficialPage(new URL(tilburg.catalogUrl), tilburg);
    expect(result.provider).toBe("firecrawl");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to a compliant direct fetch on an ordinary Firecrawl failure", async () => {
    process.env.FIRECRAWL_API_KEY = "test-key";
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response("User-agent: *\nAllow: /", { status: 200 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 500 }))
      .mockResolvedValueOnce(new Response("<html><main>Official programme</main></html>", { status: 200, headers: { "content-type": "text/html" } }));
    const result = await fetchOfficialPage(new URL(tilburg.catalogUrl), tilburg);
    expect(result.provider).toBe("direct");
    expect(result.warning).toContain("Firecrawl");
  });

  it("does not bypass Firecrawl rate-limit responses", async () => {
    process.env.FIRECRAWL_API_KEY = "test-key";
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response("User-agent: *\nAllow: /", { status: 200 }))
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }));
    await expect(fetchOfficialPage(new URL(tilburg.catalogUrl), tilburg)).rejects.toMatchObject({ status: 429 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
