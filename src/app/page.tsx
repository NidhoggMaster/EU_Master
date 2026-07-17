import Link from "next/link";

const features = [
  {
    number: "01",
    title: "项目要求，一处看清",
    description:
      "把大学、专业、截止日期、费用与材料要求整理成结构化信息，减少来回查找。",
  },
  {
    number: "02",
    title: "申请材料，统一管理",
    description:
      "从成绩单到动机信，按材料类型和版本集中整理，知道什么已有、什么还缺。",
  },
  {
    number: "03",
    title: "每份申请，进度明确",
    description:
      "围绕具体项目建立申请工作区，把要求、材料、任务和关键日期放在一起。",
  },
  {
    number: "04",
    title: "匹配结论，有据可查",
    description:
      "逐项比较项目要求与个人背景，区分满足、有条件、信息不足与明确不满足。",
  },
];

const steps = [
  ["01", "建立个人档案", "整理教育背景、课程、成绩与语言能力。"],
  ["02", "筛选目标项目", "比较项目方向、要求、成本与时间节点。"],
  ["03", "准备申请材料", "复用基础材料，为不同项目创建定制版本。"],
  ["04", "跟踪每份申请", "集中查看缺口、任务、截止日期与申请状态。"],
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <div className="site-shell nav-row">
          <Link className="brand" href="/" aria-label="EU Master 首页">
            <span className="brand-mark" aria-hidden="true">
              EU
            </span>
            <span className="brand-copy">
              <strong>EU Master</strong>
              <small>Application Manager</small>
            </span>
          </Link>

          <nav className="desktop-nav" aria-label="主导航">
            <a href="#features">核心功能</a>
            <a href="#workflow">使用流程</a>
            <a href="#scope">首期范围</a>
          </nav>

          <Link className="button button-small button-outline" href="/dashboard">
            进入控制台
          </Link>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="site-shell hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" aria-hidden="true" />
              专注荷兰研究型大学硕士申请
            </div>
            <h1>
              把荷兰硕士申请，
              <span>变成清晰、可执行的计划</span>
            </h1>
            <p className="hero-lead">
              从项目筛选、资格判断到材料与进度管理，用一个工作台整理申请全流程，减少遗漏，也减少不确定。
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/dashboard">
                开始整理申请
                <span aria-hidden="true">→</span>
              </Link>
              <a className="button button-ghost" href="#workflow">
                查看使用流程
              </a>
            </div>
            <div className="hero-note" aria-label="产品特点">
              <span>✓ 结构化要求</span>
              <span>✓ 材料版本管理</span>
              <span>✓ 人工确认优先</span>
            </div>
          </div>

          <div className="hero-product" aria-label="申请控制台预览">
            <div className="preview-window">
              <div className="preview-topbar">
                <div className="preview-brand">
                  <span className="mini-mark">EU</span>
                  <span>申请总览</span>
                </div>
                <div className="preview-avatar">L</div>
              </div>
              <div className="preview-body">
                <div className="preview-heading">
                  <div>
                    <span className="preview-kicker">2027 秋季入学</span>
                    <h2>下午好，开始规划你的申请</h2>
                  </div>
                  <span className="preview-status">准备中</span>
                </div>
                <div className="preview-stats">
                  <div>
                    <span>档案完成度</span>
                    <strong>0%</strong>
                    <i className="progress-line"><b /></i>
                  </div>
                  <div>
                    <span>目标项目</span>
                    <strong>0</strong>
                    <small>待添加</small>
                  </div>
                  <div>
                    <span>申请材料</span>
                    <strong>0</strong>
                    <small>待上传</small>
                  </div>
                </div>
                <div className="preview-list">
                  <div className="preview-list-head">
                    <strong>下一步</strong>
                    <span>你的申请起点</span>
                  </div>
                  <div className="preview-task">
                    <span className="task-number">1</span>
                    <span>
                      <strong>完善个人档案</strong>
                      <small>添加教育背景与目标偏好</small>
                    </span>
                    <span className="task-arrow" aria-hidden="true">→</span>
                  </div>
                  <div className="preview-task preview-task-muted">
                    <span className="task-number">2</span>
                    <span>
                      <strong>探索硕士项目</strong>
                      <small>建立第一份候选清单</small>
                    </span>
                    <span className="task-arrow" aria-hidden="true">→</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="floating-card floating-card-left">
              <span className="floating-icon">NL</span>
              <span><strong>荷兰 U 类大学</strong><small>首期专注范围</small></span>
            </div>
            <div className="floating-card floating-card-right">
              <span className="floating-check">✓</span>
              <span><strong>要求可追溯</strong><small>保留官网来源</small></span>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="首期支持范围概览">
        <div className="site-shell trust-grid">
          <div><strong>NL</strong><span>荷兰研究型大学</span></div>
          <div><strong>EN</strong><span>英语授课硕士</span></div>
          <div><strong>2027+</strong><span>目标入学时间</span></div>
          <div><strong>Human first</strong><span>关键判断人工确认</span></div>
        </div>
      </section>

      <section className="section-block" id="features">
        <div className="site-shell">
          <div className="section-heading">
            <div>
              <span className="section-label">核心能力</span>
              <h2>申请里的复杂信息，整理成清晰行动</h2>
            </div>
            <p>先把真正影响决策的信息和材料组织好，再逐步加入自动化能力。</p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.number}>
                <span className="feature-number">{feature.number}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <span className="feature-link">了解更多 <i aria-hidden="true">↗</i></span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block workflow-section" id="workflow">
        <div className="site-shell workflow-grid">
          <div className="workflow-intro">
            <span className="section-label">从哪里开始</span>
            <h2>四步建立你的申请工作台</h2>
            <p>不需要一开始就准备好所有信息。先建立框架，再随着申请推进逐步补全。</p>
            <Link className="text-link" href="/dashboard">打开控制台预览 <span aria-hidden="true">→</span></Link>
          </div>
          <ol className="steps-list">
            {steps.map(([number, title, description]) => (
              <li key={number}>
                <span className="step-number">{number}</span>
                <span><strong>{title}</strong><small>{description}</small></span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-block" id="scope">
        <div className="site-shell scope-card">
          <div className="scope-copy">
            <span className="section-label section-label-light">首期支持范围</span>
            <h2>先把荷兰硕士申请做好</h2>
            <p>聚焦明确范围，让每一条项目要求、每一份材料和每一个判断都更可靠。</p>
            <Link className="button button-light" href="/dashboard">查看基础工作台 <span aria-hidden="true">→</span></Link>
          </div>
          <div className="scope-list">
            <div><span>01</span><strong>荷兰研究型大学（U 类）</strong></div>
            <div><span>02</span><strong>英语授课硕士项目</strong></div>
            <div><span>03</span><strong>2027 年及之后入学</strong></div>
            <div><span>04</span><strong>人工录入与审核优先</strong></div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-shell footer-row">
          <Link className="brand brand-footer" href="/">
            <span className="brand-mark">EU</span>
            <span className="brand-copy"><strong>EU Master</strong><small>Application Manager</small></span>
          </Link>
          <p>让每一份申请，都从清晰开始。</p>
          <span>本地基础版本 · 2026</span>
        </div>
      </footer>
    </main>
  );
}
