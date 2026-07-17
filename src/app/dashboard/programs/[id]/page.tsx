"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { addCatalogRefresh, getProgram, getProgramChanges, getUniversities, saveFieldChange, saveProgram } from "@/lib/db";
import { CATEGORY_LABELS, MATERIAL_TYPES, MATERIAL_TYPE_LABELS, type CatalogRefreshResult, type FieldChange, type MaterialType, type Program, type ProgramRequirement, type University } from "@/lib/types";

function fieldValue(program: Program, field: string) {
  if (field === "intakes") return program.intakes.join(", ");
  const value = program[field as keyof Program];
  return typeof value === "string" ? value : "";
}

function applyField(program: Program, field: string, value: string): Program {
  if (field === "intakes") return { ...program, intakes: value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) };
  if (["name", "faculty", "degreeType", "language", "duration", "ects", "mode", "deadline", "tuition", "applicationFee", "applicationPlatform", "premaster", "quota"].includes(field)) {
    return { ...program, [field]: value };
  }
  return program;
}

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [program, setProgram] = useState<Program>();
  const [universities, setUniversities] = useState<University[]>([]);
  const [changes, setChanges] = useState<FieldChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [requirementTitle, setRequirementTitle] = useState("");
  const [requirementType, setRequirementType] = useState<MaterialType>("other");
  const [requirementText, setRequirementText] = useState("");
  const [renderedAt] = useState(Date.now);

  async function load() {
    try {
      const [programValue, universityValues, changeValues] = await Promise.all([getProgram(id), getUniversities(), getProgramChanges(id)]);
      setProgram(programValue);
      setUniversities(universityValues);
      setChanges(changeValues);
    } catch {
      setMessage("读取项目失败，请刷新重试。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([getProgram(id), getUniversities(), getProgramChanges(id)])
      .then(([programValue, universityValues, changeValues]) => {
        if (!active) return;
        setProgram(programValue);
        setUniversities(universityValues);
        setChanges(changeValues);
      })
      .catch(() => { if (active) setMessage("读取项目失败，请刷新重试。"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const institutionNames = useMemo(() => program?.institutionIds.map((institutionId) => universities.find((item) => item.id === institutionId)?.name).filter(Boolean).join(" × ") ?? "", [program, universities]);
  const pendingChanges = changes.filter((item) => item.status === "pending");
  const cooldownRemaining = program?.lastFetchedAt ? 24 * 60 * 60 * 1000 - (renderedAt - Date.parse(program.lastFetchedAt)) : 0;
  const canRefresh = cooldownRemaining <= 0;

  async function handleRefresh() {
    if (!program || !canRefresh) return;
    setRefreshing(true);
    setMessage("正在低频读取官网，请保持页面开启…");
    try {
      const response = await fetch("/api/catalog/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ programId: program.id, universityId: program.institutionIds[0], sourceUrl: program.sourceUrl }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "官网更新失败。");
      const result = payload as CatalogRefreshResult;
      let updatedProgram = { ...program };
      const timestamp = new Date().toISOString();
      const allChanges: FieldChange[] = [];

      for (const item of result.automaticUpdates) {
        const previousValue = fieldValue(updatedProgram, item.field);
        if (!item.proposedValue || item.proposedValue === previousValue) continue;
        updatedProgram = applyField(updatedProgram, item.field, item.proposedValue);
        allChanges.push({ ...item, id: crypto.randomUUID(), programId: program.id, previousValue, status: "applied", createdAt: timestamp });
      }
      for (const item of result.reviewItems) {
        allChanges.push({ ...item, id: crypto.randomUUID(), programId: program.id, previousValue: fieldValue(updatedProgram, item.field), status: "pending", createdAt: timestamp });
      }
      updatedProgram = { ...updatedProgram, lastFetchedAt: timestamp, updatedAt: timestamp };
      await addCatalogRefresh(updatedProgram, { ...result.snapshot, id: crypto.randomUUID(), programId: program.id }, allChanges);
      setProgram(updatedProgram);
      setMessage(`${allChanges.filter((item) => item.status === "applied").length} 项基础信息已更新，${allChanges.filter((item) => item.status === "pending").length} 项等待审核。${result.warnings.join(" ")}`);
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "官网更新失败。");
    } finally {
      setRefreshing(false);
    }
  }

  async function decideChange(change: FieldChange, accept: boolean) {
    if (!program) return;
    let updatedProgram = program;
    if (accept) {
      if (change.field === "requirements") {
        const requirement: ProgramRequirement = {
          id: crypto.randomUUID(), category: "官网要求", materialType: "other", required: true,
          title: "官网申请要求", originalText: change.proposedValue, structuredRequirement: "待进一步拆分",
          intake: program.intakes.join(", "), sourceUrl: change.sourceUrl, fetchedAt: change.createdAt,
          verificationState: "confirmed", confidence: change.confidence,
        };
        updatedProgram = { ...program, requirements: [...program.requirements, requirement] };
      } else {
        updatedProgram = applyField(program, change.field, change.proposedValue);
      }
      await saveProgram(updatedProgram);
      setProgram(updatedProgram);
    }
    await saveFieldChange({ ...change, status: accept ? "accepted" : "rejected" });
    setChanges((current) => current.map((item) => item.id === change.id ? { ...item, status: accept ? "accepted" : "rejected" } : item));
    setMessage(accept ? "变更已确认并写入项目。" : "该变更已忽略。");
  }

  async function addRequirement(event: React.FormEvent) {
    event.preventDefault();
    if (!program || !requirementTitle.trim()) return;
    const requirement: ProgramRequirement = {
      id: crypto.randomUUID(), category: "手动录入", materialType: requirementType, required: true,
      title: requirementTitle.trim(), originalText: requirementText.trim(), structuredRequirement: requirementText.trim(),
      intake: program.intakes.join(", "), sourceUrl: program.sourceUrl, verificationState: "manual",
    };
    const updatedProgram = { ...program, requirements: [...program.requirements, requirement] };
    await saveProgram(updatedProgram);
    setProgram(updatedProgram);
    setRequirementTitle("");
    setRequirementText("");
    setMessage("申请要求已添加。");
  }

  async function removeRequirement(requirementId: string) {
    if (!program) return;
    const updatedProgram = { ...program, requirements: program.requirements.filter((item) => item.id !== requirementId) };
    await saveProgram(updatedProgram);
    setProgram(updatedProgram);
  }

  if (loading) return <div className="dashboard-content"><div className="empty-state">正在读取项目…</div></div>;
  if (!program) return <div className="dashboard-content"><div className="empty-state"><strong>找不到这个项目</strong><Link href="/dashboard/programs">返回项目目录</Link></div></div>;

  return (
    <div className="dashboard-content content-narrow">
      <Link className="back-link" href="/dashboard/programs">← 返回项目目录</Link>
      <header className="program-hero">
        <div>
          <div className="tag-row">{program.categories.map((item) => <span key={item}>{CATEGORY_LABELS[item]}</span>)}</div>
          <h1>{program.name}</h1>
          <p>{institutionNames}</p>
        </div>
        <div className="program-hero-actions">
          <a className="button button-outline" href={program.sourceUrl} target="_blank" rel="noreferrer">打开官网 ↗</a>
          <button className="button button-primary" type="button" disabled={refreshing || !canRefresh} onClick={handleRefresh}>{refreshing ? "更新中…" : canRefresh ? "更新官网数据" : "24 小时内已更新"}</button>
        </div>
      </header>
      {message && <div className="notice" role="status">{message}</div>}

      <section className="detail-facts">
        {[ ["学位", program.degreeType], ["语言", program.language], ["学制", program.duration], ["学分", program.ects], ["授课方式", program.mode], ["入学时间", program.intakes.join("、")], ["截止日期", program.deadline], ["学费", program.tuition] ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || "待更新"}</strong></div>)}
      </section>

      {pendingChanges.length > 0 && (
        <section className="dashboard-panel review-panel">
          <div className="panel-heading"><div><span className="panel-label">需要人工确认</span><h2>官网高风险字段变更</h2></div><span className="zero-state-tag">{pendingChanges.length} 项</span></div>
          <div className="review-list">{pendingChanges.map((change) => <article key={change.id}><div><strong>{change.label}</strong><p>{change.proposedValue}</p><small>来源置信度 {Math.round(change.confidence * 100)}% · {change.sourceUrl}</small></div><div><button type="button" onClick={() => decideChange(change, false)}>忽略</button><button className="accept" type="button" onClick={() => decideChange(change, true)}>确认写入</button></div></article>)}</div>
        </section>
      )}

      <section className="dashboard-panel requirements-panel">
        <div className="panel-heading"><div><span className="panel-label">结构化记录</span><h2>申请要求</h2></div><span className="zero-state-tag">{program.requirements.length} 条</span></div>
        {program.requirements.length ? <div className="requirement-list">{program.requirements.map((item) => <article key={item.id}><span className={item.required ? "required-dot" : "optional-dot"} /><div><strong>{item.title}</strong><p>{item.originalText || item.structuredRequirement || "未填写说明"}</p><small>{MATERIAL_TYPE_LABELS[item.materialType]} · {item.verificationState === "confirmed" ? "已确认" : item.verificationState === "manual" ? "手动录入" : "待确认"}</small></div><button type="button" onClick={() => removeRequirement(item.id)}>删除</button></article>)}</div> : <p className="empty-inline">尚无申请要求。可以手动添加，或更新官网数据后审核导入。</p>}
        <form className="inline-add-form" onSubmit={addRequirement}>
          <label>要求名称<input value={requirementTitle} placeholder="例如 成绩单" onChange={(event) => setRequirementTitle(event.target.value)} /></label>
          <label>材料类型<select value={requirementType} onChange={(event) => setRequirementType(event.target.value as MaterialType)}>{MATERIAL_TYPES.map((type) => <option value={type} key={type}>{MATERIAL_TYPE_LABELS[type]}</option>)}</select></label>
          <label className="full-field">要求说明<textarea rows={3} value={requirementText} onChange={(event) => setRequirementText(event.target.value)} /></label>
          <button className="button button-primary" type="submit">添加要求</button>
        </form>
      </section>

      <section className="create-application-banner">
        <div><span className="panel-label">下一步</span><h2>为这个项目建立申请工作区</h2><p>当前要求会被复制为独立快照，之后官网更新不会覆盖它。</p></div>
        <Link className="button button-primary" href={`/dashboard/applications?program=${program.id}`}>创建申请 →</Link>
      </section>
    </div>
  );
}
