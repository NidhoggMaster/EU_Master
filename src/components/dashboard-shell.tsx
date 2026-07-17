"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/dashboard", label: "总览", index: "01", exact: true },
  { href: "/dashboard/programs", label: "项目目录", index: "02" },
  { href: "/dashboard/materials", label: "材料中心", index: "03" },
  { href: "/dashboard/applications", label: "申请管理", index: "04" },
  { href: "/dashboard/profile", label: "个人档案", index: "05" },
  { href: "/dashboard/settings", label: "设置与备份", index: "06" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = navigation.find((item) => item.exact ? pathname === item.href : pathname.startsWith(item.href)) ?? navigation[0];

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" href="/">
          <span className="brand-mark">EU</span>
          <span className="brand-copy"><strong>EU Master</strong><small>Application Manager</small></span>
        </Link>
        <nav className="dashboard-nav" aria-label="控制台导航">
          {navigation.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return <Link className={active ? "active" : ""} href={item.href} key={item.href}><span>{item.index}</span>{item.label}</Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="scope-mini">
            <span>本地工作区</span>
            <strong>荷兰 · 硕士 · 2027+</strong>
            <small>数据仅保存在当前浏览器</small>
          </div>
          <Link className="back-home" href="/">← 返回首页</Link>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <Link className="mobile-brand" href="/">
            <span className="brand-mark">EU</span>
            <strong>EU Master</strong>
          </Link>
          <div className="dashboard-breadcrumb"><span>工作台</span><i>/</i><strong>{current.label}</strong></div>
          <div className="local-badge"><span aria-hidden="true" /> 本地保存</div>
        </header>
        {children}
        <nav className="mobile-dashboard-nav" aria-label="手机控制台导航">
          {navigation.slice(0, 5).map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return <Link className={active ? "active" : ""} href={item.href} key={item.href}><span>{item.index}</span>{item.label.slice(0, 2)}</Link>;
          })}
        </nav>
      </section>
    </main>
  );
}
