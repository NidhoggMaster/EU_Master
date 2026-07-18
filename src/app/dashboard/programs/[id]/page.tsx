"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ExternalLink, LockKeyhole, RefreshCw } from "lucide-react";
import { getProgram, saveProgram } from "@/lib/catalog-client";
import { livingCostForProgram } from "@/lib/living-cost-data";
import { ETS_GRE_COMPARISON_URL } from "@/lib/matching";
import {
  CATEGORY_LABELS,
  MATERIAL_TYPES,
  MATERIAL_TYPE_LABELS,
  type ExchangeRate,
  type MaterialType,
  type ProgramDetail,
  type ProgramRequirement,
  type RankingFact,
} from "@/lib/types";

function SectionHeading({ label, title, url, children }: { label: string; title: string; url?: string; children?: ReactNode }) {
  return <div className="panel-heading detail-section-heading"><div><span className="panel-label">{label}</span><h2>{url ? <a href={url} target="_blank" rel="noreferrer">{title}<ExternalLink size={15} aria-hidden="true" /></a> : title}</h2></div>{children}</div>;
}

function sourceLabel(origin: string) {
  return origin === "official" ? "官网" : origin === "manual" ? "手工" : "估算";
}

function RankingCards({ rankings }: { rankings: RankingFact[] }) {
  return <div className="ranking-grid">{rankings.map((ranking) => <article key={ranking.id}>
    <span>{ranking.provider} · {ranking.year}</span>
    <strong>{ranking.rank}</strong>
    <p>{ranking.subject}</p>
    {ranking.summaryZh && <small>{ranking.summaryZh}</small>}
    <a href={ranking.sourceUrl} target="_blank" rel="noreferrer">{sourceLabel(ranking.origin)}来源<ExternalLink size={12} aria-hidden="true" /></a>
  </article>)}</div>;
}

function displayDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "官网未披露";
  return new Date(`${value}T00:00:00`).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

function testScoreLabel(item: ProgramDetail["testRequirements"][number]) {
  if (!item.required) return "不要求";
  if (item.minimumTotal != null) return `总分 ${item.minimumTotal}+`;
  return item.comparisonReference || "要求，分数未披露";
}

function tuitionLabel(program: ProgramDetail, tuitionCny: number | null) {
  const year = program.tuitionAcademicYear || "当前学年";
  if (program.tuitionEur != null) {
    return `${year} · €${program.tuitionEur.toLocaleString("en-US")} · 约 ¥${tuitionCny?.toLocaleString("zh-CN") ?? "--"}`;
  }
  const compact = program.tuition.replace(/\s+/g, " ").trim();
  if (!compact) return `${year} · 官网未披露`;
  return `${year} · ${compact.length <= 42 ? compact : "项目费率待官网确认"}`;
}

function evidenceLabel(level: NonNullable<ProgramDetail["chinaEligibility"]>["evidenceLevel"]) {
  return level === "high" ? "证据较强" : level === "medium" ? "证据一般" : "样本有限";
}

