import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { categoryKeywords, getUniversity } from "./catalog-data";
import type { CatalogRefreshResult, DiscoveryCandidate, ProgramCategory, University } from "./types";

const USER_AGENT = "EU-Master-NL/1.0 (local single-user academic planning tool)";
const MIN_REQUEST_INTERVAL = process.env.NODE_ENV === "test" ? 0 : 5_000;
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

async function assertRobotsAllowed(url: URL, university: University) {
  const robotsText = await getRobots(url, university);
  if (!robotsText) return;
  const rules = robotsParser(`${url.origin}/robots.txt`, robotsText);
  if (rules.isAllowed(url.href, USER_AGENT) === false) {
    throw new CatalogFetchError("该官网的 robots.txt 不允许自动读取这个页面。", 403);
  }
}

async function fetchOnce(url: URL, university: University, retry = true): Promise<{ html: string; finalUrl: string }> {
  await assertRobotsAllowed(url, university);
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

async function fetchWithFirecrawl(url: URL, university: University) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new CatalogFetchError("未配置 Firecrawl，已使用官网直连回退。", 424);
  await assertRobotsAllowed(url, university);
  await waitForHost(url.hostname);
  let response: Response;
  try {
    response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ url: url.href, formats: ["html", "markdown", "links"], onlyMainContent: true, maxAge: 172_800_000, timeout: REQUEST_TIMEOUT }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT + 5_000),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new CatalogFetchError("Firecrawl 响应超时。", 504);
    throw new CatalogFetchError("Firecrawl 暂时不可用。", 502);
  }
  if (response.status === 403 || response.status === 429) throw new CatalogFetchError(response.status === 429 ? "Firecrawl 请求达到限速，请稍后重试。" : "Firecrawl 拒绝抓取该页面。", response.status);
  if (!response.ok) throw new CatalogFetchError(`Firecrawl 返回错误状态 ${response.status}。`, response.status);
  const body = await response.json() as { success?: boolean; data?: { html?: string; markdown?: string; metadata?: { sourceURL?: string; url?: string; statusCode?: number } } };
  const data = body.data;
  if (data?.metadata?.statusCode === 403 || data?.metadata?.statusCode === 429) throw new CatalogFetchError(data.metadata.statusCode === 429 ? "目标官网通过 Firecrawl 返回限速状态。" : "目标官网拒绝了 Firecrawl 抓取。", data.metadata.statusCode);
  const finalUrl = validateOfficialUrl(data?.metadata?.sourceURL || data?.metadata?.url || url.href, university);
  const html = data?.html || (data?.markdown ? `<main>${data.markdown.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]!)}</main>` : "");
  if (!body.success || !html) throw new CatalogFetchError("Firecrawl 未返回可解析的正文。", 502);
  if (new TextEncoder().encode(html).byteLength > MAX_RESPONSE_BYTES) throw new CatalogFetchError("Firecrawl 页面超过 2 MB 安全上限。", 413);
  return { html, finalUrl: finalUrl.href };
}

