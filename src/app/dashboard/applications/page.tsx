"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getApplications, getMaterials, getPrograms, saveApplication } from "@/lib/db";
import { applicationProgress } from "@/lib/progress";
import type { Application, Material, Program } from "@/lib/types";
import { useLocalQuery } from "@/lib/use-local-query";

async function loadApplications() {
  const [applications, programs, materials] = await Promise.all([getApplications(), getPrograms(), getMaterials()]);
  return { applications, programs, materials };
}

const statusLabels: Record<Application["status"], string> = {
  planning: "规划中", preparing: "准备中", submitted: "已提交", offer: "已录取", rejected: "未录取", withdrawn: "已撤回",
};

export default function ApplicationsPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useLocalQuery("applications", loadApplications, { applications: [] as Application[], programs: [] as Program[], materials: [] as Material[] });
  const [programId, setProgramId] = useState("");
  const [intake, setIntake] = useState("2027 September");
  const [deadline, setDeadline] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("program");
    if (selected) Promise.resolve(selected).then(setProgramId);
  }, []);

  function selectProgram(id: string) {
    setProgramId(id);
    const program = data.programs.find((item) => item.id === id);
    if (program?.intakes[0]) setIntake(program.intakes[0]);
    if (program?.deadline && /^\d{4}-\d{2}-\d{2}$/.test(program.deadline)) setDeadline(program.deadline);
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
      const matched = data.materials.find((material) => material.type === requirement.materialType && material.status === "ready");
      return {
        id: crypto.randomUUID(), sourceRequirementId: requirement.id, title: requirement.title,
        materialType: requirement.materialType, required: requirement.required, originalText: requirement.originalText,
        materialId: matched?.id ?? "", satisfied: Boolean(matched),
      };
    });
    const application: Application = {
      id: crypto.randomUUID(), programId: program.id, programName: program.name, intake: intake.trim(), deadline,
      status: "planning", requirements,
      tasks: requirements.filter((item) => item.required && !item.satisfied).map((item) => ({ id: crypto.randomUUID(), title: `准备：${item.title}`, dueDate: deadline, completed: false, createdAt: timestamp })),
      requirementsSourceUpdatedAt: program.updatedAt, createdAt: timestamp, updatedAt: timestamp,
    };
    await saveApplication(application);
    reload();
    router.push(`/dashboard/applications/${application.id}`);
  }

  return (
    <div className="dashboard-content">
      <header className="page-heading"><div><span className="dashboard-date">清单、任务与进度</span><h1>申请管理</h1><p>每份申请保留独立要求快照，不会被项目更新静默覆盖。</p></div><span className="count-badge">{data.applications.length} 份申请</span></header>
      {(message || error) && <div className={`notice ${error ? "notice-error" : ""}`}>{error || message}</div>}

      <section className="create-application-panel">
        <div><span className="panel-label">新建申请</span><h2>从项目目录创建工作区</h2></div>
        <form onSubmit={createApplication}>
          <label>目标项目<select value={programId} onChange={(event) => selectProgram(event.target.value)}><option value="">选择项目</option>{data.programs.map((program) => <option value={program.id} key={program.id}>{program.name}</option>)}</select></label>
          <label>入学批次<input value={intake} onChange={(event) => setIntake(event.target.value)} /></label>
          <label>截止日期<input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
          <button className="button button-primary" type="submit">创建申请</button>
        </form>
      </section>

      {loading ? <div className="empty-state">正在读取申请…</div> : data.applications.length ? (
        <div className="application-list">
          {data.applications.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((application) => {
            const progress = applicationProgress(application);
            const openTasks = application.tasks.filter((task) => !task.completed).length;
            return <article key={application.id}><div className="application-main"><span className={`application-status status-${application.status}`}>{statusLabels[application.status]}</span><h2>{application.programName}</h2><p>{application.intake || "未设置批次"}{application.deadline ? ` · 截止 ${new Date(`${application.deadline}T00:00:00`).toLocaleDateString("zh-CN")}` : ""}</p></div><div className="application-progress"><strong>{progress}%</strong><div><span style={{ width: `${progress}%` }} /></div><small>{openTasks} 项任务待完成</small></div><Link href={`/dashboard/applications/${application.id}`}>打开工作区 →</Link></article>;
          })}
        </div>
      ) : <div className="empty-state"><strong>还没有申请</strong><p>选择一个项目，建立要求清单和任务。</p><Link href="/dashboard/programs">先查看项目目录 →</Link></div>}
    </div>
  );
}
