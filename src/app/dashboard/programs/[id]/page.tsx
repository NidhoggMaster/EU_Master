"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getProgram, saveProgram } from "@/lib/catalog-client";
import { CATEGORY_LABELS, MATERIAL_TYPES, MATERIAL_TYPE_LABELS, type FieldChange, type MaterialType, type ProgramDetail, type ProgramRequirement } from "@/lib/types";

export default function ProgramDetailPage() {
  const id = String(useParams<{ id: string }>().id);
  const [program, setProgram] = useState<ProgramDetail>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [requirementTitle, setRequirementTitle] = useState("");
  const [requirementText, setRequirementText] = useState("");
  const [requirementType, setRequirementType] = useState<MaterialType>("transcript");

  useEffect(() => {
    getProgram(id).then(setProgram).catch((error) => setMessage(error instanceof Error ? error.message : "读取项目失败。")).finally(() => setLoading(false));
  }, [id]);

  async function refresh() {
    setRefreshing(true); setMessage("");
    try {
      const response = await fetch(`/api/catalog/programs/${encodeURIComponent(id)}/refresh`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "更新失败。");
      setProgram(body.program); setMessage(`官网数据已通过 ${body.provider === "firecrawl" ? "Firecrawl" : "合规直连回退"} 更新；${body.reviewItems.length} 项关键变更等待审核。${body.warnings?.[0] ? ` ${body.warnings[0]}` : ""}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "更新失败。"); }
    finally { setRefreshing(false); }
  }

  async function decide(change: FieldChange, decision: "accepted" | "rejected") {
    const response = await fetch(`/api/catalog/programs/${id}/changes/${change.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }) });
    const body = await response.json();
    if (!response.ok) { setMessage(body.error || "审核失败。"); return; }
    setProgram(body); setMessage(decision === "accepted" ? "变更已确认写入。" : "变更已拒绝并保留审计记录。");
  }

  async function addRequirement(event: React.FormEvent) {
    event.preventDefault(); if (!program || !requirementTitle.trim()) return;
    const requirement: ProgramRequirement = { id: crypto.randomUUID(), category: "手动录入", materialType: requirementType, required: true, title: requirementTitle.trim(), originalText: requirementText.trim(), structuredRequirement: requirementText.trim(), intake: program.intakes.join(", "), sourceUrl: program.sourceUrl, verificationState: "manual" };
    const saved = await saveProgram({ ...program, requirements: [...program.requirements, requirement] });
    setProgram(saved); setRequirementTitle(""); setRequirementText(""); setMessage("申请要求已保存到项目库。");
  }

  if (loading) return <div className="dashboard-content"><div className="empty-state">正在从项目库读取…</div></div>;
  if (!program) return <div className="dashboard-content"><div className="empty-state"><strong>找不到这个项目</strong><Link href="/dashboard/programs">返回项目目录</Link></div></div>;
  const university = program.universities[0];

  return <div className="dashboard-content content-narrow">
    <Link className="back-link" href="/dashboard/programs">← 返回项目目录</Link>
    <header className="program-hero"><div><div className="tag-row">{program.categories.map((item) => <span key={item}>{CATEGORY_LABELS[item]}</span>)}</div><h1>{program.name}</h1><p>{program.universities.map((item) => item.name).join(" + ")}</p></div><div className="program-hero-actions"><a className="button button-outline" href={program.sourceUrl} target="_blank" rel="noreferrer">打开官网 ↗</a><button className="button button-primary" type="button" disabled={refreshing} onClick={refresh}>{refreshing ? "更新中…" : "手动更新官网数据"}</button></div></header>
    {message && <div className="notice" role="status">{message}</div>}

    <section className="detail-facts">{[
      ["学校 / 城市", `${program.universities.map((item) => item.shortName).join(" + ")} · ${program.city || university?.city || "待核验"}`], ["校区 / 地段", program.campusArea || university?.campusArea || "待核验"],
      ["学位", program.degreeType], ["语言", program.language], ["学制 / 学分", [program.duration, program.ects].filter(Boolean).join(" · ")], ["入学时间", program.intakes.join("、")],
      ["截止日期", program.deadline], ["学费", program.tuitionEur == null ? program.tuition : `€${program.tuitionEur.toLocaleString()} ${program.tuitionAcademicYear}`], ["生活费参考", university?.livingCostMonthlyMinEur == null ? "" : `€${university.livingCostMonthlyMinEur.toLocaleString()}–€${university.livingCostMonthlyMaxEur?.toLocaleString()} / 月`],
    ].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value || "待核验"}</strong></div>)}</section>

    {program.pendingChanges.length > 0 && <section className="dashboard-panel review-panel"><div className="panel-heading"><div><span className="panel-label">人工审核闸门</span><h2>关键字段变化</h2></div><span className="zero-state-tag">{program.pendingChanges.length} 项</span></div><div className="review-list">{program.pendingChanges.map((change) => <article key={change.id}><div><strong>{change.label}</strong><p>{change.proposedValue}</p><small>来源置信度 {Math.round(change.confidence * 100)}% · {change.sourceUrl}</small></div><div><button type="button" onClick={() => decide(change,"rejected")}>拒绝</button><button className="accept" type="button" onClick={() => decide(change,"accepted")}>确认写入</button></div></article>)}</div></section>}

    <div className="detail-two-column">
      <section className="dashboard-panel"><div className="panel-heading"><div><span className="panel-label">官网课程结构</span><h2>核心课程</h2></div><span className="zero-state-tag">{program.coreCourses.length}</span></div>{program.coreCourses.length ? <div className="fact-list">{program.coreCourses.map((course) => <article key={course.name}><strong>{course.name}</strong><small>{course.tags.join(" · ") || "尚未标注"}</small></article>)}</div> : <p className="empty-inline">暂无可靠官网课程字段，保持“待核验”。</p>}</section>
      <section className="dashboard-panel"><div className="panel-heading"><div><span className="panel-label">仅引用明确条件</span><h2>招生标准</h2></div><span className="zero-state-tag">{program.admissionCriteria.length}</span></div>{program.admissionCriteria.length ? <div className="fact-list">{program.admissionCriteria.map((criterion) => <article key={criterion.id}><strong>{criterion.title}</strong><p>{criterion.description}</p><small>{criterion.verificationState === "confirmed" ? "已核验" : "待核验"}</small></article>)}</div> : <p className="empty-inline">官网招生条件尚未结构化，匹配评分会按缺失证据计 0 并明确提示。</p>}</section>
    </div>

    <section className="dashboard-panel requirements-panel"><div className="panel-heading"><div><span className="panel-label">所需文件</span><h2>申请材料要求</h2></div><span className="zero-state-tag">{program.requirements.length} 条</span></div>{program.requirements.length ? <div className="requirement-list">{program.requirements.map((item) => <article key={item.id}><span className={item.required ? "required-dot" : "optional-dot"}/><div><strong>{item.title}</strong><p>{item.originalText || item.structuredRequirement || "未填写说明"}</p><small>{MATERIAL_TYPE_LABELS[item.materialType]} · {item.verificationState === "confirmed" ? "已核验" : item.verificationState === "manual" ? "手动录入" : "待审核"}</small></div></article>)}</div> : <p className="empty-inline">尚无已核验材料要求。</p>}<form className="inline-add-form" onSubmit={addRequirement}><label>要求名称<input value={requirementTitle} onChange={(event) => setRequirementTitle(event.target.value)} /></label><label>材料类型<select value={requirementType} onChange={(event) => setRequirementType(event.target.value as MaterialType)}>{MATERIAL_TYPES.map((type) => <option value={type} key={type}>{MATERIAL_TYPE_LABELS[type]}</option>)}</select></label><label className="full-field">说明<textarea rows={3} value={requirementText} onChange={(event) => setRequirementText(event.target.value)} /></label><button className="button button-primary" type="submit">添加要求</button></form></section>

    <section className="dashboard-panel source-panel"><div className="panel-heading"><div><span className="panel-label">字段级溯源</span><h2>官方来源与核验状态</h2></div><span className="zero-state-tag">完整度 {program.dataCompleteness}%</span></div><div className="source-list">{program.sources.map((source) => <a href={source.sourceUrl} target="_blank" rel="noreferrer" key={source.id}><strong>{source.title || "官方项目页"}</strong><span>{source.provider} · {source.fetchedAt ? new Date(source.fetchedAt).toLocaleString("zh-CN") : "等待首次抓取"} · {source.verificationState}</span></a>)}{university?.livingCostSourceUrl && <a href={university.livingCostSourceUrl} target="_blank" rel="noreferrer"><strong>生活费参考来源</strong><span>Study in NL · 全国区间；具体城市可能更高或更低</span></a>}</div></section>
    <section className="create-application-banner"><div><span className="panel-label">下一步</span><h2>建立申请或加入项目对比</h2><p>匹配度是透明参考分，不代表录取概率。</p></div><div className="program-hero-actions"><Link className="button button-outline" href={`/dashboard/programs/compare?ids=${program.id}`}>加入对比</Link><Link className="button button-primary" href={`/dashboard/applications?program=${program.id}`}>创建申请 →</Link></div></section>
  </div>;
}
