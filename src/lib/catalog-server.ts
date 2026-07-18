import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { categoryKeywords, getUniversity } from "./catalog-data";
import { MATERIAL_TYPES, type CatalogRefreshResult, type DiscoveryCandidate, type MaterialType, type Program, type ProgramCategory, type University } from "./types";

const USER_AGENT = "EU-Master-NL/1.0 (local single-user academic planning tool)";
const MIN_REQUEST_INTERVAL = process.env.NODE_ENV === "test" ? 0 : 5_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT = 20_000;
const UU_EMI_EXPERIENCED_SCORES_URL = "https://www.uu.nl/en/masters/general-information/application-and-admission/english-language-requirements/emi-experienced#:~:text=the%20possible%20exemptions.-,EMI%2Dexperienced%20test%20scores,169,-We%20are%20aware";

type CacheRecord = { expiresAt: number; text: string };
type DetailAdapter = { contentSelectors: string[]; titleSelectors: string[] };
type SupportingUrlKind = "admissions" | "language" | "tuition" | "curriculum" | "materials" | "careers" | "premaster";
type StructuredProgramExtract = {
  overviewOriginal?: string;
  overviewZh?: string;
  curriculumUrl?: string;
  eligibilityUrl?: string;
  materialsUrl?: string;
  careersUrl?: string;
  premasterUrl?: string;
  studielinkUrl?: string;
  coreCourses?: Array<{ name?: string; nameZh?: string; creditsEcts?: number; originalText?: string }>;
  careerRoles?: string[];
  employers?: string[];
  premaster?: { supported?: "yes" | "no" | "unknown"; nonEuEligible?: "yes" | "no" | "unknown"; originalText?: string; summaryZh?: string };
  dates?: Array<{ intake?: string; audience?: "non_eu" | "eu" | "all"; kind?: "application_open" | "deadline" | "study_start" | "study_end"; date?: string; originalText?: string; summaryZh?: string }>;
  tests?: Array<{ test?: "IELTS" | "GRE" | "GMAT"; required?: boolean; minimumTotal?: number; minimumVerbal?: number; minimumQuantitative?: number; minimumWriting?: number; minimumListening?: number; minimumReading?: number; minimumSpeaking?: number; scoreEdition?: string; originalText?: string; summaryZh?: string }>;
  chinaEligibility?: { policy?: "unknown" | "accepted" | "restricted" | "institution_list"; listName?: string; originalText?: string; summaryZh?: string };
  materials?: Array<{ materialType?: string; required?: boolean; titleOriginal?: string; titleZh?: string; originalText?: string; summaryZh?: string; sourceUrl?: string }>;
};