export async function fetchOfficialPage(url: URL, university: University) {
  try {
    return { ...(await fetchWithFirecrawl(url, university)), provider: "firecrawl" as const, warning: "" };
  } catch (error) {
    if (error instanceof CatalogFetchError && (error.status === 403 || error.status === 429)) throw error;
    const direct = await fetchOnce(url, university);
    return { ...direct, provider: "direct" as const, warning: error instanceof Error ? `Firecrawl 回退：${error.message}` : "Firecrawl 回退到官网直连。" };
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isPlausibleProgramTitle(value: string) {
  return value.length >= 4
    && value.length <= 180
    && !/\b(?:404|page not found|not found|access denied|unibuddy|youtube|chat with current students|cookie settings?)\b/i.test(value);
}

function findProgrammeEcts(text: string) {
  const pattern = /\b(\d{2,3})\s*(ECTS|EC|credits)\b/gi;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const prefix = text.slice(0, index);
    const sentenceBoundary = Math.max(prefix.lastIndexOf("."), prefix.lastIndexOf(";"), prefix.lastIndexOf("|"));
    const context = cleanText(text.slice(Math.max(sentenceBoundary + 1, index - 180), index + match[0].length + 80));
    if (/pre[- ]?master/i.test(context)) continue;
    return { value: `${match[1]} ECTS`, excerpt: context.slice(0, 360) };
  }
  return undefined;
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
  return discoverProgramsForUniversity(university, category);
}

export async function discoverProgramsForUniversity(university: University, category: ProgramCategory) {
  const url = validateOfficialUrl(university.catalogUrl, university);
  const { html, finalUrl, provider, warning } = await fetchOfficialPage(url, university);
  return {
    candidates: discoverFromHtml(html, finalUrl, university, category),
    sourceUrl: finalUrl,
    fetchedAt: new Date().toISOString(),
    provider,
    warnings: warning ? [warning] : [],
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

  if (isPlausibleProgramTitle(title)) automaticUpdates.push(lowChange("name", "项目名称", title, sourceUrl, title));
  const degreeMatch = text.match(/\b(Master of Science|Master of Arts|MSc|MA|LLM)\b/i);
  if (degreeMatch) automaticUpdates.push(lowChange("degreeType", "学位类型", degreeMatch[0], sourceUrl, findExcerpt(text, /\b(Master of Science|Master of Arts|MSc|MA|LLM)\b/i)));
  if (/language of instruction.{0,80}english|\benglish-taught\b|\benglish\b.{0,30}\bprogramme\b|\bmaster\s+english\b|\benglish\s+EN\b/i.test(text)) {
    automaticUpdates.push(lowChange("language", "授课语言", "English", sourceUrl, findExcerpt(text, /language of instruction.{0,80}english|english-taught|master\s+english|english\s+EN|english/i)));
  }
  const durationMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(year|years|month|months)\b/i);
  if (durationMatch) automaticUpdates.push(lowChange("duration", "学制", durationMatch[0], sourceUrl, findExcerpt(text, /\b\d+(?:\.\d+)?\s*(?:year|years|month|months)\b/i)));
  const ectsMatch = findProgrammeEcts(text);
  if (ectsMatch) automaticUpdates.push(lowChange("ects", "学分", ectsMatch.value, sourceUrl, ectsMatch.excerpt));
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
  const courseHeading = $("h2,h3,h4").filter((_index, element) => /curriculum|core courses|programme structure|program structure|study programme/i.test(cleanText($(element).text()))).first();
  const courseNames = courseHeading.nextUntil("h2,h3,h4").find("li").map((_index, element) => cleanText($(element).text())).get().filter((value) => value.length >= 3 && value.length <= 180).slice(0, 20);
  if (courseNames.length) {
    const courses = courseNames.map((name) => ({ name, tags: [], sourceUrl }));
    reviewItems.push(reviewChange("coreCourses", "核心课程", JSON.stringify(courses), sourceUrl, courseNames.slice(0, 5).join("；"), 0.7));
  }

  const admissionExcerpt = findExcerpt(text, /admission requirements.{0,500}/i);
  if (admissionExcerpt) {
    const criteria = [];
    if (/bachelor|undergraduate degree/i.test(admissionExcerpt)) criteria.push({ id: crypto.randomUUID(), kind: "degree", title: "本科学位与专业背景", description: admissionExcerpt, required: true, tags: [], sourceUrl, verificationState: "pending" });
    const gpa = admissionExcerpt.match(/(?:GPA|grade average).{0,40}?(\d+(?:\.\d+)?)/i);
    if (gpa) criteria.push({ id: crypto.randomUUID(), kind: "gpa", title: "GPA / 成绩条件", description: admissionExcerpt, required: true, tags: [], minimum: Number(gpa[1]), sourceUrl, verificationState: "pending" });
    const language = admissionExcerpt.match(/(IELTS|TOEFL).{0,40}?(\d+(?:\.\d+)?)/i);
    if (language) criteria.push({ id: crypto.randomUUID(), kind: "language", title: `${language[1].toUpperCase()} 语言要求`, description: admissionExcerpt, required: true, tags: [], minimum: Number(language[2]), testType: language[1].toUpperCase(), sourceUrl, verificationState: "pending" });
    if (/mathemat|statistic|programming|computer science|economics|business/i.test(admissionExcerpt)) criteria.push({ id: crypto.randomUUID(), kind: "prerequisite", title: "先修课背景", description: admissionExcerpt, required: true, tags: [], sourceUrl, verificationState: "pending" });
    if (criteria.length) reviewItems.push(reviewChange("admissionCriteria", "招生标准", JSON.stringify(criteria), sourceUrl, admissionExcerpt, 0.68));
  }

  const materialDefinitions = [
    ["transcript", /transcript/i, "成绩单"], ["degree_certificate", /degree certificate|diploma/i, "学位证明"], ["cv", /curriculum vitae|\bCV\b/i, "简历"],
    ["motivation_letter", /motivation letter|statement of purpose/i, "动机信"], ["recommendation_letter", /recommendation|reference letter/i, "推荐信"],
    ["english_test", /IELTS|TOEFL|proof of english/i, "语言成绩"], ["passport", /passport/i, "护照"], ["course_description", /course description|course syllabus/i, "课程描述"],
  ] as const;
  const requirements = materialDefinitions.filter(([, pattern]) => pattern.test(text)).map(([materialType, , requirementTitle]) => ({ id: crypto.randomUUID(), category: "官网材料清单", materialType, required: true, title: requirementTitle, originalText: findExcerpt(text, materialDefinitions.find(([type]) => type === materialType)![1]), structuredRequirement: requirementTitle, intake: "", sourceUrl, fetchedAt: new Date().toISOString(), verificationState: "pending", confidence: 0.68 }));
  if (requirements.length) reviewItems.push(reviewChange("requirements", "所需申请文件", JSON.stringify(requirements), sourceUrl, requirements.map((item) => item.title).join("、"), 0.68));

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
  return refreshProgramForUniversity(university, rawUrl);
}

export async function refreshProgramForUniversity(university: University, rawUrl: string) {
  const url = validateOfficialUrl(rawUrl, university);
  const { html, finalUrl, provider, warning } = await fetchOfficialPage(url, university);
  const primary = await parseProgramHtml(html, finalUrl, university.id);
  const pages = [{ html, url: finalUrl }];
  const warnings = [...primary.warnings, ...(warning ? [warning] : [])];
  const automaticUpdates = [...primary.automaticUpdates];
  const reviewItems = [...primary.reviewItems];

  for (const supportingUrl of findSupportingUrls(html, finalUrl, university)) {
    try {
      const supportingPage = await fetchOfficialPage(validateOfficialUrl(supportingUrl, university), university);
      pages.push({ html: supportingPage.html, url: supportingPage.finalUrl });
      if (supportingPage.warning) warnings.push(supportingPage.warning);
      const parsed = await parseProgramHtml(supportingPage.html, supportingPage.finalUrl, university.id);
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
    provider,
  } satisfies CatalogRefreshResult;
}
