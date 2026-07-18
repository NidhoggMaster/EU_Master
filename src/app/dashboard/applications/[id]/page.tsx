"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { getProgram } from "@/lib/catalog-client";
import { applicationProgress } from "@/lib/progress";
import { MATERIAL_TYPE_LABELS, type Application, type Material, type MatchDimensionScore, type ProgramDetail, type ScoreSnapshot } from "@/lib/types";
import { getApplication, getMaterials, saveApplication } from "@/lib/workspace-client";

const statusLabels: Record<Application["status"], string> = {
  planning: "规划中", preparing: "准备中", submitted: "已提交", offer: "已录取", rejected: "未录取", withdrawn: "已撤回",
};

interface ApplicationScore {
  score: number | null;
  evidenceCoverage: number;
  readiness: number;
  probabilityMinimum: number | null;
  probabilityMaximum: number | null;
  hardRisks: string[];
  dimensions: MatchDimensionScore[];
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<Application>();
  const [program, setProgram] = useState<ProgramDetail>();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [score, setScore] = useState<ApplicationScore>();
  const [latestScore, setLatestScore] = useState<ScoreSnapshot>();
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    getApplication(id).then(async (value) => {
      setApplication(value);
      const [programValue, materialValues, scoreResponse] = await Promise.all([
        getProgram(value.programId), getMaterials(), fetch(`/api/applications/${id}/score`, { cache: "no-store" }),
      ]);
      setProgram(programValue);
      setMaterials(materialValues);
      if (scoreResponse.ok) {
        const body = await scoreResponse.json();
        setScore(body.preview);
        setLatestScore(body.latest);
      }
    }).catch((reason) => setMessage(reason instanceof Error ? reason.message : "读取申请失败。"))
      .finally(() => setLoading(false));
  }, [id]);

  async function update(next: Application, successMessage?: string) {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    const saved = await saveApplication(stamped);
    setApplication(saved);
    if (successMessage) setMessage(successMessage);
  }

  async function linkMaterial(requirementId: string, materialId: string) {
    if (!application) return;
    const material = materials.find((item) => item.id === materialId);
    await update({ ...application, requirements: application.requirements.map((item) => item.id === requirementId ? { ...item, materialId, satisfied: Boolean(material && (material.prepared || material.status === "ready")) } : item) }, materialId ? "材料已关联。" : "材料关联已移除。");
  }

  async function toggleRequirement(requirementId: string) {
    if (!application) return;
    await update({ ...application, requirements: application.requirements.map((item) => item.id === requirementId ? { ...item, satisfied: !item.satisfied } : item) });
  }

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!application || !taskTitle.trim()) return;
    await update({ ...application, tasks: [...application.tasks, { id: crypto.randomUUID(), title: taskTitle.trim(), dueDate: taskDueDate, completed: false, createdAt: new Date().toISOString() }] }, "任务已添加。");
    setTaskTitle("");
    setTaskDueDate("");
  }

  async function toggleTask(taskId: string) {
    if (!application) return;
    await update({ ...application, tasks: application.tasks.map((item) => item.id === taskId ? { ...item, completed: !item.completed } : item) });
  }

  async function syncRequirements() {
    if (!application || !program) return;
    const existingIds = new Set(application.requirements.map((item) => item.sourceRequirementId));
    const additions = program.requirements.filter((item) => !existingIds.has(item.id)).map((item) => ({
      id: crypto.randomUUID(), sourceRequirementId: item.id, title: item.title, materialType: item.materialType,
      required: item.required, originalText: item.originalText, materialId: "", satisfied: false,
    }));
    await update({ ...application, requirements: [...application.requirements, ...additions], requirementsSourceUpdatedAt: program.updatedAt }, additions.length ? `已追加 ${additions.length} 条新要求；原快照未改动。` : "没有新的申请要求。");
  }

  async function confirmScore() {
    setCalculating(true);
    try {
      const response = await fetch(`/api/applications/${id}/score`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "评分失败。");
      setScore(body);
      setLatestScore(body.snapshot);
      if (application) await update({ ...application, scoreSnapshotId: body.snapshot.id }, "申请评分已按当前档案、材料和要求确认。");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "评分失败。");
    } finally {
      setCalculating(false);
    }
  }

  if (loading) return <div className="dashboard-content"><div className="empty-state">正在读取申请…</div></div>;
  if (!application) return <div className="dashboard-content"><div className="empty-state"><strong>找不到这份申请</strong><Link href="/dashboard/applications">返回申请列表</Link></div></div>;

  const progress = applicationProgress(application);
  const sourceChanged = Boolean(program && program.updatedAt > application.requirementsSourceUpdatedAt);
  const materialUpdatedAt = materials.map((item) => item.updatedAt).sort().at(-1) ?? "";
  const currentScoreStale = Boolean(latestScore && program && (latestScore.programUpdatedAt !== program.updatedAt || latestScore.materialUpdatedAt !== materialUpdatedAt));

  return <div className="dashboard-content application-detail-page">
    <Link className="back-link" href="/dashboard/applications"><ArrowLeft size={15} aria-hidden="true" />申请列表</Link>
    <header className="application-hero">
      <div><span className="dashboard-date">{application.intake || "未设置入学批次"}</span><h1>{application.programName}</h1><p>{application.startDate || "开放日期未定"} 至 {application.endDate || application.deadline || "截止日期未定"}</p></div>
      <div className="application-hero-progress"><strong>{score?.readiness ?? progress}%</strong><span>申请准备度</span></div>
    </header>
    {message && <div className="notice" role="status">{message}</div>}
    {sourceChanged && <div className="notice notice-warning"><span>项目官网要求已有更新，当前申请仍保留原快照。</span><button type="button" onClick={syncRequirements}>仅追加新要求</button></div>}

    <section className="application-controls">
      <label>申请状态<select value={application.status} onChange={(event) => update({ ...application, status: event.target.value as Application["status"] }, "申请状态已更新。")}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>申请开放<input type="date" value={application.startDate ?? ""} onChange={(event) => update({ ...application, startDate: event.target.value })} /></label>
      <label>申请截止<input type="date" value={application.endDate ?? application.deadline} onChange={(event) => update({ ...application, endDate: event.target.value, deadline: event.target.value })} /></label>
      <label>Studielink 链接<input type="url" value={application.studielinkUrl ?? ""} onChange={(event) => update({ ...application, studielinkUrl: event.target.value })} /></label>
      {application.studielinkUrl && <a className="button button-outline" href={application.studielinkUrl} target="_blank" rel="noreferrer">打开 Studielink<ExternalLink size={14} aria-hidden="true" /></a>}
    </section>

    <section className="dashboard-panel application-score-panel">
      <div className="panel-heading"><div><span className="panel-label">版本化评分</span><h2>背景适配度 <em className="ai-beta-tag">AI Beta</em> 与准备度</h2></div><button className="button button-primary" type="button" disabled={calculating} onClick={confirmScore}><RefreshCw size={15} aria-hidden="true" />{calculating ? "计算中" : "确认计算"}</button></div>
      <p className="ai-beta-note">AI Beta 仅依据本机结构化背景、材料状态与已确认官网条件辅助比较，不代表学校审核或录取结果。</p>
      {score ? <div className="application-score-layout"><div className="score-summary"><div><span>背景适配度</span><strong>{score.score == null ? "--" : Math.round(score.score)}</strong><small>{score.score == null ? `证据覆盖 ${score.evidenceCoverage}%，暂不输出总分` : `证据覆盖 ${score.evidenceCoverage}%`}</small></div><div><span>准备度</span><strong>{score.readiness}%</strong><small>基本材料 60% · 特需 30% · 任务 10%</small></div>{score.probabilityMinimum != null && score.probabilityMaximum != null ? <div><span>录取概率区间</span><strong>{score.probabilityMinimum}–{score.probabilityMaximum}%</strong><small>基于带来源基础概率</small></div> : <div><span>录取概率</span><strong>--</strong><small>未设置带来源的基础概率</small></div>}</div><div className="score-dimension-list">{score.dimensions.filter((dimension) => dimension.weight > 0).map((dimension) => <div key={dimension.key}><span>{dimension.label}<small>权重 {dimension.weight}%</small></span><div><i style={{ width: `${dimension.known ? dimension.score : 0}%` }} /></div><strong>{dimension.known ? dimension.score : "--"}</strong></div>)}</div></div> : <p className="empty-inline">尚未形成评分快照。</p>}
      {score?.hardRisks.length ? <div className="risk-box"><strong>硬条件风险</strong>{score.hardRisks.map((risk) => <span key={risk}>{risk}</span>)}</div> : null}
      {latestScore && <p className={`score-snapshot-meta ${currentScoreStale ? "stale" : ""}`}>{currentScoreStale ? "当前快照已过期，需要重新确认。" : `最近确认：${new Date(latestScore.confirmedAt).toLocaleString("zh-CN")} · ${latestScore.weightsVersion}`}</p>}
    </section>

    <section className="dashboard-panel">
      <div className="panel-heading"><div><span className="panel-label">创建时要求快照</span><h2>申请材料</h2></div><span className="zero-state-tag">{application.requirements.filter((item) => item.satisfied).length} / {application.requirements.length}</span></div>
      {application.requirements.length ? <div className="application-requirements">{application.requirements.map((requirement) => {
        const compatible = materials.filter((item) => item.type === requirement.materialType && (item.scope === "basic" || item.programId === application.programId));
        return <article className={requirement.satisfied ? "complete" : ""} key={requirement.id}><button className="check-button" type="button" aria-label={requirement.satisfied ? "标记为未完成" : "标记为已完成"} onClick={() => toggleRequirement(requirement.id)}>{requirement.satisfied ? "✓" : ""}</button><div><strong>{requirement.title}{requirement.required && <em>必需</em>}</strong><p>{requirement.originalText || MATERIAL_TYPE_LABELS[requirement.materialType]}</p></div><label>关联材料<select value={requirement.materialId} onChange={(event) => linkMaterial(requirement.id, event.target.value)}><option value="">尚未关联</option>{compatible.map((material) => <option value={material.id} key={material.id}>{material.title} · {material.prepared ? "已准备" : "准备中"}{material.currentVersionId ? " · 有文件" : " · 无文件"}</option>)}</select></label></article>;
      })}</div> : <p className="empty-inline">创建申请时项目尚无结构化材料要求。</p>}
    </section>

    <section className="dashboard-panel task-panel">
      <div className="panel-heading"><div><span className="panel-label">行动计划</span><h2>申请任务</h2></div><span className="zero-state-tag">{application.tasks.filter((item) => !item.completed).length} 待办</span></div>
      <div className="task-list">{application.tasks.map((task) => <label className={task.completed ? "complete" : ""} key={task.id}><input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} /><span><strong>{task.title}</strong><small>{task.dueDate ? `截止 ${new Date(`${task.dueDate}T00:00:00`).toLocaleDateString("zh-CN")}` : "未设置日期"}</small></span></label>)}</div>
      <form className="task-form" onSubmit={addTask}><label>任务名称<input value={taskTitle} placeholder="例如 完成动机信初稿" onChange={(event) => setTaskTitle(event.target.value)} /></label><label>截止日期<input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} /></label><button className="button button-primary" type="submit">添加任务</button></form>
    </section>
  </div>;
}