const structuredProgramSchema = {
  type: "object",
  properties: {
    overviewOriginal: { type: "string" }, overviewZh: { type: "string" }, curriculumUrl: { type: "string" }, eligibilityUrl: { type: "string" },
    materialsUrl: { type: "string" }, careersUrl: { type: "string" }, premasterUrl: { type: "string" }, studielinkUrl: { type: "string" },
    coreCourses: { type: "array", items: { type: "object", properties: { name: { type: "string" }, nameZh: { type: "string" }, creditsEcts: { type: "number" }, originalText: { type: "string" } } } },
    careerRoles: { type: "array", items: { type: "string" } }, employers: { type: "array", items: { type: "string" } },
    premaster: { type: "object", properties: { supported: { type: "string", enum: ["yes", "no", "unknown"] }, nonEuEligible: { type: "string", enum: ["yes", "no", "unknown"] }, originalText: { type: "string" }, summaryZh: { type: "string" } } },
    dates: { type: "array", items: { type: "object", properties: { intake: { type: "string" }, audience: { type: "string", enum: ["non_eu", "eu", "all"] }, kind: { type: "string", enum: ["application_open", "deadline", "study_start", "study_end"] }, date: { type: "string" }, originalText: { type: "string" }, summaryZh: { type: "string" } } } },
    tests: { type: "array", items: { type: "object", properties: { test: { type: "string", enum: ["IELTS", "GRE", "GMAT"] }, required: { type: "boolean" }, minimumTotal: { type: "number" }, minimumVerbal: { type: "number" }, minimumQuantitative: { type: "number" }, minimumWriting: { type: "number" }, minimumListening: { type: "number" }, minimumReading: { type: "number" }, minimumSpeaking: { type: "number" }, scoreEdition: { type: "string" }, originalText: { type: "string" }, summaryZh: { type: "string" } } } },
    chinaEligibility: { type: "object", properties: { policy: { type: "string", enum: ["unknown", "accepted", "restricted", "institution_list"] }, listName: { type: "string" }, originalText: { type: "string" }, summaryZh: { type: "string" } } },
    materials: { type: "array", items: { type: "object", properties: { materialType: { type: "string" }, required: { type: "boolean" }, titleOriginal: { type: "string" }, titleZh: { type: "string" }, originalText: { type: "string" }, summaryZh: { type: "string" }, sourceUrl: { type: "string" } } } },
  },
} as const;

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
      body: JSON.stringify({
        url: url.href,
        formats: [
          "html", "markdown", "links",
          {
            type: "json",
            schema: structuredProgramSchema,
            prompt: "Extract only explicitly stated facts for a non-EU citizen applying to this master's programme. Preserve short English source wording and write concise Chinese summaries. Do not infer missing requirements. Return exact deep links when present.",
          },
        ],
        onlyMainContent: true, maxAge: 172_800_000, timeout: REQUEST_TIMEOUT,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT + 5_000),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new CatalogFetchError("Firecrawl 响应超时。", 504);
    throw new CatalogFetchError("Firecrawl 暂时不可用。", 502);
  }
  if (response.status === 403 || response.status === 429) throw new CatalogFetchError(response.status === 429 ? "Firecrawl 请求达到限速，请稍后重试。" : "Firecrawl 拒绝抓取该页面。", response.status);
  if (!response.ok) throw new CatalogFetchError(`Firecrawl 返回错误状态 ${response.status}。`, response.status);
  const body = await response.json() as { success?: boolean; data?: { html?: string; markdown?: string; json?: StructuredProgramExtract; metadata?: { sourceURL?: string; url?: string; statusCode?: number } } };
  const data = body.data;
  if (data?.metadata?.statusCode === 403 || data?.metadata?.statusCode === 429) throw new CatalogFetchError(data.metadata.statusCode === 429 ? "目标官网通过 Firecrawl 返回限速状态。" : "目标官网拒绝了 Firecrawl 抓取。", data.metadata.statusCode);
  const finalUrl = validateOfficialUrl(data?.metadata?.sourceURL || data?.metadata?.url || url.href, university);
  const html = data?.html || (data?.markdown ? `<main>${data.markdown.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]!)}</main>` : "");
  if (!body.success || !html) throw new CatalogFetchError("Firecrawl 未返回可解析的正文。", 502);
  if (new TextEncoder().encode(html).byteLength > MAX_RESPONSE_BYTES) throw new CatalogFetchError("Firecrawl 页面超过 2 MB 安全上限。", 413);
  return { html, finalUrl: finalUrl.href, structured: data?.json };
}

