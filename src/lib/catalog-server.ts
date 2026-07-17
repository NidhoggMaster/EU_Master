import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { categoryKeywords, getUniversity } from "./catalog-data";
import type { CatalogRefreshResult, DiscoveryCandidate, ProgramCategory, University } from "./types";

const USER_AGENT = "EU-Master-NL/1.0 (local single-user academic planning tool)";
const MIN_REQUEST_INTERVAL = 5_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT = 20_000;

type CacheRecord = { expiresAt: number; text: string };
type DetailAdapter = { contentSelectors: string[]; titleSelectors: string[] };

export const detailAdapters: Record<string, DetailAdapter> = {
  tilburg: { contentSelectors: ["main", "#main-content"], titleSelectors: ["h1", "[data-testid='page-title']"] },
  vu: { contentSelectors: ["main", "article"], titleSelectors: ["h1", "header h1"] },
  maastricht: { contentSelectors: ["main", ".main-content"], titleSelectors: ["h1", ".page-title"] },
  utwente: { contentSelectors: ["main", "#content"], titleSelectors: ["h1", ".heading-1"] },
  radboud: { contentSelectors: ["main", "article"], titleSelectors: ["h1", "header h1"] },
  uva: { contentSelectors: ["main", "#content"], titleSelectors: ["h1", ".program-title"] },
  uu: { contentSelectors: ["main", "article"], titleSelectors: ["h1", ".page-title"] },
};

declare global {
  var euMasterRequestTimes: Map<string, number> | undefined;
  var euMasterRobotsCache: Map<string, CacheRecord> | undefined;
}

const requestTimes = globalThis.euMasterRequestTimes ?? new Map<string, number>();
const robotsCache = globalThis.euMasterRobotsCache ?? new Map<string, CacheRecord>();
globalThis.euMasterRequestTimes = requestTimes;
globalThis.euMasterRobotsCache = robotsCache;

export class CatalogFetchError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function validateOfficialUrl(rawUrl: string, university: University) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new CatalogFetchError("官网链接格式不正确。");
  }
  if (url.protocol !== "https:") throw new CatalogFetchError("只允许访问 HTTPS 官网链接。");
  if (!university.allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new CatalogFetchError("链接不属于所选大学的官方域名。");
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  return url;
}

async function waitForHost(host: string) {
  const lastRequest = requestTimes.get(host) ?? 0;
  const remaining = MIN_REQUEST_INTERVAL - (Date.now() - lastRequest);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  requestTimes.set(host, Date.now());
}

async function getRobots(url: URL, university: University) {
  const cacheKey = url.origin;
  const cached = robotsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.text;
  const robotsUrl = validateOfficialUrl(`${url.origin}/robots.txt`, university);
  await waitForHost(robotsUrl.hostname);
  try {
    const response = await fetch(robotsUrl, {
      headers: { "user-agent": USER_AGENT, accept: "text/plain" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      redirect: "error",
      cache: "no-store",
    });
    const text = response.ok ? (await response.text()).slice(0, 512_000) : "";
    robotsCache.set(cacheKey, { text, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    return text;
  } catch {
    robotsCache.set(cacheKey, { text: "", expiresAt: Date.now() + 60 * 60 * 1000 });
    return "";
  }
}

async function fetchOnce(url: URL, university: University, retry = true): Promise<{ html: string; finalUrl: string }> {
  const robotsText = await getRobots(url, university);
  if (robotsText) {
    const rules = robotsParser(`${url.origin}/robots.txt`, robotsText);
    if (rules.isAllowed(url.href, USER_AGENT) === false) {
      throw new CatalogFetchError("该官网的 robots.txt 不允许自动读取这个页面。", 403);
    }
  }
  await waitForHost(url.hostname);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      redirect: "manual",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new CatalogFetchError("官网响应超时，请稍后重试。", 504);
    throw new CatalogFetchError("暂时无法连接该大学官网。", 502);
  }

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location) throw new CatalogFetchError("官网返回了无效的跳转地址。", 502);
    const redirected = validateOfficialUrl(new URL(location, url).href, university);
    return fetchOnce(redirected, university, false);
  }
  if (response.status === 403 || response.status === 429) {
    throw new CatalogFetchError(response.status === 429 ? "官网请求过于频繁，请稍后再试。" : "官网拒绝了自动读取，请直接打开官网查看。", response.status);
  }
  if (response.status >= 500 && retry) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    return fetchOnce(url, university, false);
  }
  if (!response.ok) throw new CatalogFetchError(`官网返回错误状态 ${response.status}。`, response.status);

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new CatalogFetchError("官网返回的不是可读取的网页内容。", 415);
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new CatalogFetchError("官网页面超过 2 MB 安全上限。", 413);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new CatalogFetchError("官网页面超过 2 MB 安全上限。", 413);
  return { html: new TextDecoder().decode(bytes), finalUrl: response.url || url.href };
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function discoverFromHtml(
  html: string,
  baseUrl: string,
  university: University,
  category: ProgramCategory,
) {
  const $ = cheerio.load(html);
  const keywords = categoryKeywords[category];
  const candidates = new Map<string, DiscoveryCandidate>();
  $("a[href]").each((_index, element) => {
    const name = cleanText($(element).text());
    if (name.length < 4 || name.length > 140) return;
    const normalized = name.toLowerCase();
    const matchedKeywords = keywords.filter((keyword) => normalized.includes(keyword));
    if (!matchedKeywords.length) return;
    let sourceUrl: URL;
    try {
      sourceUrl = validateOfficialUrl(new URL($(element).attr("href") ?? "", baseUrl).href, university);
    } catch {
      return;
    }
    if (/news|event|staff|research|blog|vacanc/i.test(sourceUrl.pathname)) return;
    const key = sourceUrl.href.replace(/\/$/, "");
    candidates.set(key, { name, sourceUrl: key, universityId: university.id, category, matchedKeywords });
  });
  return [...candidates.values()].slice(0, 25);
}

