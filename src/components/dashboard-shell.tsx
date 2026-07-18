"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, Columns3, Files, LayoutDashboard, Settings, UserRound, ClipboardList } from "lucide-react";
import type { CatalogMode, StorageStatus } from "@/lib/types";

const navigation = [
  { href: "/dashboard", label: "总览", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/programs", label: "项目目录", icon: BookOpen },
  { href: "/dashboard/compare", label: "项目对比", icon: Columns3 },
  { href: "/dashboard/applications", label: "项目申请", icon: ClipboardList },
  { href: "/dashboard/personal/profile", label: "个人信息", icon: UserRound, group: "个人中心" },
  { href: "/dashboard/personal/materials", label: "材料中心", icon: Files, group: "个人中心" },
  { href: "/dashboard/settings", label: "设置与数据", icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [storage, setStorage] = useState<StorageStatus>();
  const [switching, setSwitching] = useState(false);
  const [storageError, setStorageError] = useState("");
  const isActive = (item: (typeof navigation)[number]) => item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const current = navigation.find(isActive) ?? navigation[0];

  useEffect(() => {
    fetch("/api/storage/status", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as StorageStatus & { error?: string };
        if (!response.ok) throw new Error(body.error || "读取存储状态失败。");
        setStorage(body);
      })
      .catch((error) => setStorageError(error instanceof Error ? error.message : "读取存储状态失败。"));
  }, []);

  async function selectMode(mode: CatalogMode) {
    if (!storage || storage.catalogMode === mode || switching) return;
    setSwitching(true);
    setStorageError("");
    try {
      const response = await fetch("/api/storage/mode", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode }) });
      const body = await response.json() as StorageStatus & { error?: string };
      if (!response.ok) throw new Error(body.error || "切换存储模式失败。");
      setStorage(body);
      window.location.reload();
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "切换存储模式失败。");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" href="/">
          <span className="brand-mark">EU</span>
          <span className="brand-copy"><strong>EU Master</strong><small>Application Manager</small></span>
        </Link>
        <nav className="dashboard-nav" aria-label="控制台导航">
          {navigation.map((item, index) => {
            const active = isActive(item);
            const Icon = item.icon;
            const showGroup = item.group && navigation[index - 1]?.group !== item.group;
            return <div className="dashboard-nav-item" key={item.href}>{showGroup && <span className="dashboard-nav-group">{item.group}</span>}<Link className={active ? "active" : ""} href={item.href}><Icon size={16} aria-hidden="true" />{item.label}</Link></div>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="scope-mini">
            <span>本地工作区</span>
            <strong>荷兰 · 硕士 · 2027+</strong>
            <small>个人数据始终保存在本机</small>
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
          <div className="storage-switch-wrap">
            <div className="storage-switch" role="group" aria-label="项目存储模式">
              <button className={storage?.catalogMode === "local" ? "active" : ""} type="button" onClick={() => selectMode("local")} disabled={!storage || switching}>本地 CSV</button>
              <button className={storage?.catalogMode === "supabase" ? "active" : ""} type="button" onClick={() => selectMode("supabase")} disabled={!storage || switching} title={storage?.supabase.error}>Supabase</button>
            </div>
            {storageError && <span className="storage-switch-error" role="status">{storageError}</span>}
          </div>
        </header>
        {children}
        <nav className="mobile-dashboard-nav" aria-label="手机控制台导航">
          {navigation.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return <Link className={active ? "active" : ""} href={item.href} key={item.href}><Icon size={15} aria-hidden="true" /><span>{item.label.slice(0, 4)}</span></Link>;
          })}
        </nav>
      </section>
    </main>
  );
}