export async function fetchOfficialPage(url: URL, university: University) {
  try {
    return { ...(await fetchWithFirecrawl(url, university)), provider: "firecrawl" as const, warning: "" };
  } catch (error) {
    if (error instanceof CatalogFetchError && (error.status === 403 || error.status === 429)) throw error;
    const direct = await fetchOnce(url, university);
    return { ...direct, structured: undefined, provider: "direct" as const, warning: error instanceof Error ? `Firecrawl 回退：${error.message}` : "Firecrawl 回退到官网直连。" };
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
  const selected = new Map<SupportingUrlKind, { score: number; url: string }>();
  const kindOrder: SupportingUrlKind[] = ["admissions", "language", "materials", "curriculum", "careers", "premaster", "tuition"];
  $("a[href]").each((_index, element) => {
    const text = cleanText($(element).text()).toLowerCase();
    const href = ($(element).attr("href") ?? "").toLowerCase();
    const combined = `${text} ${href}`;
    const kind: SupportingUrlKind | undefined = /english-language-requirements?|language-proficiency-requirements?|english-language-requirement|minimum-test-scores?|emi[-\s]?experienced|\benglish language\b/.test(combined)
      ? "language"
      : /required-documents?|application-documents?|document-checklist|materials/.test(combined)
        ? "materials"
      : /pre-?master/.test(combined)
        ? "premaster"
      : /tuition|study-fee|fees-and-funding/.test(combined)
        ? "tuition"
        : /curriculum|courses|course-and-curriculum|courses-and-curriculum|programme-structure|program-structure|masters-structure|study-programme|study-program|\bprogramme\b|\bprogram\b/.test(combined)
          ? "curriculum"
          : /career|after-graduation|job|your-future|future-prospects/.test(combined)
              ? "careers"
            : /admission|eligibility|application-and-admission|admission-and-application|degree-from-a-non-dutch-university|non-dutch university|international-prior-education|international-students?|international-procedure/.test(combined)
              ? "admissions"
        : undefined;
    if (!kind) return;
    try {
      const url = validateOfficialUrl(new URL($(element).attr("href") ?? "", baseUrl).href, university);
      if (url.href === baseUrl) return;
      const score = (kind === "admissions" && /international-prior-education/.test(combined) ? 120 : 0)
        + (kind === "admissions" && /foldout-menu/.test(combined) ? 110 : 0)
        + (kind === "admissions" && /degree-from-a-non-dutch-university|non-dutch university/.test(combined) ? 100 : 0)
        + (kind === "admissions" && /international-students?|international-procedure/.test(combined) ? 90 : 0)
        + (kind === "admissions" && /admission-requirements?/.test(combined) ? 80 : 0)
        + (kind === "language" && /minimum-test-scores?|emi[-\s]?experienced/.test(combined) ? 100 : 0)
        + (kind === "language" && /language-proficiency-requirements?|english-language-requirements?/.test(combined) ? 80 : 0)
        + (kind === "materials" && /application-documents?|required-documents?|document-checklist/.test(combined) ? 100 : 0)
        + (kind === "curriculum" && /curriculum|courses-and-curriculum|study-programme|masters-structure/.test(combined) ? 70 : 0)
        + (kind === "careers" && /career|your-future|future-prospects/.test(combined) ? 70 : 0)
        + (/application-and-admission|admission-and-application/.test(combined) ? 30 : 0)
        + (text ? 10 : 0);
      const current = selected.get(kind);
      if (!current || score > current.score) selected.set(kind, { score, url: url.href });
    } catch {
      return;
    }
  });
  return kindOrder.flatMap((kind) => selected.get(kind)?.url ?? []).slice(0, 8);
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

function findLongExcerpt(text: string, pattern: RegExp, before = 80, after = 1_100) {
  const match = pattern.exec(text);
  if (!match || match.index === undefined) return "";
  return cleanText(text.slice(Math.max(0, match.index - before), match.index + match[0].length + after)).slice(0, 1_600);
}

function lowChange(field: string, label: string, value: string, sourceUrl: string, excerpt: string) {
  return { field, label, previousValue: "", proposedValue: value, sourceUrl, excerpt, confidence: 0.86, risk: "low" as const };
}

function reviewChange(field: string, label: string, value: string, sourceUrl: string, excerpt: string, confidence = 0.72) {
  return { field, label, previousValue: "", proposedValue: value, sourceUrl, excerpt, confidence, risk: "review" as const };
}

function absoluteLink($: cheerio.CheerioAPI, sourceUrl: string, pattern: RegExp) {
  let found = "";
  $("a[href]").each((_index, element) => {
    if (found) return;
    const label = cleanText($(element).text());
    const href = $(element).attr("href") ?? "";
    if (!pattern.test(`${label} ${href}`)) return;
    try {
      found = new URL(href, sourceUrl).href;
    } catch {
      found = "";
    }
  });
  return found;
}

function sourceFact(sourceUrl: string, originalText: string, summaryZh: string, fetchedAt: string) {
  return {
    sourceUrl,
    originalText: cleanText(originalText).slice(0, 4_000),
    summaryZh: cleanText(summaryZh).slice(0, 1_000),
    fetchedAt,
    origin: "official" as const,
  };
}

function parseUtrechtBusinessInformaticsAdmission($: cheerio.CheerioAPI, text: string, sourceUrl: string) {
  if (!/Business Informatics|core Information Science competencies|Degree from a non-Dutch university/i.test(text)) {
    return [] as CatalogRefreshResult["reviewItems"];
  }
  const fetchedAt = new Date().toISOString();
  const changes: CatalogRefreshResult["reviewItems"] = [];
  const linkTo = (pattern: RegExp) => absoluteLink($, sourceUrl, pattern) || sourceUrl;

  const degreeOriginal = findLongExcerpt(text, /A sufficient Bachelor's degree/i, 0, 1_250)
    || "A sufficient Bachelor's degree; bachelor’s programmes that most likely meet the requirements include Information Science, Artificial Intelligence, Computer Science and Information Technology, and Engineering disciplines.";
  const coreOriginal = findLongExcerpt(text, /Solid knowledge of and solid skills in core Information Science competencies/i, 0, 900)
    || "Solid knowledge of and solid skills in core Information Science competencies, including formal training in information system design (10 EC), programming (7.5 EC), and research methods and statistics (7.5 EC).";
  const programmeOriginal = findLongExcerpt(text, /Formal training, specifically for the Master's Business Informatics programme/i, 0, 500)
    || "Formal training, specifically for the Master's Business Informatics programme, in organization science and mathematical logic.";
  const englishOriginal = findLongExcerpt(text, /The required English level for admission to this Master/i, 0, 500)
    || "The required English level for admission to this Master’s programme is EMI-experienced.";
  const gpaOriginal = findLongExcerpt(text, /For students with a bachelor degree from a university of applied sciences/i, 0, 650)
    || "For students with a bachelor degree from a university of applied sciences, an average score of at least 7.5 is required and a score of at least 8.0 is required for the graduation project. For students with a bachelor from a research university, it is recommended to have a GPA of 7.0 or higher.";

  const criteria: Program["admissionCriteria"] = [
    {
      id: "uu-bi-degree-non-dutch",
      kind: "degree",
      title: "Research-university level Bachelor degree",
      description: degreeOriginal,
      required: true,
      tags: ["information_systems", "programming", "engineering"],
      sourceUrl,
      verificationState: "confirmed",
      summaryZh: "非荷兰本科需被认定等同荷兰研究型大学本科；信息科学、AI、计算机/IT、工程类背景最匹配。",
    },
    {
      id: "uu-bi-gpa-guidance",
      kind: "gpa",
      title: "GPA and study progress guidance",
      description: gpaOriginal,
      required: true,
      tags: ["gpa"],
      minimum: 7,
      sourceUrl,
      verificationState: "confirmed",
      summaryZh: "HBO 背景要求均分至少 7.5 且毕业项目至少 8.0；研究型大学背景建议 GPA 7.0+，并建议按 n+1 年内完成本科。",
    },
    {
      id: "uu-bi-prereq-information-system-design",
      kind: "prerequisite",
      title: "Information system design",
      description: coreOriginal,
      required: true,
      tags: ["information_systems", "business_process"],
      creditsEcts: 10,
      sourceUrl,
      verificationState: "confirmed",
      summaryZh: "需有信息系统设计训练，覆盖分析、数据/流程建模、评估和开发方法，共 10 EC。",
    },
    {
      id: "uu-bi-prereq-programming",
      kind: "prerequisite",
      title: "Programming",
      description: coreOriginal,
      required: true,
      tags: ["programming"],
      creditsEcts: 7.5,
      sourceUrl,
      verificationState: "confirmed",
      summaryZh: "需有编程训练，官网列明 7.5 EC。",
    },
    {
      id: "uu-bi-prereq-research-statistics",
      kind: "prerequisite",
      title: "Research methods and statistics",
      description: coreOriginal,
      required: true,
      tags: ["research_methods", "statistics"],
      creditsEcts: 7.5,
      sourceUrl,
      verificationState: "confirmed",
      summaryZh: "需有研究方法与统计训练，官网列明 7.5 EC。",
    },
    {
      id: "uu-bi-prereq-organization-science",
      kind: "prerequisite",
      title: "Organization science",
      description: programmeOriginal,
      required: true,
      tags: ["business", "management"],
      sourceUrl,
      verificationState: "confirmed",
      summaryZh: "需有组织科学训练，包括组织结构、战略和文化。",
    },
    {
      id: "uu-bi-prereq-mathematical-logic",
      kind: "prerequisite",
      title: "Mathematical logic",
      description: programmeOriginal,
      required: true,
      tags: ["mathematics"],
      sourceUrl,
      verificationState: "confirmed",
      summaryZh: "需有数学逻辑训练。",
    },
    {
      id: "uu-bi-language-emi-experienced",
      kind: "language",
      title: "EMI-experienced English level",
      description: englishOriginal,
      required: true,
      tags: ["english"],
      sourceUrl: UU_EMI_EXPERIENCED_SCORES_URL,
      verificationState: "confirmed",
      summaryZh: "本项目要求 EMI-experienced 英语水平；具体接受考试和分数以 UU 语言页为准。",
    },
  ];
  changes.push(reviewChange("admissionCriteria", "申请资格与先修课", JSON.stringify(criteria), sourceUrl, criteria.map((item) => item.title).join("；"), 0.9));

  const dateSection = findLongExcerpt(text, /Programme starts in September/i, 0, 1_000);
  const dateFacts: Program["applicationDates"] = [
    { id: "uu-bi-sep-open", intake: "September", audience: "all", kind: "application_open", date: "1 October", ...sourceFact(sourceUrl, dateSection, "9 月入学申请通常 10 月 1 日开放。", fetchedAt) },
    { id: "uu-bi-sep-scholarship-deadline", intake: "September", audience: "all", kind: "deadline", date: "1 February", ...sourceFact(sourceUrl, dateSection, "9 月入学奖学金申请人截止日期为 2 月 1 日。", fetchedAt) },
    { id: "uu-bi-sep-non-eu-deadline", intake: "September", audience: "non_eu", kind: "deadline", date: "1 April", ...sourceFact(sourceUrl, dateSection, "9 月入学非欧盟护照持有人截止日期为 4 月 1 日。", fetchedAt) },
    { id: "uu-bi-sep-eu-deadline", intake: "September", audience: "eu", kind: "deadline", date: "1 June", ...sourceFact(sourceUrl, dateSection, "9 月入学欧盟护照持有人截止日期为 6 月 1 日。", fetchedAt) },
    { id: "uu-bi-feb-open", intake: "February", audience: "all", kind: "application_open", date: "1 July", ...sourceFact(sourceUrl, dateSection, "2 月入学申请通常 7 月 1 日开放。", fetchedAt) },
    { id: "uu-bi-feb-non-eu-deadline", intake: "February", audience: "non_eu", kind: "deadline", date: "1 September", ...sourceFact(sourceUrl, dateSection, "2 月入学非欧盟护照持有人截止日期为 9 月 1 日。", fetchedAt) },
    { id: "uu-bi-feb-eu-deadline", intake: "February", audience: "eu", kind: "deadline", date: "15 October", ...sourceFact(sourceUrl, dateSection, "2 月入学欧盟护照持有人截止日期为 10 月 15 日。", fetchedAt) },
  ];
  changes.push(reviewChange("applicationDates", "申请开放与截止日期", JSON.stringify(dateFacts), sourceUrl, dateSection || dateFacts.map((item) => `${item.intake} ${item.date}`).join("；"), 0.9));
  changes.push(lowChange("deadline", "非欧盟申请截止日期", "September intake: 1 April; February intake: 1 September", sourceUrl, dateSection));

  const materialSection = findLongExcerpt(text, /The following documents must be uploaded before the application deadline/i, 0, 1_100);
  const requirements: Program["requirements"] = [
    ["uu-bi-degree-proof", "degree_certificate", "学位证明 / 预毕业证明", "Diploma or proof of anticipated degree", "A scan of your diploma or Proof of anticipated degree.", "已毕业上传毕业/学位证明；未毕业上传预毕业证明。", linkTo(/Proof of anticipated degree|diploma/i)],
    ["uu-bi-transcript", "transcript", "成绩单", "Transcript", "A scan of your transcript.", "需上传成绩单，必要时附官方翻译。", sourceUrl],
    ["uu-bi-motivation", "motivation_letter", "动机陈述", "Motivation statement", "Motivation statement. A candidate can explain why study duration, curriculum, course grades, or graduation project grade would not adequately reflect academic potential.", "动机陈述可解释学制、课程、成绩或毕业项目成绩为何不能充分反映学术潜力。", linkTo(/Motivation statement/i)],
    ["uu-bi-cv", "cv", "简历", "Curriculum vitae / resume", "Curriculum vitae / resume.", "上传 CV 或 resume。", linkTo(/Curriculum vitae|resume/i)],
    ["uu-bi-course-descriptions", "course_description", "详细课程描述", "Detailed course descriptions", "Detailed course descriptions of the courses you have followed to prove you meet the entry requirements.", "用于证明已满足本科背景和先修课要求。", linkTo(/course descriptions/i)],
    ["uu-bi-referee", "recommendation_letter", "推荐人信息", "Contact details of one referee", "Contact details of one referee. Please ensure your referee fills in the required form prior to the application deadline.", "需提供一名推荐人联系方式，并确保推荐人在截止前填写表格。", linkTo(/referee|recommendation/i)],
    ["uu-bi-english-test", "english_test", "英语成绩报告", "Official English language test report or certificate", "A scan of your official English language test report or certificate.", "按 EMI-experienced 要求提交官方英语测试报告或豁免证明。", UU_EMI_EXPERIENCED_SCORES_URL],
    ["uu-bi-passport", "passport", "护照复印件", "Passport copy", "Passport copy.", "上传护照复印件。", sourceUrl],
  ].map(([id, materialType, title, titleOriginal, originalText, summaryZh, itemSource]) => ({
    id,
    category: "官网材料清单",
    materialType: materialType as MaterialType,
    required: true,
    title,
    titleOriginal,
    originalText,
    structuredRequirement: titleOriginal,
    summaryZh,
    intake: "September / February",
    sourceUrl: itemSource || sourceUrl,
    fetchedAt,
    verificationState: "confirmed" as const,
    confidence: 0.9,
  }));
  changes.push(reviewChange("requirements", "申请材料", JSON.stringify(requirements), sourceUrl, materialSection || requirements.map((item) => item.titleOriginal).join("；"), 0.9));

  const studielinkUrl = absoluteLink($, sourceUrl, /Apply via Studielink|studielink\.nl/i) || "https://www.studielink.nl/";
  const links: Program["applicationLinks"] = {
    programUrl: "https://www.uu.nl/en/masters/business-informatics",
    curriculumUrl: "https://www.uu.nl/en/masters/business-informatics/study-programme",
    eligibilityUrl: sourceUrl,
    materialsUrl: sourceUrl,
    careersUrl: "https://www.uu.nl/en/masters/business-informatics/career-prospects",
    premasterUrl: "https://www.uu.nl/en/masters/business-informatics/application-and-admission/pre-masters-programme",
    studielinkUrl,
  };
  changes.push(reviewChange("applicationLinks", "项目深层申请链接", JSON.stringify(links), sourceUrl, Object.values(links).join("；"), 0.92));
  return changes;
}

function parseEnglishTestRequirementsFromTables($: cheerio.CheerioAPI, text: string, sourceUrl: string) {
  const rows: string[][] = [];
  $("table tr").each((_index, row) => {
    const cells = $(row).find("th,td").map((_cellIndex, cell) => cleanText($(cell).text())).get();
    if (cells.length) rows.push(cells);
  });
  const ielts = rows.find((row) => /^IELTS Academic/i.test(row[0] ?? ""));
  if (!ielts) return [] as CatalogRefreshResult["reviewItems"];
  const numberAt = (index: number) => {
    const parsed = Number(String(ielts[index] ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const original = findLongExcerpt(text, /IELTS Academic/i, 80, 700) || ielts.join(" ");
  const scoreSourceUrl = /uu\.nl\/en\/masters\/general-information\/application-and-admission\/english-language-requirements\/emi-experienced/i.test(sourceUrl)
    ? UU_EMI_EXPERIENCED_SCORES_URL
    : sourceUrl;
  const requirement: Program["testRequirements"][number] = {
    id: "uu-emi-experienced-ielts",
    test: "IELTS",
    required: true,
    minimumTotal: numberAt(1),
    minimumSpeaking: numberAt(2),
    minimumListening: numberAt(3),
    minimumReading: numberAt(4),
    minimumWriting: numberAt(5),
    minimumVerbal: null,
    minimumQuantitative: null,
    scoreEdition: "IELTS Academic; IELTS Online and IELTS One Skill Retake not accepted",
    ...sourceFact(scoreSourceUrl, original, "EMI-experienced 要求 IELTS Academic 总分 6.5，听说读写各 6.0；IELTS Online 和 One Skill Retake 不接受。", new Date().toISOString()),
  };
  return [reviewChange("testRequirements", "IELTS 语言小分", JSON.stringify([requirement]), scoreSourceUrl, original, 0.92)];
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

  reviewItems.push(...parseUtrechtBusinessInformaticsAdmission($, text, sourceUrl));
  reviewItems.push(...parseEnglishTestRequirementsFromTables($, text, sourceUrl));

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

function structuredProgramChanges(extract: StructuredProgramExtract | undefined, sourceUrl: string, university: University) {
  if (!extract) return [] as CatalogRefreshResult["reviewItems"];
  const fetchedAt = new Date().toISOString();
  const fact = (originalText = "", summaryZh = "") => ({ sourceUrl, originalText: cleanText(originalText).slice(0, 4_000), summaryZh: cleanText(summaryZh).slice(0, 1_000), fetchedAt, origin: "official" as const });
  const changes: CatalogRefreshResult["reviewItems"] = [];
  if (extract.overviewOriginal) {
    const overview: Program["overview"] = { title: "项目核心概述", ...fact(extract.overviewOriginal, extract.overviewZh || `该项目围绕 ${extract.overviewOriginal.slice(0, 80)} 展开。`) };
    changes.push(reviewChange("overview", "项目核心概述", JSON.stringify(overview), sourceUrl, overview.originalText, 0.86));
  }
  if (extract.coreCourses?.length) {
    const courses: Program["coreCourses"] = extract.coreCourses.filter((item) => item.name).slice(0, 40).map((item) => ({
      name: cleanText(item.name!), nameZh: cleanText(item.nameZh || ""), creditsEcts: item.creditsEcts ?? null, tags: standardCourseTags(item.name!),
      sourceUrl, originalText: cleanText(item.originalText || item.name!), summaryZh: cleanText(item.nameZh || ""),
    }));
    if (courses.length) changes.push(reviewChange("coreCourses", "核心课程", JSON.stringify(courses), sourceUrl, courses.slice(0, 5).map((item) => item.name).join("；"), 0.84));
  }
  if (extract.careerRoles?.length || extract.employers?.length) {
    const careers: Program["careerOutcomes"] = [{ id: crypto.randomUUID(), roles: extract.careerRoles?.slice(0, 30) ?? [], employers: extract.employers?.slice(0, 30) ?? [], ...fact([...(extract.careerRoles ?? []), ...(extract.employers ?? [])].join("; "), "官网列出的就业方向与雇主示例。") }];
    changes.push(reviewChange("careerOutcomes", "就业方向", JSON.stringify(careers), sourceUrl, careers[0].originalText, 0.78));
  }
  if (extract.premaster) {
    const premaster: Program["premasterInfo"] = { supported: extract.premaster.supported ?? "unknown", nonEuEligible: extract.premaster.nonEuEligible ?? "unknown", requirements: extract.premaster.summaryZh ?? "", ...fact(extract.premaster.originalText, extract.premaster.summaryZh) };
    changes.push(reviewChange("premasterInfo", "Pre-master", JSON.stringify(premaster), sourceUrl, premaster.originalText, 0.82));
  }
  if (extract.dates?.length) {
    const dates: Program["applicationDates"] = extract.dates.filter((item) => item.kind && item.date).slice(0, 30).map((item) => ({ id: crypto.randomUUID(), intake: item.intake ?? "", audience: item.audience ?? "non_eu", kind: item.kind!, date: item.date!, ...fact(item.originalText, item.summaryZh) }));
    if (dates.length) changes.push(reviewChange("applicationDates", "申请与开学日期", JSON.stringify(dates), sourceUrl, dates.map((item) => `${item.kind}: ${item.date}`).join("；"), 0.86));
  }
  if (extract.tests?.length) {
    const tests: Program["testRequirements"] = extract.tests.filter((item) => item.test).slice(0, 20).map((item) => ({
      id: crypto.randomUUID(), test: item.test!, required: item.required ?? true, minimumTotal: item.minimumTotal ?? null, minimumVerbal: item.minimumVerbal ?? null,
      minimumQuantitative: item.minimumQuantitative ?? null, minimumWriting: item.minimumWriting ?? null, minimumListening: item.minimumListening ?? null,
      minimumReading: item.minimumReading ?? null, minimumSpeaking: item.minimumSpeaking ?? null, scoreEdition: item.scoreEdition ?? "", ...fact(item.originalText, item.summaryZh),
    }));
    if (tests.length) changes.push(reviewChange("testRequirements", "IELTS / GRE / GMAT 要求", JSON.stringify(tests), sourceUrl, tests.map((item) => item.originalText).join("；"), 0.88));
  }
  if (extract.chinaEligibility) {
    const eligibility: Program["chinaEligibility"] = { policy: extract.chinaEligibility.policy ?? "unknown", listName: extract.chinaEligibility.listName ?? "", ...fact(extract.chinaEligibility.originalText, extract.chinaEligibility.summaryZh) };
    changes.push(reviewChange("chinaEligibility", "中国院校背景政策", JSON.stringify(eligibility), sourceUrl, eligibility.originalText, 0.76));
  }
  if (extract.materials?.length) {
    const requirements: Program["requirements"] = extract.materials.filter((item) => item.titleOriginal || item.titleZh).slice(0, 50).map((item) => {
      const requestedType = item.materialType as MaterialType;
      const materialType = MATERIAL_TYPES.includes(requestedType) ? requestedType : "other";
      let itemSource = sourceUrl;
      if (item.sourceUrl) {
        try { itemSource = validateOfficialUrl(item.sourceUrl, university).href; } catch { itemSource = sourceUrl; }
      }
      return { id: crypto.randomUUID(), category: "官网材料清单", materialType, required: item.required ?? true, title: cleanText(item.titleZh || item.titleOriginal || "申请材料"), titleOriginal: cleanText(item.titleOriginal || ""), originalText: cleanText(item.originalText || ""), summaryZh: cleanText(item.summaryZh || ""), structuredRequirement: cleanText(item.summaryZh || item.titleZh || ""), intake: "", sourceUrl: itemSource, fetchedAt, verificationState: "confirmed", confidence: 0.86 };
    });
    if (requirements.length) changes.push(reviewChange("requirements", "申请材料", JSON.stringify(requirements), sourceUrl, requirements.map((item) => item.title).join("、"), 0.86));
  }
  const officialLink = (value: string | undefined) => {
    if (!value) return "";
    try { return validateOfficialUrl(value, university).href; } catch { return ""; }
  };
  const links: Program["applicationLinks"] = {
    programUrl: sourceUrl,
    curriculumUrl: officialLink(extract.curriculumUrl), eligibilityUrl: officialLink(extract.eligibilityUrl), materialsUrl: officialLink(extract.materialsUrl),
    careersUrl: officialLink(extract.careersUrl), premasterUrl: officialLink(extract.premasterUrl),
    studielinkUrl: extract.studielinkUrl && /^https:\/\/(?:www\.)?studielink\.nl\//i.test(extract.studielinkUrl) ? extract.studielinkUrl : "https://www.studielink.nl/",
  };
  if (Object.values(links).some((value) => value && value !== sourceUrl && value !== "https://www.studielink.nl/")) changes.push(reviewChange("applicationLinks", "项目精确链接", JSON.stringify(links), sourceUrl, Object.values(links).filter(Boolean).join("；"), 0.9));
  return changes;
}

function standardCourseTags(value: string) {
  const definitions: Array<[string, RegExp]> = [["mathematics", /math|calculus|linear algebra/i], ["statistics", /statistic|probability|econometric/i], ["programming", /program|python|java|software/i], ["database", /database|sql|data management/i], ["business", /business|management|economics|finance/i]];
  return definitions.filter(([, pattern]) => pattern.test(value)).map(([tag]) => tag);
}

export async function refreshProgram(universityId: string, rawUrl: string) {
  const university = getUniversity(universityId);
  if (!university) throw new CatalogFetchError("找不到项目所属大学。");
  return refreshProgramForUniversity(university, rawUrl);
}

export async function refreshProgramForUniversity(university: University, rawUrl: string) {
  const url = validateOfficialUrl(rawUrl, university);
  const { html, finalUrl, structured, provider, warning } = await fetchOfficialPage(url, university);
  const primary = await parseProgramHtml(html, finalUrl, university.id);
  const pages = [{ html, url: finalUrl }];
  const visited = new Set([finalUrl.replace(/\/$/, "")]);
  const supportingQueue = findSupportingUrls(html, finalUrl, university);
  const warnings = [...primary.warnings, ...(warning ? [warning] : [])];
  const automaticUpdates = [...primary.automaticUpdates];
  const reviewItems = [...primary.reviewItems, ...structuredProgramChanges(structured, finalUrl, university)];

  for (let index = 0; index < supportingQueue.length && visited.size < 9; index += 1) {
    const supportingUrl = supportingQueue[index];
    const visitKey = supportingUrl.replace(/\/$/, "");
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);
    try {
      const supportingPage = await fetchOfficialPage(validateOfficialUrl(supportingUrl, university), university);
      pages.push({ html: supportingPage.html, url: supportingPage.finalUrl });
      for (const nestedUrl of findSupportingUrls(supportingPage.html, supportingPage.finalUrl, university)) {
        const nestedKey = nestedUrl.replace(/\/$/, "");
        if (!visited.has(nestedKey) && !supportingQueue.some((item) => item.replace(/\/$/, "") === nestedKey)) supportingQueue.push(nestedUrl);
      }
      if (supportingPage.warning) warnings.push(supportingPage.warning);
      const parsed = await parseProgramHtml(supportingPage.html, supportingPage.finalUrl, university.id);
      parsed.reviewItems.push(...structuredProgramChanges(supportingPage.structured, supportingPage.finalUrl, university));
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