export function findSupportingUrls(html: string, baseUrl: string, university: University) {
  const $ = cheerio.load(html);
  const selected = new Map<"admissions" | "tuition", string>();
  $("a[href]").each((_index, element) => {
    if (selected.size === 2) return;
    const text = cleanText($(element).text()).toLowerCase();
    const href = ($(element).attr("href") ?? "").toLowerCase();
    const combined = `${text} ${href}`;
    const kind = /admission|application-and-admission|admission-and-application/.test(combined)
      ? "admissions"
      : /tuition|study-fee|fees-and-funding/.test(combined)
        ? "tuition"
        : undefined;
    if (!kind || selected.has(kind)) return;
    try {
      const url = validateOfficialUrl(new URL($(element).attr("href") ?? "", baseUrl).href, university);
      if (url.href !== baseUrl) selected.set(kind, url.href);
    } catch {
      return;
    }
  });
  return [...selected.values()].slice(0, 2);
}

export async function discoverPrograms(universityId: string, category: ProgramCategory) {
  const university = getUniversity(universityId);
  if (!university) throw new CatalogFetchError("找不到所选大学。");
  const url = validateOfficialUrl(university.catalogUrl, university);
  const { html, finalUrl } = await fetchOnce(url, university);
  return {
    candidates: discoverFromHtml(html, finalUrl, university, category),
    sourceUrl: finalUrl,
    fetchedAt: new Date().toISOString(),
  };
}

function findExcerpt(text: string, pattern: RegExp) {
  const match = pattern.exec(text);
  if (!match || match.index === undefined) return "";
  const start = Math.max(0, match.index - 100);
  return cleanText(text.slice(start, match.index + match[0].length + 180)).slice(0, 360);
}

function lowChange(field: string, label: string, value: string, sourceUrl: string, excerpt: string) {
  return { field, label, previousValue: "", proposedValue: value, sourceUrl, excerpt, confidence: 0.86, risk: "low" as const };
}

function reviewChange(field: string, label: string, value: string, sourceUrl: string, excerpt: string, confidence = 0.72) {
  return { field, label, previousValue: "", proposedValue: value, sourceUrl, excerpt, confidence, risk: "review" as const };
}

