import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "申请控制台",
};

const summaryCards = [
  { label: "档案完成度", value: "0%", detail: "开始完善背景信息", tone: "blue" },
  { label: "目标项目", value: "0", detail: "尚未收藏项目", tone: "mint" },
  { label: "申请材料", value: "0", detail: "尚未上传材料", tone: "sand" },
  { label: "进行中申请", value: "0", detail: "尚未创建申请", tone: "lavender" },
];

const modules = [
  { index: "01", title: "个人档案", description: "教育背景、课程、成绩与申请偏好", action: "开始填写", status: "建议先完成" },
  { index: "02", title: "项目目录", description: "大学、硕士项目与结构化申请要求", action: "即将开放", status: "下一阶段" },
  { index: "03", title: "材料中心", description: "原始材料、分类信息与文件版本", action: "即将开放", status: "下一阶段" },
  { index: "04", title: "申请工作区", description: "材料缺口、申请任务与截止日期", action: "即将开放", status: "下一阶段" },
];

export default function DashboardPage() {
  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" href="/">
          <span className="brand-mark">EU</span>
          <span className="brand-copy"><strong>EU Master</strong><small>Application Manager</small></span>
        </Link>
        <nav className="dashboard-nav" aria-label="控制台导航">
          <a className="active" href="#overview"><span>01</span>总览</a>
          <a href="#modules"><span>02</span>项目目录<small>即将开放</small></a>
          <a href="#modules"><span>03</span>材料中心<small>即将开放</small></a>
          <a href="#modules"><span>04</span>申请管理<small>即将开放</small></a>
          <a href="#profile"><span>05</span>个人档案</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="scope-mini">
            <span>首期范围</span>
            <strong>荷兰 · 硕士 · 2027+</strong>
            <small>基础版本正在搭建中</small>
          </div>
          <Link className="back-home" href="/">← 返回产品首页</Link>
        </div>
      </aside>

      <section className="dashboard-main" id="overview">
        <header className="dashboard-topbar">
          <Link className="mobile-brand" href="/">
            <span className="brand-mark">EU</span>
            <strong>EU Master</strong>
          </Link>
          <div className="dashboard-breadcrumb"><span>工作台</span><i>/</i><strong>总览</strong></div>
          <div className="local-badge"><span aria-hidden="true" /> 本地预览</div>
        </header>

        <div className="dashboard-content">
          <div className="dashboard-welcome">
            <div>
              <span className="dashboard-date">2027 秋季入学规划</span>
              <h1>下午好，欢迎开始你的申请计划</h1>
              <p>先建立完整的个人档案，我们会从这里逐步整理项目、材料与每一份申请。</p>
            </div>
            <button className="dashboard-primary" type="button">＋ 建立个人档案</button>
          </div>

          <div className="summary-grid" aria-label="申请数据概览">
            {summaryCards.map((card) => (
              <article className={`summary-card summary-${card.tone}`} key={card.label}>
                <div className="summary-card-top"><span>{card.label}</span><i aria-hidden="true" /></div>
                <strong>{card.value}</strong>
                <small>{card.detail}</small>
              </article>
            ))}
          </div>

          <div className="dashboard-grid">
            <section className="dashboard-panel" id="profile">
              <div className="panel-heading">
                <div><span className="panel-label">建议下一步</span><h2>建立你的申请基础</h2></div>
                <span className="zero-state-tag">0 / 4 完成</span>
              </div>
              <div className="foundation-progress" aria-label="基础设置进度 0%"><span /></div>
              <div className="module-list" id="modules">
                {modules.map((module, index) => (
                  <article className={index === 0 ? "module-row module-row-active" : "module-row"} key={module.index}>
                    <span className="module-index">{module.index}</span>
                    <span className="module-copy"><strong>{module.title}</strong><small>{module.description}</small></span>
                    <span className="module-status">{module.status}</span>
                    <button type="button" disabled={index !== 0}>{module.action}</button>
                  </article>
                ))}
              </div>
            </section>

            <aside className="dashboard-panel readiness-panel">
              <div className="panel-heading"><div><span className="panel-label">申请准备度</span><h2>尚未开始</h2></div></div>
              <div className="readiness-ring" aria-label="申请准备度 0%"><span><strong>0%</strong><small>已完成</small></span></div>
              <ul className="readiness-list">
                <li><span className="legend-dot legend-blue" />背景信息 <strong>0%</strong></li>
                <li><span className="legend-dot legend-green" />目标项目 <strong>0%</strong></li>
                <li><span className="legend-dot legend-gold" />材料准备 <strong>0%</strong></li>
              </ul>
              <p>完成个人档案后，这里会显示更具体的准备建议。</p>
            </aside>
          </div>

          <section className="getting-started">
            <div className="getting-copy">
              <span className="getting-number">01</span>
              <div><span className="panel-label">从这里开始</span><h2>先把已有信息整理好，不必一次完成所有内容</h2></div>
            </div>
            <p>基础网站暂不保存数据。后续接入账户与数据库后，个人档案、材料和申请进度才会持久保存。</p>
          </section>
        </div>
      </section>
    </main>
  );
}