export default function ProgramDetailPage() {
  const id = String(useParams<{ id: string }>().id);
  const [program, setProgram] = useState<ProgramDetail>();
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [requirementTitle, setRequirementTitle] = useState("");
  const [requirementText, setRequirementText] = useState("");
  const [requirementType, setRequirementType] = useState<MaterialType>("transcript");

  useEffect(() => {
    Promise.all([
      getProgram(id),
      fetch("/api/exchange-rates/latest", { cache: "no-store" }).then((response) => response.ok ? response.json() : undefined),
    ]).then(([value, rate]) => {
      setProgram(value);
      setExchangeRate(rate);
    }).catch((error) => setMessage(error instanceof Error ? error.message : "读取项目失败。"))
      .finally(() => setLoading(false));
  }, [id]);

  async function refresh() {
    setRefreshing(true);
    setMessage("");
    try {
      const response = await fetch(`/api/catalog/programs/${encodeURIComponent(id)}/refresh`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "更新失败。");
      setProgram(body.program);
      setMessage(`官网数据已通过 ${body.provider === "firecrawl" ? "Firecrawl" : "合规直连"} 自动写入；应用 ${body.automaticUpdates.length} 项。${body.warnings?.[0] ? ` ${body.warnings[0]}` : ""}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失败。");
    } finally {
      setRefreshing(false);
    }
  }

  async function addRequirement(event: React.FormEvent) {
    event.preventDefault();
    if (!program || !requirementTitle.trim()) return;
    const requirement: ProgramRequirement = {
      id: crypto.randomUUID(),
      category: "手动录入",
      materialType: requirementType,
      required: true,
      title: requirementTitle.trim(),
      titleOriginal: requirementTitle.trim(),
      originalText: requirementText.trim(),
      structuredRequirement: requirementText.trim(),
      summaryZh: requirementText.trim(),
      intake: program.intakes.join(", "),
      sourceUrl: program.applicationLinks.materialsUrl || program.sourceUrl,
      verificationState: "manual",
    };
    const saved = await saveProgram({ ...program, requirements: [...program.requirements, requirement] });
    setProgram(saved);
    setRequirementTitle("");
    setRequirementText("");
    setMessage("手工材料要求已保存并锁定为本地事实。");
  }

  if (loading) return <div className="dashboard-content"><div className="empty-state">正在读取项目详情…</div></div>;
  if (!program) return <div className="dashboard-content"><div className="empty-state"><strong>找不到这个项目</strong><Link href="/dashboard/programs">返回项目目录</Link></div></div>;

  const university = program.universities[0];
  const tuitionCny = program.tuitionEur != null && exchangeRate ? Math.round(program.tuitionEur * exchangeRate.rate) : null;
  const livingCost = livingCostForProgram(program, program.universities);
  const livingMin = livingCost ? livingCost.monthlyMinEur * 12 : null;
  const livingMax = livingCost ? livingCost.monthlyMaxEur * 12 : null;
  const overviewUrl = program.overview?.sourceUrl || program.applicationLinks.programUrl || program.sourceUrl;
  const eligibilityUrl = program.applicationLinks.eligibilityUrl || program.sourceUrl;
  const testRequirementUrl = program.testRequirements[0]?.sourceUrl || eligibilityUrl;
  const universityRankings = program.rankings.filter((ranking) => ranking.scope === "university");
  const subjectRankings = program.rankings.filter((ranking) => ranking.scope === "subject");
  const recordedSourceUrls = new Set(program.sources.map((source) => source.sourceUrl));
  const fieldSources = new Map<string, string>();
  const addFieldSource = (url: string | undefined, label: string) => {
    if (url && !recordedSourceUrls.has(url) && !fieldSources.has(url)) fieldSources.set(url, label);
  };
  addFieldSource(program.applicationLinks.eligibilityUrl, "申请资格与材料页");
  addFieldSource(program.applicationLinks.materialsUrl, "申请材料页");
  addFieldSource(program.applicationLinks.curriculumUrl, "课程页");
  addFieldSource(program.applicationLinks.careersUrl, "就业页");
  addFieldSource(program.applicationLinks.premasterUrl, "Pre-master 页");
  addFieldSource(program.applicationLinks.tuitionUrl, "2026/27 学费表");
  addFieldSource(program.applicationLinks.tuitionCalculatorUrl, "2026/27 学费计算器");
  program.admissionCriteria.forEach((item) => addFieldSource(item.sourceUrl, "申请资格与先修课"));
  program.requirements.forEach((item) => addFieldSource(item.sourceUrl, "申请材料来源"));
  program.applicationDates.forEach((item) => addFieldSource(item.sourceUrl, "申请日期来源"));
  program.testRequirements.forEach((item) => addFieldSource(item.sourceUrl, "语言与标化来源"));
  program.coreCourses.forEach((item) => addFieldSource(item.sourceUrl, "课程来源"));

  return <div className="dashboard-content program-detail-page">
    <Link className="back-link" href="/dashboard/programs"><ArrowLeft size={15} aria-hidden="true" />项目目录</Link>
    <header className="program-hero">
      <div><div className="tag-row">{program.categories.map((item) => <span key={item}>{CATEGORY_LABELS[item]}</span>)}{program.premasterInfo?.nonEuEligible === "yes" && <span className="tag-positive">支持非欧盟 Pre-master</span>}{program.premasterInfo?.nonEuEligible === "no" && <span>非欧盟不适用 Pre-master</span>}</div><h1>{program.name}</h1><p>{program.universities.map((item) => item.name).join(" + ")} · {program.city || university?.city || "地点未披露"}</p></div>
      <div className="program-hero-actions"><a className="button button-outline" href={program.applicationLinks.programUrl || program.sourceUrl} target="_blank" rel="noreferrer">项目官网<ExternalLink size={15} aria-hidden="true" /></a><button className="button button-primary" type="button" disabled={refreshing} onClick={refresh}><RefreshCw size={15} aria-hidden="true" />{refreshing ? "更新中" : "刷新官网"}</button></div>
    </header>
    {message && <div className="notice" role="status">{message}</div>}

    <section className="detail-facts">
      <div><span>学制 / 学分</span><strong>{[program.duration, program.ects].filter(Boolean).join(" · ") || "官网未披露"}</strong></div>
      <div><span>学费</span><strong>{program.applicationLinks.tuitionUrl ? <a href={program.applicationLinks.tuitionUrl} target="_blank" rel="noreferrer">{tuitionLabel(program, tuitionCny)}<ExternalLink size={11} aria-hidden="true" /></a> : tuitionLabel(program, tuitionCny)}</strong></div>
      <div><span>生活费 / 年</span><strong>{livingMin == null ? "官网未披露" : livingCost?.sourceUrl ? <a href={livingCost.sourceUrl} target="_blank" rel="noreferrer">€{livingMin.toLocaleString("en-US")}–€{(livingMax ?? livingMin).toLocaleString("en-US")} · 约 ¥{exchangeRate ? Math.round(livingMin * exchangeRate.rate).toLocaleString("zh-CN") : "--"} 起<ExternalLink size={11} aria-hidden="true" /></a> : `€${livingMin.toLocaleString("en-US")}–€${(livingMax ?? livingMin).toLocaleString("en-US")} · 约 ¥${exchangeRate ? Math.round(livingMin * exchangeRate.rate).toLocaleString("zh-CN") : "--"} 起`}</strong></div>
      <div><span>入学时间</span><strong>{program.intakes.join("、") || "官网未披露"}</strong></div>
      <div><span>授课语言</span><strong>{program.language || "官网未披露"}</strong></div>
      <div><span>数据状态</span><strong>完整度 {program.dataCompleteness}% · {program.lastFetchedAt ? new Date(program.lastFetchedAt).toLocaleDateString("zh-CN") : "尚未抓取"}</strong></div>
    </section>

    <section className="dashboard-panel detail-section">
      <SectionHeading label="项目与学校" title="QS 排名" url={program.rankings[0]?.sourceUrl}>{program.rankings.length > 0 && <span className="zero-state-tag">{program.rankings.length} 项</span>}</SectionHeading>
      {program.rankings.length ? <div className="ranking-groups">
        {universityRankings.length > 0 && <section><h3>学校总榜 · QS 2027</h3><RankingCards rankings={universityRankings} /></section>}
        {subjectRankings.length > 0 && <section><h3>最接近项目方向的学科榜 · QS 2026</h3><p className="ranking-scope-note">{program.institutionIds.length > 1 ? "联合项目没有单独 QS 名次；下列排名分别反映合作院校的相关学科底盘。" : "下列学科排名用于判断相关学科底盘，不等同于项目自身排名。"}</p><RankingCards rankings={subjectRankings} /></section>}
      </div> : <p className="empty-inline">尚未录入适用于本项目的排名。</p>}
    </section>

    <section className="dashboard-panel detail-section">
      <SectionHeading label="项目介绍" title="核心概述" url={overviewUrl}>{program.fieldLocks.includes("overview") && <span className="locked-fact"><LockKeyhole size={13} aria-hidden="true" />手工锁定</span>}</SectionHeading>
      {program.overview ? <div className="bilingual-fact"><blockquote>{program.overview.originalText}</blockquote><p>{program.overview.summaryZh || "暂无中文概述。"}</p><small>{sourceLabel(program.overview.origin)} · {program.overview.fetchedAt ? new Date(program.overview.fetchedAt).toLocaleString("zh-CN") : "时间未记录"}</small></div> : <p className="empty-inline">官网未披露可可靠提取的项目概述。</p>}
    </section>

    <section className="dashboard-panel detail-section">
      <SectionHeading label="学制与培养" title="核心课程" url={program.applicationLinks.curriculumUrl || program.sourceUrl}><span className="zero-state-tag">{program.coreCourses.length} 门</span></SectionHeading>
      {program.coreCourses.length ? <div className="course-fact-list">{program.coreCourses.map((course, index) => <article key={`${course.name}-${index}`}><div><strong>{course.name}</strong>{course.nameZh && <span>{course.nameZh}</span>}</div><em>{course.creditsEcts == null ? "ECTS 未披露" : `${course.creditsEcts} ECTS`}</em>{course.originalText && <p>{course.originalText}</p>}{course.summaryZh && <small>{course.summaryZh}</small>}</article>)}</div> : <p className="empty-inline">官网未披露可结构化的核心课程。</p>}
    </section>

    <section className="dashboard-panel detail-section">
      <SectionHeading label="毕业去向" title="就业情况" url={program.applicationLinks.careersUrl || program.sourceUrl}><span className="zero-state-tag">{program.careerOutcomes.length} 组</span></SectionHeading>
      {program.careerOutcomes.length ? <div className="career-list">{program.careerOutcomes.map((outcome) => <article key={outcome.id}><div><span>岗位</span><p>{outcome.roles.join("、") || "官网未列出"}</p></div><div><span>公司</span><p>{outcome.employers.join("、") || "官网未列出"}</p></div><blockquote>{outcome.originalText}</blockquote><small>{outcome.summaryZh}</small></article>)}</div> : <p className="empty-inline">官网未披露具体岗位或雇主信息。</p>}
    </section>

    <div className="detail-two-column">
      <section className="dashboard-panel detail-section">
        <SectionHeading label="非欧盟申请人" title="Pre-master" url={program.applicationLinks.premasterUrl || program.premasterInfo?.sourceUrl || program.sourceUrl} />
        {program.premasterInfo ? <div className="status-fact"><strong>{program.premasterInfo.supported === "yes" ? "支持" : program.premasterInfo.supported === "no" ? "不支持" : "官网未明确"}</strong><p>非欧盟：{program.premasterInfo.nonEuEligible === "yes" ? "可申请" : program.premasterInfo.nonEuEligible === "no" ? "不可申请" : "未明确"}</p><p>{program.premasterInfo.summaryZh}</p></div> : <p className="empty-inline">官网未披露本项目的 Pre-master 路径。</p>}
      </section>
      <section className="dashboard-panel detail-section">
        <SectionHeading label="中国院校背景" title="双非 / 院校名单" url={program.chinaEligibility?.sourceUrl || eligibilityUrl} />
        {program.chinaEligibility ? <div className="status-fact"><div className="status-title-row"><strong>{program.chinaEligibility.policy === "institution_list" ? "参考院校层次" : program.chinaEligibility.policy === "restricted" ? "院校背景参与审理" : program.chinaEligibility.policy === "accepted" ? "双非可申请" : "官网未明确"}</strong>{program.chinaEligibility.evidenceLevel && <span className="zero-state-tag">{evidenceLabel(program.chinaEligibility.evidenceLevel)}</span>}</div>{program.chinaEligibility.listName && <p>{program.chinaEligibility.listName}</p>}<p>{program.chinaEligibility.summaryZh}</p>{program.chinaEligibility.communityConclusion && <p className="community-conclusion">社区参考：{program.chinaEligibility.communityConclusion}</p>}{program.chinaEligibility.references?.length ? <div className="evidence-links">{program.chinaEligibility.references.map((reference) => <a href={reference.url} target="_blank" rel="noreferrer" key={`${reference.platform}-${reference.url}`} title={reference.note}>{reference.platform === "official" ? "官网" : reference.platform === "zhihu" ? "知乎" : reference.platform === "reddit" ? "Reddit" : reference.platform === "forum" ? "论坛" : "留学平台"}<ExternalLink size={11} aria-hidden="true" /></a>)}</div> : null}{program.chinaEligibility.platformsChecked?.length ? <small>已检索：{program.chinaEligibility.platformsChecked.join("、")}；仅展示可复核样本。</small> : null}</div> : <p className="empty-inline">官网未披露针对中国院校层次的明确名单或限制。</p>}
      </section>
    </div>

    <section className="dashboard-panel detail-section">
      <SectionHeading label="非欧盟申请周期" title="申请与开学日期" url={eligibilityUrl}><span className="zero-state-tag">{program.applicationDates.length} 个日期</span></SectionHeading>
      {program.applicationDates.length ? <div className="date-timeline">{program.applicationDates.map((item) => <article key={item.id}><span>{item.kind === "application_open" ? "申请开放" : item.kind === "deadline" ? "截止" : item.kind === "study_start" ? "开学" : "结束"}</span><strong>{displayDate(item.date)}</strong><p>{item.intake} · {item.audience === "non_eu" ? "非欧盟" : item.audience === "eu" ? "欧盟" : "全部申请人"}</p></article>)}</div> : <p className="empty-inline">官网未披露可精确解析的非欧盟申请日期。</p>}
    </section>

    <section className="dashboard-panel detail-section">
      <SectionHeading label="语言与标化" title="IELTS、GRE 与 GMAT" url={testRequirementUrl}><a className="heading-tool-link" href={ETS_GRE_COMPARISON_URL} target="_blank" rel="noreferrer">ETS 官方换算工具<ExternalLink size={13} aria-hidden="true" /></a></SectionHeading>
      {program.testRequirements.length ? <div className="test-requirement-grid">{program.testRequirements.map((item) => <article key={item.id}><span>{item.test}</span><strong>{testScoreLabel(item)}</strong>{item.comparisonReference && item.comparisonUrl && <a className="cell-link" href={item.comparisonUrl} target="_blank" rel="noreferrer">{item.comparisonReference}<ExternalLink size={12} aria-hidden="true" /></a>}<dl><div><dt>Verbal</dt><dd>{item.minimumVerbal ?? "--"}</dd></div><div><dt>Quant</dt><dd>{item.minimumQuantitative ?? "--"}</dd></div><div><dt>Writing</dt><dd>{item.minimumWriting ?? "--"}</dd></div><div><dt>Listening</dt><dd>{item.minimumListening ?? "--"}</dd></div><div><dt>Reading</dt><dd>{item.minimumReading ?? "--"}</dd></div><div><dt>Speaking</dt><dd>{item.minimumSpeaking ?? "--"}</dd></div></dl><p>{item.summaryZh}</p><details className="source-excerpt"><summary>官网原文</summary><blockquote>{item.originalText}</blockquote></details></article>)}</div> : <p className="empty-inline">官网未披露可结构化的 IELTS、GRE 或 GMAT 要求。</p>}
    </section>

    <section className="dashboard-panel detail-section">
      <SectionHeading label="学历、专业与课程" title="申请资格与先修课" url={eligibilityUrl}><span className="zero-state-tag">{program.admissionCriteria.length} 条</span></SectionHeading>
      {program.admissionCriteria.length ? <div className="criterion-list">{program.admissionCriteria.map((criterion) => <article key={criterion.id}><div><span>{criterion.kind === "prerequisite" ? "先修课" : criterion.kind === "degree" ? "学历 / 专业" : criterion.kind === "gpa" ? "GPA" : criterion.kind === "experience" ? "经历" : criterion.kind === "language" ? "语言" : "其他"}</span><strong>{criterion.title}</strong></div><em>{criterion.creditsEcts == null ? "" : `${criterion.creditsEcts} ECTS`}</em><p>{criterion.description}</p>{criterion.summaryZh && <small>{criterion.summaryZh}</small>}<a href={criterion.sourceUrl || eligibilityUrl} target="_blank" rel="noreferrer">精确来源<ExternalLink size={12} aria-hidden="true" /></a></article>)}</div> : <p className="empty-inline">官网未披露可结构化的本科专业、学历或先修课程要求。</p>}
    </section>

    <section className="dashboard-panel detail-section requirements-panel">
      <SectionHeading label="申请文件" title="完整材料要求" url={program.applicationLinks.materialsUrl || eligibilityUrl}><span className="zero-state-tag">{program.requirements.length} 条</span></SectionHeading>
      {program.requirements.length ? <div className="requirement-list">{program.requirements.map((item) => <article key={item.id}><span className={item.required ? "required-dot" : "optional-dot"}/><div><div className="requirement-title"><strong>{item.title}</strong>{item.titleOriginal && item.titleOriginal !== item.title && <span>{item.titleOriginal}</span>}</div><blockquote>{item.originalText || "官网没有提供原文摘录。"}</blockquote><p>{item.summaryZh || item.structuredRequirement || "暂无中文概述。"}</p><small>{MATERIAL_TYPE_LABELS[item.materialType]} · {item.required ? "必需" : "可选"} · {item.verificationState === "manual" ? "手工锁定" : "官网事实"}</small></div></article>)}</div> : <p className="empty-inline">官网未披露可可靠提取的申请材料清单。</p>}
      <details className="manual-add"><summary>添加手工材料要求</summary><form className="inline-add-form" onSubmit={addRequirement}><label>中文标题<input required value={requirementTitle} onChange={(event) => setRequirementTitle(event.target.value)} /></label><label>材料类型<select value={requirementType} onChange={(event) => setRequirementType(event.target.value as MaterialType)}>{MATERIAL_TYPES.map((type) => <option value={type} key={type}>{MATERIAL_TYPE_LABELS[type]}</option>)}</select></label><label className="full-field">说明<textarea rows={3} value={requirementText} onChange={(event) => setRequirementText(event.target.value)} /></label><button className="button button-primary" type="submit">添加要求</button></form></details>
    </section>

    <section className="dashboard-panel source-panel detail-section">
      <SectionHeading label="字段级溯源" title="官方来源与刷新记录" url={program.sourceUrl}><span className="zero-state-tag">完整度 {program.dataCompleteness}%</span></SectionHeading>
      <div className="source-list">{program.sources.map((source) => <a href={source.sourceUrl} target="_blank" rel="noreferrer" key={source.id}><strong>{source.title || "官方项目页"}</strong><span>{source.provider} · {source.fetchedAt ? new Date(source.fetchedAt).toLocaleString("zh-CN") : "等待首次抓取"} · {source.verificationState}</span></a>)}{[...fieldSources.entries()].map(([url, label]) => <a href={url} target="_blank" rel="noreferrer" key={url}><strong>{label}</strong><span>字段级官网来源 · 精确页面</span></a>)}{livingCost?.sourceUrl && <a href={livingCost.sourceUrl} target="_blank" rel="noreferrer"><strong>生活费参考来源</strong><span>{livingCost.sourceLabel} · {livingCost.origin === "official" ? "官网区间" : "官网基准保守估算"} · {livingCost.asOf}</span></a>}</div>
      {program.pendingChanges.length > 0 && <p className="legacy-history-note">另有 {program.pendingChanges.length} 条旧版待审核记录，已归档为只读历史，不会写入当前项目事实。</p>}
    </section>

    <section className="create-application-banner"><div><span className="panel-label">下一步</span><h2>对比或建立申请</h2><p>申请会复制当前项目要求，后续官网更新不会静默改动申请快照。</p></div><div className="program-hero-actions"><Link className="button button-outline" href={`/dashboard/compare?ids=${program.id}`}>加入对比</Link><Link className="button button-primary" href={`/dashboard/applications?program=${program.id}`}>创建申请</Link></div></section>
  </div>;
}
