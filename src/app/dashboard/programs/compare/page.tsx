"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Plus, RefreshCw, X } from "lucide-react";
import { getPrograms } from "@/lib/catalog-client";
import { ETS_GRE_COMPARISON_URL } from "@/lib/matching";
import {
  MATERIAL_TYPE_LABELS,
  type CompareResponse,
  type Program,
  type ProgramDetail,
  type ProgramTestRequirement,
  type RequirementMatchOverride,
} from "@/lib/types";

type Response = CompareResponse & { recommendations: { id: string; name: string; universities: string[]; similarity: number }[] };
type MatchState = RequirementMatchOverride["state"];

const euro = (value: number | null) => value == null ? "未披露" : new Intl.NumberFormat("zh-CN", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
const cny = (value: number | null) => value == null ? "未披露" : new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value);

function tuitionLabel(program: ProgramDetail) {
  if (program.tuitionEur != null) return euro(program.tuitionEur);
  return program.tuition.includes("待官网确认") ? "待确认" : "未披露";
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

function requirement(program: ProgramDetail, test: "IELTS" | "GRE" | "GMAT") {
  return program.testRequirements.find((item) => item.test === test);
}

function TestCell({ item }: { item?: ProgramTestRequirement }) {
  if (!item) return <span className="muted-cell">官网未披露</span>;
  if (!item.required) return <strong>不要求</strong>;
  const sectionScores = [
    ["V", item.minimumVerbal], ["Q", item.minimumQuantitative], ["W", item.minimumWriting],
    ["L", item.minimumListening], ["R", item.minimumReading], ["S", item.minimumSpeaking],
  ].filter((entry) => entry[1] != null);
  return <div className="compare-test-cell"><strong>{item.minimumTotal == null ? "要求" : `总分 ${item.minimumTotal}+`}</strong>{item.comparisonReference && <span>{item.comparisonReference}</span>}{sectionScores.length > 0 && <span>{sectionScores.map(([label, value]) => `${label} ${value}`).join(" · ")}</span>}<small>{item.summaryZh || item.originalText}</small></div>;
}

export default function ComparePage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<Program[]>([]);
  const [result, setResult] = useState<Response>();
  const [overrides, setOverrides] = useState<RequirementMatchOverride[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ids = [...new Set(new URLSearchParams(window.location.search).get("ids")?.split(",").filter(Boolean) ?? [])].slice(0, 8);
    Promise.resolve().then(() => {
      setSelected(ids);
      return Promise.all([
        getPrograms(),
        ids.length ? fetch(`/api/catalog/matches?programIds=${ids.join(",")}`, { cache: "no-store" }).then((response) => response.json()) : [],
      ]);
    }).then(([programs, savedOverrides]) => {
      setCatalog(programs);
      setOverrides(savedOverrides as RequirementMatchOverride[]);
      if (ids.length >= 2) void compare(ids);
    }).catch((error) => setMessage(error instanceof Error ? error.message : "读取对比数据失败。"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function compare(ids = selected) {
    if (ids.length < 2 || ids.length > 8) {
      setMessage("请选择 2–8 个项目后开始比较。");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/catalog/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ programIds: ids }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "比较失败。");
      setResult(body);
      window.history.replaceState(null, "", `?ids=${ids.join(",")}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "比较失败。");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 8) {
        setMessage("一次最多比较 8 个项目。");
        return current;
      }
      return [...current, id];
    });
  }

  function addSimilar(id: string) {
    if (selected.length >= 8) {
      setMessage("已达到 8 个项目上限。");
      return;
    }
    const next = [...new Set([...selected, id])];
    setSelected(next);
    void compare(next);
  }

  async function saveMatch(programId: string, criterionId: string, state: MatchState) {
    const existing = overrides.find((item) => item.programId === programId && item.criterionId === criterionId);
    try {
      const response = await fetch("/api/catalog/matches", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: existing?.id, programId, criterionId, state, note: existing?.note ?? "" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "保存课程匹配失败。");
      setOverrides((items) => [...items.filter((item) => !(item.programId === programId && item.criterionId === criterionId)), body]);
      setMessage("课程匹配已保存；请更新对比以重算竞争力。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存课程匹配失败。");
    }
  }

  const selectedCatalog = useMemo(() => selected.map((id) => catalog.find((item) => item.id === id)).filter(Boolean) as Program[], [catalog, selected]);
  const sharedCourses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const comparison of result?.comparisons ?? []) {
      for (const key of new Set(comparison.program.coreCourses.map((course) => normalized(course.nameZh || course.name)).filter(Boolean))) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
  }, [result]);
  const sharedMaterials = useMemo(() => {
    const counts = new Map<string, number>();
    for (const comparison of result?.comparisons ?? []) for (const requirement of comparison.program.requirements) counts.set(requirement.materialType, (counts.get(requirement.materialType) ?? 0) + 1);
    return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
  }, [result]);

  return <div className="dashboard-content compare-content">
    <Link className="back-link" href="/dashboard/programs"><ArrowLeft size={15} aria-hidden="true" />项目目录</Link>
    <header className="page-heading"><div><span className="dashboard-date">2–8 个项目 · 同行信息对齐</span><h1>项目对比</h1><p>手工课程匹配会保存到本机，并参与下一次竞争力计算。</p></div><button className="button button-primary" disabled={loading || selected.length < 2} onClick={() => compare()}><RefreshCw size={15} aria-hidden="true" />{loading ? "计算中" : "更新对比"}</button></header>
    {message && <div className="notice" role="status">{message}</div>}

    <section className="compare-picker">
      <div className="compare-selected"><strong>已选 {selected.length}/8</strong>{selectedCatalog.map((program) => <button type="button" key={program.id} onClick={() => toggle(program.id)}>{program.name}<X size={13} aria-hidden="true" /></button>)}</div>
      <details><summary><Plus size={14} aria-hidden="true" />添加项目</summary><div className="compare-picker-list">{catalog.map((program) => <label key={program.id}><input type="checkbox" checked={selected.includes(program.id)} onChange={() => toggle(program.id)} />{program.name}</label>)}</div></details>
    </section>

    {result && <>
      <div className="compare-disclaimer"><strong>竞争力不等于录取概率</strong><span>{result.disclaimer}</span><span>ECB {result.exchangeRate.effectiveDate}：1 EUR = {result.exchangeRate.rate} CNY{result.exchangeRate.stale ? "（缓存）" : ""}</span></div>

      <section className="comparison-table-wrap" aria-label="项目详细对比">
        <table className="comparison-table">
          <thead><tr><th className="comparison-row-label">项目</th>{result.comparisons.map((item) => <th key={item.program.id}><span>{item.program.universities.map((university) => university.shortName).join(" + ")}</span><a href={item.program.applicationLinks.programUrl || item.program.sourceUrl} target="_blank" rel="noreferrer">{item.program.name}<ExternalLink size={13} aria-hidden="true" /></a><div className="comparison-score"><strong>{item.score == null ? "--" : Math.round(item.score)}</strong><small>{item.scoreStatus === "hard_risk" ? "硬条件未满足" : item.scoreStatus === "insufficient" ? `证据 ${item.evidenceCoverage}%` : `竞争力 · 证据 ${item.evidenceCoverage}%`}</small></div>{item.probabilityMinimum != null && item.probabilityMaximum != null && <em>概率区间 {item.probabilityMinimum}%–{item.probabilityMaximum}%</em>}</th>)}</tr></thead>
          <tbody>
            <tr><th className="comparison-row-label">学校与排名</th>{result.comparisons.map((item) => <td key={item.program.id}><strong>{item.program.universities.map((university) => university.name).join(" + ")}</strong><span>{item.program.city || item.program.universities[0]?.city || "地点未披露"}</span>{item.program.rankings.length ? item.program.rankings.map((ranking) => <small key={ranking.id} title={ranking.summaryZh}>{ranking.scope === "university" ? "总榜" : "学科"} · {ranking.provider} {ranking.year} · {ranking.rank} {ranking.subject}</small>) : <small>排名待录入</small>}</td>)}</tr>
            <tr><th className="comparison-row-label">项目概述</th>{result.comparisons.map((item) => <td key={item.program.id}>{item.program.overview ? <><p>{item.program.overview.summaryZh}</p><blockquote>{item.program.overview.originalText}</blockquote></> : <span className="muted-cell">官网未披露</span>}</td>)}</tr>
            <tr><th className="comparison-row-label">学制 / 学分</th>{result.comparisons.map((item) => <td key={item.program.id}><strong>{item.program.duration || "未披露"}</strong><span>{item.program.ects || "ECTS 未披露"}</span></td>)}</tr>
            <tr><th className="comparison-row-label">首年费用</th>{result.comparisons.map((item) => <td key={item.program.id}><strong>{euro(item.firstYearMinEur)}–{euro(item.firstYearMaxEur)}</strong><span>学费 {tuitionLabel(item.program)}</span><span>生活费 {euro(item.livingCostAnnualMinEur)}–{euro(item.livingCostAnnualMaxEur)}</span><small>{cny(item.firstYearMinCny)}–{cny(item.firstYearMaxCny)}</small></td>)}</tr>
            <tr className="comparison-rich-row"><th className="comparison-row-label">核心课程</th>{result.comparisons.map((item) => <td key={item.program.id}><div className="comparison-token-list">{item.program.coreCourses.length ? item.program.coreCourses.map((course, index) => { const shared = sharedCourses.has(normalized(course.nameZh || course.name)); return <span className={shared ? "shared-token" : ""} key={`${course.name}-${index}`}>{course.nameZh || course.name}{course.creditsEcts == null ? "" : ` · ${course.creditsEcts} ECTS`}</span>; }) : <span className="muted-cell">官网未披露</span>}</div></td>)}</tr>
            <tr className="comparison-rich-row"><th className="comparison-row-label">课程与背景匹配</th>{result.comparisons.map((item) => <td key={item.program.id}><div className="comparison-match-list">{item.program.admissionCriteria.filter((criterion) => ["prerequisite", "degree", "gpa"].includes(criterion.kind)).map((criterion) => { const saved = overrides.find((override) => override.programId === item.program.id && override.criterionId === criterion.id); return <label key={criterion.id}><span>{criterion.title}{criterion.creditsEcts == null ? "" : ` · ${criterion.creditsEcts} ECTS`}</span><select value={saved?.state ?? "unknown"} onChange={(event) => saveMatch(item.program.id, criterion.id, event.target.value as MatchState)}><option value="unknown">待确认</option><option value="matched">满足</option><option value="partial">部分满足</option><option value="not_matched">不满足</option></select></label>; })}{!item.program.admissionCriteria.length && <span className="muted-cell">官网未披露</span>}</div></td>)}</tr>
            <tr><th className="comparison-row-label">IELTS</th>{result.comparisons.map((item) => <td key={item.program.id}><TestCell item={requirement(item.program, "IELTS")} /></td>)}</tr>
            <tr><th className="comparison-row-label"><a href={ETS_GRE_COMPARISON_URL} target="_blank" rel="noreferrer">GRE / GMAT<ExternalLink size={12} aria-hidden="true" /></a></th>{result.comparisons.map((item) => <td key={item.program.id}><TestCell item={requirement(item.program, "GRE") || requirement(item.program, "GMAT")} /><a className="cell-link" href={ETS_GRE_COMPARISON_URL} target="_blank" rel="noreferrer">ETS 官方换算工具</a></td>)}</tr>
            <tr><th className="comparison-row-label">申请日期</th>{result.comparisons.map((item) => <td key={item.program.id}>{item.program.applicationDates.length ? item.program.applicationDates.map((date) => <span key={date.id}>{date.kind === "deadline" ? "截止" : date.kind === "application_open" ? "开放" : date.kind === "study_start" ? "开学" : "结束"}：{date.date} · {date.intake}</span>) : <span className="muted-cell">官网未披露</span>}</td>)}</tr>
            <tr><th className="comparison-row-label">双非 / 院校名单</th>{result.comparisons.map((item) => <td key={item.program.id}>{item.program.chinaEligibility ? <><strong>{item.program.chinaEligibility.policy === "institution_list" ? "使用院校名单" : item.program.chinaEligibility.policy === "restricted" ? "存在限制" : item.program.chinaEligibility.policy === "accepted" ? "未见额外限制" : "未明确"}</strong><p>{item.program.chinaEligibility.summaryZh}</p></> : <span className="muted-cell">官网未披露</span>}</td>)}</tr>
            <tr><th className="comparison-row-label">Pre-master</th>{result.comparisons.map((item) => <td key={item.program.id}>{item.program.premasterInfo ? <><strong>{item.program.premasterInfo.supported === "yes" ? "支持" : item.program.premasterInfo.supported === "no" ? "不支持" : "未明确"}</strong><span>非欧盟：{item.program.premasterInfo.nonEuEligible === "yes" ? "可申请" : item.program.premasterInfo.nonEuEligible === "no" ? "不可申请" : "未明确"}</span><p>{item.program.premasterInfo.summaryZh}</p></> : <span className="muted-cell">官网未披露</span>}</td>)}</tr>
            <tr><th className="comparison-row-label">就业方向</th>{result.comparisons.map((item) => <td key={item.program.id}>{item.program.careerOutcomes.length ? item.program.careerOutcomes.map((outcome) => <div key={outcome.id}><span>岗位：{outcome.roles.join("、") || "未列出"}</span><span>公司：{outcome.employers.join("、") || "未列出"}</span></div>) : <span className="muted-cell">官网未披露</span>}</td>)}</tr>
            <tr className="comparison-rich-row"><th className="comparison-row-label">申请材料</th>{result.comparisons.map((item) => <td key={item.program.id}><div className="comparison-token-list">{item.program.requirements.length ? item.program.requirements.map((material) => <span className={sharedMaterials.has(material.materialType) ? "shared-token" : ""} key={material.id}>{MATERIAL_TYPE_LABELS[material.materialType]} · {material.title}</span>) : <span className="muted-cell">官网未披露</span>}</div><small>{item.missingMaterials.length ? `待准备：${item.missingMaterials.map((type) => MATERIAL_TYPE_LABELS[type]).join("、")}` : "已准备已识别的基本材料"}</small></td>)}</tr>
            <tr><th className="comparison-row-label">维度评分</th>{result.comparisons.map((item) => <td key={item.program.id}><div className="comparison-dimensions">{item.dimensions.filter((dimension) => dimension.weight > 0).map((dimension) => <div key={dimension.key}><span>{dimension.label}</span><strong>{dimension.known ? dimension.score : "--"}</strong></div>)}</div>{item.hardRisks.length > 0 && <div className="risk-box"><strong>硬条件风险</strong>{item.hardRisks.map((risk) => <span key={risk}>{risk}</span>)}</div>}</td>)}</tr>
            <tr><th className="comparison-row-label">来源</th>{result.comparisons.map((item) => <td key={item.program.id}>{item.program.sources.map((source) => <a className="cell-link" href={source.sourceUrl} target="_blank" rel="noreferrer" key={source.id}>{source.title || "官方来源"}<ExternalLink size={11} aria-hidden="true" /></a>)}<small>{item.program.lastFetchedAt ? new Date(item.program.lastFetchedAt).toLocaleString("zh-CN") : "等待首次刷新"}</small></td>)}</tr>
          </tbody>
        </table>
      </section>

      {result.recommendations.length > 0 && <section className="dashboard-panel similar-panel"><div className="panel-heading"><div><span className="panel-label">同类项目</span><h2>相似项目</h2></div></div><div>{result.recommendations.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{item.universities.join(" + ")} · 相似度 {item.similarity}%</span></div><button type="button" onClick={() => addSimilar(item.id)}>加入对比</button></article>)}</div></section>}
    </>}
  </div>;
}
