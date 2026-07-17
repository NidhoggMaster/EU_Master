"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getPrograms } from "@/lib/catalog-client";
import { getMaterials } from "@/lib/db";
import { CATEGORY_LABELS, MATERIAL_TYPE_LABELS, type CompareResponse, type Program } from "@/lib/types";

type Response = CompareResponse & { recommendations: { id: string; name: string; universities: string[]; similarity: number }[] };
const euro = (value: number | null) => value == null ? "待核验" : new Intl.NumberFormat("zh-CN", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
const cny = (value: number | null) => value == null ? "待核验" : new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value);

export default function ComparePage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<Program[]>([]);
  const [result, setResult] = useState<Response>();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ids = [...new Set(new URLSearchParams(window.location.search).get("ids")?.split(",").filter(Boolean) ?? [])].slice(0,4);
    Promise.resolve().then(() => {
      setSelected(ids);
      getPrograms().then(setCatalog).catch((error) => setMessage(error.message));
      if (ids.length >= 2) void compare(ids);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function compare(ids = selected) {
    if (ids.length < 2 || ids.length > 4) { setMessage("请选择 2–4 个项目后开始比较。"); return; }
    setLoading(true); setMessage("");
    try {
      const materials = await getMaterials();
      const response = await fetch("/api/catalog/compare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ programIds: ids, materials: materials.map((item) => ({ type: item.type, status: item.status })) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "比较失败。");
      setResult(body); window.history.replaceState(null, "", `?ids=${ids.join(",")}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "比较失败。"); }
    finally { setLoading(false); }
  }

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current,id] : current);
  }

  function addSimilar(id: string) {
    if (selected.length >= 4) { setMessage("已达到 4 个项目上限。"); return; }
    const next = [...new Set([...selected,id])]; setSelected(next); void compare(next);
  }

  const maximumCost = useMemo(() => Math.max(1, ...(result?.comparisons.map((item) => item.firstYearMaxEur ?? 0) ?? [1])), [result]);
  const dimensions = result?.comparisons[0]?.dimensions ?? [];

  return <div className="dashboard-content compare-content">
    <Link className="back-link" href="/dashboard/programs">← 返回项目目录</Link>
    <header className="page-heading"><div><span className="dashboard-date">透明评分 · 费用统一换算</span><h1>项目对比</h1><p>一次比较 2–4 个项目。缺少官网字段或档案证据会按 0 分，并与硬条件风险分别呈现。</p></div><button className="button button-primary" disabled={loading || selected.length < 2} onClick={() => compare()}>{loading ? "计算中…" : "更新对比"}</button></header>
    {message && <div className="notice">{message}</div>}
    <section className="compare-picker"><strong>已选 {selected.length}/4</strong><div>{catalog.map((program) => <label key={program.id}><input type="checkbox" checked={selected.includes(program.id)} onChange={() => toggle(program.id)} />{program.name}</label>)}</div></section>

    {result && <>
      <div className="compare-disclaimer"><strong>匹配度参考，不是录取概率</strong><span>{result.disclaimer}</span><span>数据完整度独立显示；EUR/CNY 使用 ECB {result.exchangeRate.effectiveDate} 最新工作日参考汇率 1 EUR = {result.exchangeRate.rate} CNY{result.exchangeRate.stale ? "（缓存数据，当前获取失败）" : ""}。</span></div>
      <section className="compare-score-grid">{result.comparisons.map((item) => <article key={item.program.id}><div className="score-head"><div><span>{item.program.universities.map((u) => u.shortName).join(" + ")}</span><h2>{item.program.name}</h2></div><strong>{item.score}<small>/100</small></strong></div><div className="completeness-line"><span>官网数据完整度</span><b>{item.dataCompleteness}%</b></div>{item.dimensions.map((dimension) => <div className="dimension-row" key={dimension.key} title={[...dimension.reasons,...dimension.missingEvidence].join("\n")}><span>{dimension.label}<small>权重 {dimension.weight}%</small></span><div><i style={{ width: `${dimension.score}%` }} /></div><strong>{dimension.score}</strong></div>)}{item.hardRisks.length ? <div className="risk-box"><strong>硬条件风险</strong>{item.hardRisks.map((risk) => <span key={risk}>{risk}</span>)}</div> : <div className="risk-box safe"><strong>未识别到已核验硬条件失败</strong></div>}</article>)}</section>

      <section className="dashboard-panel cost-panel"><div className="panel-heading"><div><span className="panel-label">首年预算</span><h2>学费、生活费与人民币参考</h2></div></div><div className="cost-chart">{result.comparisons.map((item) => { const tuitionWidth=(item.tuitionEur??0)/maximumCost*100; const livingWidth=(item.livingCostAnnualMaxEur??0)/maximumCost*100; return <article key={item.program.id}><strong>{item.program.name}</strong><div className="cost-bar"><i className="tuition" style={{width:`${tuitionWidth}%`}}/><i className="living" style={{width:`${livingWidth}%`}}/></div><span>学费 {euro(item.tuitionEur)} · 生活费 {euro(item.livingCostAnnualMinEur)}–{euro(item.livingCostAnnualMaxEur)} · 合计 {euro(item.firstYearMinEur)}–{euro(item.firstYearMaxEur)}</span><small>{cny(item.firstYearMinCny)}–{cny(item.firstYearMaxCny)}</small></article>;})}</div><div className="chart-legend"><span><i className="tuition"/>学费</span><span><i className="living"/>生活费上限</span></div></section>

      <section className="compare-matrix-wrap"><table className="compare-matrix"><thead><tr><th>关键字段</th>{result.comparisons.map((item) => <th key={item.program.id}>{item.program.name}</th>)}</tr></thead><tbody>
        <tr><th>学校 / 地点 / 地段</th>{result.comparisons.map((item) => <td key={item.program.id}>{item.program.universities.map((u) => u.name).join(" + ")}<small>{item.program.city || item.program.universities[0]?.city || "待核验"} · {item.program.campusArea || item.program.universities[0]?.campusArea || "地段待核验"}</small></td>)}</tr>
        <tr><th>项目类型</th>{result.comparisons.map((item) => <td key={item.program.id}>{item.program.categories.map((c) => CATEGORY_LABELS[c]).join("、")}</td>)}</tr>
        <tr><th>核心课程</th>{result.comparisons.map((item) => <td key={item.program.id}>{item.program.coreCourses.length ? item.program.coreCourses.map((course) => course.name).join("、") : "待核验"}</td>)}</tr>
        <tr><th>招生标准</th>{result.comparisons.map((item) => <td key={item.program.id}>{item.program.admissionCriteria.length ? item.program.admissionCriteria.map((criterion) => criterion.title).join("、") : "待核验"}</td>)}</tr>
        <tr><th>所需 / 已有 / 缺失材料</th>{result.comparisons.map((item) => <td key={item.program.id}>所需 {item.requiredMaterials.length} 类 · 已有 {item.readyMaterials.length} 类<small>{item.missingMaterials.length ? `缺少：${item.missingMaterials.map((type) => MATERIAL_TYPE_LABELS[type]).join("、")}` : "无已识别缺口"}</small></td>)}</tr>
        <tr><th>来源 / 最近核验</th>{result.comparisons.map((item) => <td key={item.program.id}>{item.program.sources.map((source) => <a href={source.sourceUrl} target="_blank" rel="noreferrer" key={source.id}>{source.title || "官方来源"} ↗</a>)}{item.program.universities[0]?.livingCostSourceUrl && <a href={item.program.universities[0].livingCostSourceUrl} target="_blank" rel="noreferrer">生活费参考来源 ↗</a>}<small>{item.program.lastFetchedAt ? new Date(item.program.lastFetchedAt).toLocaleString("zh-CN") : "等待首次自动抓取"}</small></td>)}</tr>
        {dimensions.map((dimension) => <tr key={dimension.key}><th>{dimension.label}</th>{result.comparisons.map((item) => { const value=item.dimensions.find((part)=>part.key===dimension.key)!; return <td key={item.program.id}><strong>{value.score}/100</strong><small>{[...value.reasons,...value.missingEvidence].join("；") || "无可比较证据"}</small></td>;})}</tr>)}
      </tbody></table></section>

      <section className="dashboard-panel similar-panel"><div className="panel-heading"><div><span className="panel-label">50% 分类 + 35% 标签 + 15% 学位学制</span><h2>相似项目</h2></div></div><div>{result.recommendations.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{item.universities.join(" + ")} · 相似度 {item.similarity}%</span></div><button type="button" onClick={() => addSimilar(item.id)}>一键加入</button></article>)}</div></section>
    </>}
  </div>;
}
