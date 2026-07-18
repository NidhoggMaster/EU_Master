"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { getPrograms } from "@/lib/catalog-client";
import { applicationProgress } from "@/lib/progress";
import type { Application, Material, Program } from "@/lib/types";
import { useLocalQuery } from "@/lib/use-local-query";
import { deleteApplication, getApplications, getMaterials, saveApplication } from "@/lib/workspace-client";

interface ApplicationScorePreview {
  score: number | null;
  evidenceCoverage: number;
  readiness: number;
  probabilityMinimum: number | null;
  probabilityMaximum: number | null;
  hardRisks: string[];
}

async function loadApplications() {
  const [applications, programs, materials] = await Promise.all([getApplications(), getPrograms(), getMaterials()]);
  const scoreEntries = await Promise.all(applications.map(async (application) => {
    try {
      const response = await fetch(`/api/applications/${application.id}/score`, { cache: "no-store" });
      if (!response.ok) return [application.id, undefined] as const;
      const body = await response.json();
      return [application.id, body.preview as ApplicationScorePreview] as const;
    } catch {
      return [application.id, undefined] as const;
    }
  }));
  return { applications, programs, materials, scores: Object.fromEntries(scoreEntries) as Record<string, ApplicationScorePreview | undefined> };
}

const statusLabels: Record<Application["status"], string> = {
  planning: "规划中", preparing: "准备中", submitted: "已提交", offer: "已录取", rejected: "未录取", withdrawn: "已撤回",
};
const deletableStatuses = new Set<Application["status"]>(["planning", "preparing"]);