export async function hashHtml(html: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function parseProgramHtml(html: string, sourceUrl: string, adapterId = "generic"): Promise<CatalogRefreshResult> {
  const $ = cheerio.load(html);
  $("script,style,noscript,svg").remove();
  const adapter = detailAdapters[adapterId] ?? { contentSelectors: ["main", "article", "body"], titleSelectors: ["h1"] };
  const title = cleanText(adapter.titleSelectors.map((selector) => $(selector).first().text()).find(Boolean) || $("title").text().split("|")[0]);
  const content = adapter.contentSelectors.map((selector) => $(selector).first().text()).find((value) => cleanText(value).length > 200) || $("body").text();
  const text = cleanText(content).slice(0, 300_000);
  const automaticUpdates: CatalogRefreshResult["automaticUpdates"] = [];
  const reviewItems: CatalogRefreshResult["reviewItems"] = [];
  const excerpts: string[] = [];

  if (title) automaticUpdates.push(lowChange("name", "项目名称", title, sourceUrl, title));
  const degreeMatch = text.match(/\b(Master of Science|Master of Arts|MSc|MA|LLM)\b/i);
  if (degreeMatch) automaticUpdates.push(lowChange("degreeType", "学位类型", degreeMatch[0], sourceUrl, findExcerpt(text, /\b(Master of Science|Master of Arts|MSc|MA|LLM)\b/i)));
  if (/language of instruction.{0,80}english|\benglish-taught\b|\benglish\b.{0,30}\bprogramme\b|\bmaster\s+english\b|\benglish\s+EN\b/i.test(text)) {
    automaticUpdates.push(lowChange("language", "授课语言", "English", sourceUrl, findExcerpt(text, /language of instruction.{0,80}english|english-taught|master\s+english|english\s+EN|english/i)));
  }
  const durationMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(year|years|month|months)\b/i);
  if (durationMatch) automaticUpdates.push(lowChange("duration", "学制", durationMatch[0], sourceUrl, findExcerpt(text, /\b\d+(?:\.\d+)?\s*(?:year|years|month|months)\b/i)));
  const ectsMatch = text.match(/\b(\d{2,3})\s*(ECTS|EC|credits)\b/i);
  if (ectsMatch) automaticUpdates.push(lowChange("ects", "学分", `${ectsMatch[1]} ECTS`, sourceUrl, findExcerpt(text, /\b\d{2,3}\s*(?:ECTS|EC|credits)\b/i)));
  if (/full[- ]time/i.test(text)) automaticUpdates.push(lowChange("mode", "授课方式", "Full-time", sourceUrl, findExcerpt(text, /full[- ]time/i)));
  const intakes = ["September", "February"].filter((month) => new RegExp(`start.{0,80}${month}|${month}.{0,80}intake`, "i").test(text));
  if (intakes.length) automaticUpdates.push(lowChange("intakes", "入学时间", intakes.join(", "), sourceUrl, findExcerpt(text, /(?:start|intake).{0,100}(?:september|february)/i)));

  const deadlineExcerpt = findExcerpt(text, /(?:application|apply).{0,80}(?:deadline|before).{0,100}(?:january|february|march|april|may|june|july|october|november|december|\d{1,2}\s+[A-Z][a-z]+)/i);
  if (deadlineExcerpt) reviewItems.push(reviewChange("deadline", "申请截止日期", deadlineExcerpt, sourceUrl, deadlineExcerpt));
  const tuitionExcerpt = findExcerpt(text, /(?:tuition fee|institutional fee).{0,120}(?:€|EUR)\s?[\d,.]+/i);
  if (tuitionExcerpt) reviewItems.push(reviewChange("tuition", "国际生学费", tuitionExcerpt, sourceUrl, tuitionExcerpt));
  const feeExcerpt = findExcerpt(text, /application fee.{0,80}(?:€|EUR)\s?[\d,.]+/i);
  if (feeExcerpt) reviewItems.push(reviewChange("applicationFee", "申请费", feeExcerpt, sourceUrl, feeExcerpt));
  const premasterExcerpt = findExcerpt(text, /pre[- ]master.{0,220}/i);
  if (premasterExcerpt) reviewItems.push(reviewChange("premaster", "Pre-master", premasterExcerpt, sourceUrl, premasterExcerpt));
  const admissionExcerpt = findExcerpt(text, /admission requirements.{0,340}/i);
  if (admissionExcerpt) reviewItems.push(reviewChange("requirements", "申请要求", admissionExcerpt, sourceUrl, admissionExcerpt, 0.64));

  [...automaticUpdates, ...reviewItems].forEach((item) => {
    if (item.excerpt && !excerpts.includes(item.excerpt)) excerpts.push(item.excerpt);
  });
  return {
    automaticUpdates,
    reviewItems,
    snapshot: {
      sourceUrl,
      fetchedAt: new Date().toISOString(),
      contentHash: await hashHtml(html),
      parserVersion: "1.0.0",
      excerpts: excerpts.slice(0, 20),
    },
    warnings: automaticUpdates.length || reviewItems.length ? [] : ["官网页面可以访问，但暂未识别出结构化字段。"],
  };
}

export async function refreshProgram(universityId: string, rawUrl: string) {
  const university = getUniversity(universityId);
  if (!university) throw new CatalogFetchError("找不到项目所属大学。");
  const url = validateOfficialUrl(rawUrl, university);
  const { html, finalUrl } = await fetchOnce(url, university);
  const primary = await parseProgramHtml(html, finalUrl, universityId);
  const pages = [{ html, url: finalUrl }];
  const warnings = [...primary.warnings];
  const automaticUpdates = [...primary.automaticUpdates];
  const reviewItems = [...primary.reviewItems];

  for (const supportingUrl of findSupportingUrls(html, finalUrl, university)) {
    try {
      const supportingPage = await fetchOnce(validateOfficialUrl(supportingUrl, university), university);
      pages.push({ html: supportingPage.html, url: supportingPage.finalUrl });
      const parsed = await parseProgramHtml(supportingPage.html, supportingPage.finalUrl, universityId);
      parsed.automaticUpdates.forEach((item) => {
        if (!automaticUpdates.some((existing) => existing.field === item.field)) automaticUpdates.push(item);
      });
      parsed.reviewItems.forEach((item) => {
        if (!reviewItems.some((existing) => existing.field === item.field && existing.proposedValue === item.proposedValue)) reviewItems.push(item);
      });
      warnings.push(...parsed.warnings);
    } catch (error) {
      warnings.push(error instanceof Error ? `辅助页面未读取：${error.message}` : "辅助页面暂时无法读取。");
    }
  }

  const excerpts = [...automaticUpdates, ...reviewItems].map((item) => item.excerpt).filter(Boolean);
  return {
    automaticUpdates,
    reviewItems,
    snapshot: {
      sourceUrl: finalUrl,
      fetchedAt: new Date().toISOString(),
      contentHash: await hashHtml(pages.map((page) => `${page.url}\n${page.html}`).join("\n---\n")),
      parserVersion: "1.1.0",
      excerpts: [...new Set(excerpts)].slice(0, 30),
    },
    warnings: [...new Set(warnings)],
  } satisfies CatalogRefreshResult;
}
