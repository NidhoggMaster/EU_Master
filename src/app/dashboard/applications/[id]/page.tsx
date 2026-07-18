"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getProgram } from "@/lib/catalog-client";
import { applicationProgress } from "@/lib/progress";
import { MATERIAL_TYPE_LABELS, type Application, type Material, type Program } from "@/lib/types";
import { getApplication, getMaterials, saveApplication } from "@/lib/workspace-client";

const statusLabels: Record<Application["status"], string> = {
  planning: "规划中", preparing: "准备中", submitted: "已提交", offer: "已录取", rejected: "未录取", withdrawn: "已撤回",
};

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<Application>();
  const [program, setProgram] = useState<Program>();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApplication(id).then(async (value) => {
      setApplication(value);
      if (value) setProgram(await getProgram(value.programId));
      setMaterials(await getMaterials());
    }).catch(() => setMessage("读取申请失败。")).finally(() => setLoading(false));
  }, [id]);

  async function update(next: Application, successMessage?: string) {
    await saveApplication(next);
    setApplication({ ...next, updatedAt: new Date().toISOString() });
    if (successMessage) setMessage(successMessage);
  }

  async function linkMaterial(requirementId: string, materialId: string) {
    if (!application) return;
    await update({ ...application, requirements: application.requirements.map((item) => item.id === requirementId ? { ...item, materialId, satisfied: Boolean(materialId) } : item) }, materialId ? "材料已关联。" : "材料关联已移除。");
  }

  async function toggleRequirement(requirementId: string) {
    if (!application) return;
    await update({ ...application, requirements: application.requirements.map((item) => item.id === requirementId ? { ...item, satisfied: !item.satisfied } : item) });
  }

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!application || !taskTitle.trim()) return;
    await update({ ...application, tasks: [...application.tasks, { id: crypto.randomUUID(), title: taskTitle.trim(), dueDate: taskDueDate, completed: false, createdAt: new Date().toISOString() }] }, "任务已添加。");
    setTaskTitle(""); setTaskDueDate("");
  }

  async function toggleTask(taskId: string) {
    if (!application) return;
    await update({ ...application, tasks: application.tasks.map((item) => item.id === taskId ? { ...item, completed: !item.completed } : item) });
  }

  async function syncRequirements() {
    if (!application || !program) return;
    const existingIds = new Set(application.requirements.map((item) => item.sourceRequirementId));
    const additions = program.requirements.filter((item) => !existingIds.has(item.id)).map((item) => ({ id: crypto.randomUUID(), sourceRequirementId: item.id, title: item.title, materialType: item.materialType, required: item.required, originalText: item.originalText, materialId: "", satisfied: false }));
    await update({ ...application, requirements: [...application.requirements, ...additions], requirementsSourceUpdatedAt: program.updatedAt }, additions.length ? `已同步 ${additions.length} 条新增要求。` : "没有新的申请要求。" );
  }

  if (loading) return <div className="dashboard-content"><div className="empty-state">正在读取申请…</div></div>;
  if (!application) return <div className="dashboard-content"><div className="empty-state"><strong>找不到这份申请</strong><Link href="/dashboard/applications">返回申请列表</Link></div></div>;

  const progress = applicationProgress(application);
  const sourceChanged = Boolean(program && program.updatedAt > application.requirementsSourceUpdatedAt);

  return (
    <div className="dashboard-content content-narrow">
      <Link className="back-link" href="/dashboard/applications">← 返回申请列表</Link>
      <header className="application-hero">
        <div><span className="dashboard-date">{application.intake || "未设置入学批次"}</span><h1>{application.programName}</h1><p>{application.deadline ? `申请截止：${new Date(`${application.deadline}T00:00:00`).toLocaleDateString("zh-CN")}` : "尚未设置截止日期"}</p></div>
        <div className="application-hero-progress"><strong>{progress}%</strong><span>材料要求已满足</span></div>
      </header>
      {message && <div className="notice">{message}</div>}
      {sourceChanged && <div className="notice notice-warning"><span>项目要求已有更新，当前申请仍保留原快照。</span><button type="button" onClick={syncRequirements}>审核并同步新增项</button></div>}

      <section className="application-controls">
        <label>申请状态<select value={application.status} onChange={(event) => update({ ...application, status: event.target.value as Application["status"] }, "申请状态已更新。")}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>截止日期<input type="date" value={application.deadline} onChange={(event) => update({ ...application, deadline: event.target.value })} /></label>
      </section>

      <section className="dashboard-panel">
        <div className="panel-heading"><div><span className="panel-label">要求快照</span><h2>材料清单</h2></div><span className="zero-state-tag">{application.requirements.filter((item) => item.satisfied).length} / {application.requirements.length}</span></div>
        {application.requirements.length ? <div className="application-requirements">{application.requirements.map((requirement) => {
          const compatible = materials.filter((item) => item.type === requirement.materialType);
          return <article className={requirement.satisfied ? "complete" : ""} key={requirement.id}><button className="check-button" type="button" aria-label={requirement.satisfied ? "标记为未完成" : "标记为已完成"} onClick={() => toggleRequirement(requirement.id)}>{requirement.satisfied ? "✓" : ""}</button><div><strong>{requirement.title}{requirement.required && <em>必需</em>}</strong><p>{requirement.originalText || MATERIAL_TYPE_LABELS[requirement.materialType]}</p></div><label>关联材料<select value={requirement.materialId} onChange={(event) => linkMaterial(requirement.id, event.target.value)}><option value="">尚未关联</option>{compatible.map((material) => <option value={material.id} key={material.id}>{material.title} · {material.status === "ready" ? "可提交" : "准备中"}</option>)}</select></label></article>;
        })}</div> : <p className="empty-inline">创建申请时项目还没有结构化要求。可以回到项目详情添加要求后再同步。</p>}
      </section>

      <section className="dashboard-panel task-panel">
        <div className="panel-heading"><div><span className="panel-label">行动计划</span><h2>申请任务</h2></div><span className="zero-state-tag">{application.tasks.filter((item) => !item.completed).length} 待办</span></div>
        <div className="task-list">{application.tasks.map((task) => <label className={task.completed ? "complete" : ""} key={task.id}><input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} /><span><strong>{task.title}</strong><small>{task.dueDate ? `截止 ${new Date(`${task.dueDate}T00:00:00`).toLocaleDateString("zh-CN")}` : "未设置日期"}</small></span></label>)}</div>
        <form className="task-form" onSubmit={addTask}><label>任务名称<input value={taskTitle} placeholder="例如 完成动机信初稿" onChange={(event) => setTaskTitle(event.target.value)} /></label><label>截止日期<input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} /></label><button className="button button-primary" type="submit">添加任务</button></form>
      </section>
    </div>
  );
}