export default function ApplicationsPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useLocalQuery("applications", loadApplications, {
    applications: [] as Application[], programs: [] as Program[], materials: [] as Material[], scores: {} as Record<string, ApplicationScorePreview | undefined>,
  });
  const [programId, setProgramId] = useState("");
  const [intake, setIntake] = useState("2027 September");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string>();

  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("program");
    if (selected) Promise.resolve(selected).then(setProgramId);
  }, []);

  function selectProgram(id: string) {
    setProgramId(id);
    const program = data.programs.find((item) => item.id === id);
    if (!program) return;
    if (program.intakes[0]) setIntake(program.intakes[0]);
    const opening = program.applicationDates.find((item) => item.kind === "application_open" && item.audience !== "eu");
    const closing = program.applicationDates.find((item) => item.kind === "deadline" && item.audience !== "eu");
    setStartDate(opening?.date && /^\d{4}-\d{2}-\d{2}$/.test(opening.date) ? opening.date : "");
    setDeadline(closing?.date && /^\d{4}-\d{2}-\d{2}$/.test(closing.date) ? closing.date : /^\d{4}-\d{2}-\d{2}$/.test(program.deadline) ? program.deadline : "");
  }

  async function createApplication(event: React.FormEvent) {
    event.preventDefault();
    const program = data.programs.find((item) => item.id === programId);
    if (!program) {
      setMessage("请先选择一个项目。");
      return;
    }
    const timestamp = new Date().toISOString();
    const requirements = program.requirements.map((requirement) => {
      const matched = data.materials.find((material) => material.type === requirement.materialType && (material.prepared || material.status === "ready") && (material.scope === "basic" || material.programId === program.id));
      return {
        id: crypto.randomUUID(), sourceRequirementId: requirement.id, title: requirement.title,
        materialType: requirement.materialType, required: requirement.required, originalText: requirement.originalText,
        materialId: matched?.id ?? "", satisfied: Boolean(matched),
      };
    });
    const application: Application = {
      id: crypto.randomUUID(), programId: program.id, programName: program.name, intake: intake.trim(), deadline,
      startDate, endDate: deadline, studielinkUrl: program.applicationLinks.studielinkUrl || "https://www.studielink.nl/",
      status: "planning", requirements,
      tasks: requirements.filter((item) => item.required && !item.satisfied).map((item) => ({ id: crypto.randomUUID(), title: `准备：${item.title}`, dueDate: deadline, completed: false, createdAt: timestamp })),
      requirementsSourceUpdatedAt: program.updatedAt, createdAt: timestamp, updatedAt: timestamp,
    };
    try {
      await saveApplication(application);
      router.push(`/dashboard/applications/${application.id}`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "创建申请失败。");
    }
  }

  async function removeApplication(application: Application) {
    try {
      await deleteApplication(application.id);
      setPendingDeleteId(undefined);
      setMessage(`已删除“${application.programName}”的申请工作区。`);
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "删除申请失败。");
    }
  }

  return <div className="dashboard-content applications-page">
    <header className="page-heading"><div><span className="dashboard-date">项目要求快照 · 本机存储</span><h1>项目申请</h1><p>每份申请独立保存材料、任务、竞争力和准备度。</p></div><span className="count-badge">{data.applications.length} 份申请</span></header>
    {(message || error) && <div className={`notice ${error ? "notice-error" : ""}`} role="status">{error || message}</div>}

    <section className="create-application-panel">
      <div><span className="panel-label">新建申请</span><h2>从项目目录建立工作区</h2></div>
      <form onSubmit={createApplication}>
        <label>目标项目<select required value={programId} onChange={(event) => selectProgram(event.target.value)}><option value="">选择项目</option>{data.programs.map((program) => <option value={program.id} key={program.id}>{program.name}</option>)}</select></label>
        <label>入学批次<input value={intake} onChange={(event) => setIntake(event.target.value)} /></label>
        <label>申请开放<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label>申请截止<input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
        <button className="button button-primary" type="submit"><Plus size={15} aria-hidden="true" />创建申请</button>
      </form>
    </section>

    {loading ? <div className="empty-state">正在读取申请…</div> : data.applications.length ? <div className="application-list">
      {[...data.applications].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((application) => {
        const progress = applicationProgress(application);
        const score = data.scores[application.id];
        const openTasks = application.tasks.filter((task) => !task.completed).length;
        const canDelete = deletableStatuses.has(application.status);
        const confirmingDelete = pendingDeleteId === application.id;
        return <article key={application.id}>
          <div className="application-main"><span className={`application-status status-${application.status}`}>{statusLabels[application.status]}</span><h2>{application.programName}</h2><p>{application.intake || "未设置批次"}{application.deadline ? ` · 截止 ${new Date(`${application.deadline}T00:00:00`).toLocaleDateString("zh-CN")}` : ""}</p></div>
          <div className="application-metrics"><div><span>竞争力</span><strong>{score?.score == null ? "--" : Math.round(score.score)}</strong><small>{score ? `证据 ${score.evidenceCoverage}%` : "待确认"}</small></div><div><span>准备度</span><strong>{score?.readiness ?? progress}%</strong><small>{openTasks} 项任务待完成</small></div>{score?.probabilityMinimum != null && score.probabilityMaximum != null && <div><span>概率区间</span><strong>{score.probabilityMinimum}–{score.probabilityMaximum}%</strong><small>基于有来源先验</small></div>}</div>
          <div className="application-actions"><Link href={`/dashboard/applications/${application.id}`}>申请详情<ArrowRight size={15} aria-hidden="true" /></Link>{canDelete && (confirmingDelete ? <div className="application-delete-confirm" role="status"><span>删除草稿？</span><button type="button" onClick={() => setPendingDeleteId(undefined)}>取消</button><button className="danger-link" type="button" onClick={() => removeApplication(application)}>确认</button></div> : <button className="danger-link" type="button" title="删除草稿" onClick={() => setPendingDeleteId(application.id)}><Trash2 size={15} aria-hidden="true" /></button>)}</div>
        </article>;
      })}
    </div> : <div className="empty-state"><strong>还没有申请</strong><p>从一个项目建立申请要求快照。</p><Link href="/dashboard/programs">查看项目目录<ArrowRight size={14} aria-hidden="true" /></Link></div>}
  </div>;
}
