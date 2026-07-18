"use client";

import Link from "next/link";
import { getPrograms } from "@/lib/catalog-client";
import { getProfile } from "@/lib/profile-client";
import { applicationProgress, profileCompletion } from "@/lib/progress";
import { useLocalQuery } from "@/lib/use-local-query";
import { getApplications, getMaterials } from "@/lib/workspace-client";

async function loadDashboard() {
  const [profile, programs, materials, applications] = await Promise.all([
    getProfile(), getPrograms(), getMaterials(), getApplications(),
  ]);
  return { profile, programs, materials, applications };
}

export default function DashboardPage() {
  const { data, loading, error } = useLocalQuery("dashboard", loadDashboard, {
    profile: undefined,
    programs: [],
    materials: [],
    applications: [],
  });
  const profilePercent = profileCompletion(data.profile);
  const readyMaterials = data.materials.filter((item) => item.prepared || item.status === "ready").length;
  const activeApplications = data.applications.filter((item) => ["planning", "preparing"].includes(item.status));
  const pendingTasks = data.applications.flatMap((item) => item.tasks).filter((task) => !task.completed).length;
  const averageApplicationProgress = activeApplications.length
    ? Math.round(activeApplications.reduce((sum, item) => sum + applicationProgress(item), 0) / activeApplications.length)
    : 0;
  const upcoming = data.applications
    .filter((item) => item.deadline && !Number.isNaN(Date.parse(item.deadline)))
    .sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline))[0];

  const summaryCards = [
    { label: "档案完成度", value: `${profilePercent}%`, detail: profilePercent === 100 ? "结构化档案已完成" : "继续完善背景信息", tone: "blue" },
    { label: "项目目录", value: String(data.programs.length), detail: "已配置荷兰样例项目", tone: "mint" },
    { label: "可用材料", value: String(readyMaterials), detail: `共 ${data.materials.length} 份材料`, tone: "sand" },
    { label: "进行中申请", value: String(activeApplications.length), detail: `${pendingTasks} 项任务待完成`, tone: "lavender" },
  ];

  return (
    <div className="dashboard-content">
      <div className="dashboard-welcome">
        <div>
          <span className="dashboard-date">2027 秋季入学规划</span>
          <h1>申请工作台</h1>
          <p>档案、材料和申请保存在本机；项目目录可在本地 CSV 与 Supabase 间切换。</p>
        </div>
        <Link className="dashboard-primary link-button" href={profilePercent ? "/dashboard/programs" : "/dashboard/personal/profile"}>
          {profilePercent ? "查看项目目录" : "建立个人档案"}
        </Link>
      </div>

      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {loading && <div className="notice">正在读取项目库与本地申请数据…</div>}

      <div className="summary-grid" aria-label="申请数据概览">
        {summaryCards.map((card) => (
          <article className={`summary-card summary-${card.tone}`} key={card.label}>
            <div className="summary-card-top"><span>{card.label}</span><i aria-hidden="true" /></div>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </div>

      <div className="dashboard-grid dashboard-grid-wide">
        <section className="dashboard-panel">
          <div className="panel-heading">
            <div><span className="panel-label">当前计划</span><h2>申请准备进度</h2></div>
            <span className="zero-state-tag">{averageApplicationProgress}%</span>
          </div>
          <div className="foundation-progress" aria-label={`申请准备进度 ${averageApplicationProgress}%`}>
            <span style={{ width: `${Math.max(2, averageApplicationProgress)}%` }} />
          </div>
          <div className="action-list">
            <Link href="/dashboard/personal/profile"><span>01</span><strong>完善个人档案</strong><small>{profilePercent}%</small></Link>
            <Link href="/dashboard/programs"><span>02</span><strong>筛选和更新项目</strong><small>{data.programs.length} 个</small></Link>
            <Link href="/dashboard/personal/materials"><span>03</span><strong>整理申请材料</strong><small>{readyMaterials} 份可用</small></Link>
            <Link href="/dashboard/applications"><span>04</span><strong>跟踪申请任务</strong><small>{pendingTasks} 项待办</small></Link>
          </div>
        </section>

        <aside className="dashboard-panel deadline-panel">
          <span className="panel-label">最近截止日期</span>
          {upcoming ? (
            <>
              <h2>{new Date(upcoming.deadline).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</h2>
              <strong>{upcoming.programName}</strong>
              <Link href={`/dashboard/applications/${upcoming.id}`}>打开申请 →</Link>
            </>
          ) : (
            <>
              <h2>尚未设置</h2>
              <p>创建申请并填写截止日期后，会在这里提醒。</p>
              <Link href="/dashboard/applications">创建申请 →</Link>
            </>
          )}
        </aside>
      </div>

      <section className="getting-started local-warning">
        <div className="getting-copy">
          <span className="getting-number">!</span>
          <div><span className="panel-label">本地数据提醒</span><h2>Private_Data 与 material_center 不受浏览器缓存清理影响</h2></div>
        </div>
        <Link href="/dashboard/settings">前往备份设置 →</Link>
      </section>
    </div>
  );
}
