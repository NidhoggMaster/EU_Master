"use client";

import { useEffect, useState } from "react";
import { createBackup, downloadBlob, inspectBackup, restoreBackup } from "@/lib/backup";
import type { BackupRecords, MaterialVersion } from "@/lib/types";

type BackupPreview = {
  encrypted: boolean;
  exportedAt: string;
  records: BackupRecords;
  versions: MaterialVersion[];
  summary: { programs: number; materials: number; applications: number; files: number };
};

function formatSize(bytes?: number) {
  if (!bytes) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function SettingsPage() {
  const [usage, setUsage] = useState(0);
  const [quota, setQuota] = useState(0);
  const [persisted, setPersisted] = useState<boolean>();
  const [exportMode, setExportMode] = useState<"encrypted" | "plain">("encrypted");
  const [exportPassword, setExportPassword] = useState("");
  const [exportPasswordAgain, setExportPasswordAgain] = useState("");
  const [importFile, setImportFile] = useState<File>();
  const [importPassword, setImportPassword] = useState("");
  const [preview, setPreview] = useState<BackupPreview>();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    if (!navigator.storage) return () => { active = false; };
    Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false),
    ]).then(([estimate, isPersisted]) => {
      if (!active) return;
      setUsage(estimate.usage ?? 0);
      setQuota(estimate.quota ?? 0);
      setPersisted(isPersisted);
    });
    return () => { active = false; };
  }, []);

  async function requestPersistence() {
    if (!navigator.storage?.persist) {
      setMessage("当前浏览器不支持申请持久化存储。");
      return;
    }
    const result = await navigator.storage.persist();
    setPersisted(result);
    setMessage(result ? "浏览器已允许持久保存本站数据。" : "浏览器未授予持久化权限，请定期导出备份。");
  }

  async function handleExport() {
    if (exportMode === "encrypted") {
      if (exportPassword.length < 8) { setMessage("加密密码至少需要 8 个字符。"); return; }
      if (exportPassword !== exportPasswordAgain) { setMessage("两次输入的备份密码不一致。"); return; }
    } else if (!window.confirm("普通 ZIP 不加密，任何拿到文件的人都能查看申请数据和材料。仍要继续吗？")) {
      return;
    }
    setWorking(true);
    setMessage("正在打包本地数据和材料，请稍候…");
    try {
      const backup = await createBackup(exportMode === "encrypted" ? exportPassword : undefined);
      downloadBlob(backup.blob, backup.fileName);
      setMessage("备份已经生成并下载。请妥善保管备份文件和密码。");
      setExportPassword(""); setExportPasswordAgain("");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "备份生成失败。");
    } finally {
      setWorking(false);
    }
  }

  async function handleInspect() {
    if (!importFile) { setMessage("请先选择备份文件。"); return; }
    setWorking(true); setPreview(undefined); setMessage("正在校验备份完整性…");
    try {
      const result = await inspectBackup(importFile, importPassword);
      setPreview(result);
      setMessage("备份校验通过。确认数量后再执行恢复。");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "备份校验失败。");
    } finally {
      setWorking(false);
    }
  }

  async function handleRestore() {
    if (!preview || !window.confirm("恢复会替换当前浏览器中的材料文件和申请工作区。项目与个人档案不会被覆盖。确定继续吗？")) return;
    setWorking(true); setMessage("正在恢复备份，请不要关闭页面…");
    try {
      await restoreBackup(preview.records, preview.versions);
      setMessage("备份恢复完成，页面即将刷新。");
      setTimeout(() => window.location.assign("/dashboard"), 700);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "恢复失败，现有数据未被替换。");
      setWorking(false);
    }
  }

  const usagePercent = quota ? Math.min(100, Math.round((usage / quota) * 100)) : 0;

  return (
    <div className="dashboard-content content-narrow">
      <header className="page-heading"><div><span className="dashboard-date">设备本地文件</span><h1>设置与备份</h1><p>管理本地材料与申请工作区；项目和个人档案由私有数据库保存。</p></div></header>
      {message && <div className="notice" role="status">{message}</div>}

      <section className="settings-card storage-card">
        <div><span className="panel-label">浏览器存储</span><h2>{formatSize(usage)} 已使用</h2><p>可用配额约 {formatSize(quota)}，实际配额由浏览器决定。</p></div>
        <div className="storage-visual"><div><span style={{ width: `${Math.max(1, usagePercent)}%` }} /></div><small>{usagePercent}%</small></div>
        <div className="storage-persist"><span className={persisted ? "safe" : "warning"}>{persisted ? "已启用持久化存储" : "可能被浏览器自动清理"}</span><button type="button" onClick={requestPersistence}>申请持久保存</button></div>
      </section>

      <section className="settings-card">
        <div className="panel-heading"><div><span className="panel-label">本地工作区导出</span><h2>创建本地备份</h2></div><span className="zero-state-tag">材料 + 申请</span></div>
        <div className="mode-switch"><button className={exportMode === "encrypted" ? "active" : ""} type="button" onClick={() => setExportMode("encrypted")}><strong>密码加密</strong><small>推荐，导出 .eumaster</small></button><button className={exportMode === "plain" ? "active" : ""} type="button" onClick={() => setExportMode("plain")}><strong>普通 ZIP</strong><small>不加密，需确认风险</small></button></div>
        {exportMode === "encrypted" && <div className="form-grid"><label>设置备份密码<input type="password" minLength={8} value={exportPassword} onChange={(event) => setExportPassword(event.target.value)} /></label><label>再次输入密码<input type="password" minLength={8} value={exportPasswordAgain} onChange={(event) => setExportPasswordAgain(event.target.value)} /></label></div>}
        <button className="button button-primary" type="button" disabled={working} onClick={handleExport}>{working ? "处理中…" : "生成并下载备份"}</button>
      </section>

      <section className="settings-card">
        <div className="panel-heading"><div><span className="panel-label">完整恢复</span><h2>校验并导入备份</h2></div><span className="zero-state-tag">先校验，后替换</span></div>
        <div className="form-grid"><label className="file-field">备份文件<input type="file" accept=".eumaster,.zip" onChange={(event) => { setImportFile(event.target.files?.[0]); setPreview(undefined); }} /><span>{importFile?.name || "选择 .eumaster 或 .zip"}</span></label><label>备份密码<input type="password" value={importPassword} placeholder="普通 ZIP 可留空" onChange={(event) => setImportPassword(event.target.value)} /></label></div>
        <button className="button button-outline" type="button" disabled={working} onClick={handleInspect}>校验备份</button>
        {preview && <div className="backup-preview"><div><span>导出时间</span><strong>{new Date(preview.exportedAt).toLocaleString("zh-CN")}</strong></div><div><span>项目表格快照</span><strong>{preview.summary.programs}</strong></div><div><span>材料</span><strong>{preview.summary.materials}</strong></div><div><span>申请</span><strong>{preview.summary.applications}</strong></div><div><span>文件版本</span><strong>{preview.summary.files}</strong></div><button className="button button-primary" type="button" disabled={working} onClick={handleRestore}>确认替换当前数据</button></div>}
      </section>

      <div className="notice notice-warning">清理浏览器站点数据会删除材料文件、版本和申请工作区，但不会删除 Supabase 中的项目目录与个人档案。</div>
    </div>
  );
}
