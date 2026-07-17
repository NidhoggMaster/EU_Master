import Link from "next/link";

const features = [
  ["项目", "集中查看学校、专业与申请要求。"],
  ["材料", "整理文件、类型与准备状态。"],
  ["申请", "跟踪任务、截止日期与进度。"],
];

export default function Home() {
  return (
    <main className="simple-home">
      <header className="simple-header">
        <div className="site-shell simple-nav">
          <Link className="brand" href="/" aria-label="EU Master 首页">
            <span className="brand-mark" aria-hidden="true">EU</span>
            <span className="brand-copy">
              <strong>EU Master</strong>
              <small>Application Manager</small>
            </span>
          </Link>
          <Link className="button button-small button-outline" href="/dashboard">
            进入控制台
          </Link>
        </div>
      </header>

      <section className="simple-hero">
        <div className="simple-shape" aria-hidden="true" />
        <div className="site-shell simple-hero-inner">
          <span className="simple-kicker">EUROPE · MASTER · 2027+</span>
          <h1>欧洲硕士申请管理</h1>
          <details className="country-picker simple-cta">
            <summary>
              选择国家 <span aria-hidden="true">⌄</span>
            </summary>
            <div className="country-menu">
              <Link className="country-option" href="/dashboard">
                <span className="country-code">NL</span>
                <span className="country-name">
                  <strong>荷兰</strong>
                  <small>Netherlands</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </details>
        </div>
      </section>

      <section className="simple-features" aria-label="核心功能">
        <div className="site-shell simple-feature-grid">
          {features.map(([title, description], index) => (
            <article className="simple-feature" key={title}>
              <span>0{index + 1}</span>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="simple-footer">
        <div className="site-shell">
          <span>EU Master Application Manager</span>
          <span>本地预览</span>
        </div>
      </footer>
    </main>
  );
}
