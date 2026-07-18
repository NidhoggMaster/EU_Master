"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Save } from "lucide-react";
import { getPrograms, saveProgram } from "@/lib/catalog-client";
import {
  createServerBackup,
  downloadBlob,
  inspectServerBackup,
  migrateLegacyIndexedDb,
  restoreServerBackup,
} from "@/lib/backup";
import { readBackupRecords } from "@/lib/db";
import type { CatalogMode, LegacyMigrationPreview, MatchDimension, Program, ScoringSettings, StorageStatus, TransferPreview } from "@/lib/types";

type BackupPreview = {
  encrypted: boolean;
  exportedAt: string;
  schemaVersion: number;
  summary: LegacyMigrationPreview;
};

const emptyLegacy: LegacyMigrationPreview = { profile: 0, programs: 0, materials: 0, materialVersions: 0, applications: 0, sourceSnapshots: 0, fieldChanges: 0 };
const catalogWeightFields: Array<[MatchDimension, string]> = [["language", "标化"], ["courses", "课程"], ["degree", "学历"], ["gpa", "GPA"], ["experience", "经历"], ["project", "项目因素"]];
const applicationWeightFields: Array<[MatchDimension, string]> = [["language", "标化"], ["courses", "课程"], ["basicMaterials", "基本材料"], ["specialMaterials", "特需材料"], ["degree", "学历"], ["gpa", "GPA"], ["project", "项目因素"]];

async function json<T>(response: Response, fallback: string) {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || fallback);
  return body;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<StorageStatus>();
  const [scoring, setScoring] = useState<ScoringSettings>();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [priorProgramId, setPriorProgramId] = useState("");
  const [priorMinimum, setPriorMinimum] = useState("");
  const [priorMaximum, setPriorMaximum] = useState("");
  const [priorYear, setPriorYear] = useState("");
  const [priorSourceLabel, setPriorSourceLabel] = useState("");
  const [priorSourceUrl, setPriorSourceUrl] = useState("");
  const [priorApplicants, setPriorApplicants] = useState("");
  const [priorAdmitted, setPriorAdmitted] = useState("");
  const [transferFrom, setTransferFrom] = useState<CatalogMode>("supabase");
  const [transferPreview, setTransferPreview] = useState<TransferPreview>();
  const [overwriteIds, setOverwriteIds] = useState<Set<string>>(new Set());
  const [legacy, setLegacy] = useState<LegacyMigrationPreview>();
  const [remoteProfile, setRemoteProfile] = useState<{ exists: boolean; updatedAt?: string; importedAt?: string }>();
  const [exportMode, setExportMode] = useState<"encrypted" | "plain">("encrypted");
  const [exportPassword, setExportPassword] = useState("");
  const [exportPasswordAgain, setExportPasswordAgain] = useState("");
  const [importFile, setImportFile] = useState<File>();
  const [importPassword, setImportPassword] = useState("");
  const [preview, setPreview] = useState<BackupPreview>();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function refreshStatus() {
    const next = await json<StorageStatus>(await fetch("/api/storage/status", { cache: "no-store" }), "读取存储状态失败。");
    setStatus(next);
    if (next.supabase.configured) {
      fetch("/api/storage/remote-profile", { cache: "no-store" })
        .then((response) => json<{ exists: boolean; updatedAt?: string; importedAt?: string }>(response, "读取远端档案失败。"))
        .then(setRemoteProfile)
        .catch(() => setRemoteProfile({ exists: false }));
    }
  }

  useEffect(() => {
    Promise.resolve().then(refreshStatus).catch((error) => setMessage(error instanceof Error ? error.message : "读取存储状态失败。"));
    fetch("/api/storage/scoring", { cache: "no-store" }).then((response) => json<ScoringSettings>(response, "读取评分权重失败。")).then(setScoring).catch((error) => setMessage(error instanceof Error ? error.message : "读取评分权重失败。"));
    getPrograms().then(setPrograms).catch(() => undefined);
    if (!window.localStorage.getItem("eu-master-legacy-migrated")) {
      readBackupRecords().then(({ records }) => setLegacy({
        profile: records.profile ? 1 : 0,
        programs: records.programs.length,
        materials: records.materials.length,
        materialVersions: records.materialVersions.length,
        applications: records.applications.length,
        sourceSnapshots: records.sourceSnapshots.length,
        fieldChanges: records.fieldChanges.length,
      })).catch(() => setLegacy(emptyLegacy));
    }
  }, []);

  function updateWeight(kind: "catalog" | "application", key: MatchDimension, value: string) {
    setScoring((current) => current ? { ...current, [kind]: { ...current[kind], [key]: Number(value) || 0 } } : current);
  }

  async function handleSaveWeights() {
    if (!scoring) return;
    setWorking(true);
    try {
      const saved = await json<ScoringSettings>(await fetch("/api/storage/scoring", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ catalog: scoring.catalog, application: scoring.application }) }), "保存评分权重失败。");
      setScoring(saved);
      setMessage("评分权重已保存；现有评分快照需要重新确认。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存评分权重失败。");
    } finally { setWorking(false); }
  }

  function selectPriorProgram(id: string) {
    setPriorProgramId(id);
    const prior = programs.find((program) => program.id === id)?.admissionProbabilityPrior;
    setPriorMinimum(prior ? String(Math.round(prior.minimum * 1000) / 10) : "");
    setPriorMaximum(prior ? String(Math.round(prior.maximum * 1000) / 10) : "");
    setPriorYear(prior?.year ?? "");
    setPriorSourceLabel(prior?.sourceLabel ?? "");
    setPriorSourceUrl(prior?.sourceUrl ?? "");
    setPriorApplicants(prior?.applicantCount == null ? "" : String(prior.applicantCount));
    setPriorAdmitted(prior?.admittedCount == null ? "" : String(prior.admittedCount));
  }

  async function handleSavePrior(clear = false) {
    const program = programs.find((item) => item.id === priorProgramId);
    if (!program) { setMessage("请先选择项目。"); return; }
    const minimum = Number(priorMinimum) / 100;
    const maximum = Number(priorMaximum) / 100;
    const applicantCount = priorApplicants ? Number(priorApplicants) : undefined;
    const admittedCount = priorAdmitted ? Number(priorAdmitted) : undefined;
    const invalidSample = (applicantCount == null) !== (admittedCount == null)
      || (applicantCount != null && admittedCount != null && (!Number.isInteger(applicantCount) || !Number.isInteger(admittedCount) || applicantCount < 1 || admittedCount < 0 || admittedCount > applicantCount));
    if (!clear && (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum <= 0 || maximum >= 1 || minimum > maximum || !priorSourceLabel.trim())) {
      setMessage("基础概率需为 0–100% 的有效区间，并填写来源说明。");
      return;
    }
    if (!clear && invalidSample) { setMessage("申请人数和录取人数需同时填写，且录取人数不能超过申请人数。"); return; }
    setWorking(true);
    try {
      const saved = await saveProgram({ ...program, admissionProbabilityPrior: clear ? null : {
        minimum, maximum, applicantCount, admittedCount, year: priorYear.trim(), sourceUrl: priorSourceUrl.trim(), sourceLabel: priorSourceLabel.trim(), origin: "manual", updatedAt: new Date().toISOString(),
      } });
      setPrograms((items) => items.map((item) => item.id === saved.id ? saved : item));
      if (clear) {
        setPriorMinimum(""); setPriorMaximum(""); setPriorYear(""); setPriorSourceLabel(""); setPriorSourceUrl(""); setPriorApplicants(""); setPriorAdmitted("");
      }
      setMessage(clear ? "项目基础概率已清除；后续只显示竞争力。" : "项目基础概率区间已保存；概率只会在证据充分且无硬条件失败时显示。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存基础概率失败。");
    } finally { setWorking(false); }
  }

  async function reveal(target: "private_data" | "material_center") {
    try {
      await json(await fetch("/api/storage/reveal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ target }) }), "无法打开本地目录。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法打开本地目录。");
    }
  }

  async function handleTransferPreview() {
    setWorking(true); setMessage(""); setTransferPreview(undefined); setOverwriteIds(new Set());
    try {
      const to = transferFrom === "local" ? "supabase" : "local";
      const result = await json<TransferPreview>(await fetch("/api/storage/transfer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "preview", from: transferFrom, to }) }), "生成复制预览失败。");
      setTransferPreview(result);
      setMessage(`预览完成：${result.newItems.length} 个新增，${result.conflicts.length} 个冲突。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成复制预览失败。");
    } finally { setWorking(false); }
  }

  async function handleTransfer() {
    if (!transferPreview) return;
    setWorking(true); setMessage("正在复制项目及来源记录…");
    try {
      const result = await json<{ importedIds: string[] }>(await fetch("/api/storage/transfer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "execute", from: transferPreview.from, to: transferPreview.to, overwriteIds: [...overwriteIds] }) }), "复制项目失败。");
      setMessage(`复制完成：已写入 ${result.importedIds.length} 个项目。`);
      setTransferPreview(undefined); setOverwriteIds(new Set());
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "复制项目失败。");
    } finally { setWorking(false); }
  }

  async function handleLegacyMigration() {
    if (!legacy || !window.confirm("将只合并本地 CSV 中尚不存在的 IndexedDB 数据，旧浏览器数据库会保留。继续吗？")) return;
    setWorking(true); setMessage("正在迁移旧浏览器数据和材料文件…");
    try {
      const result = await migrateLegacyIndexedDb("execute");
      window.localStorage.setItem("eu-master-legacy-migrated", new Date().toISOString());
      setLegacy(undefined);
      setMessage(`迁移完成：新增 ${result.imported?.materials ?? 0} 份材料、${result.imported?.applications ?? 0} 个申请。`);
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "IndexedDB 迁移失败。");
    } finally { setWorking(false); }
  }

  async function handleRemoteProfile() {
    setWorking(true);
    try {
      await json(await fetch("/api/storage/remote-profile", { method: "POST" }), "导入远端档案失败。");
      setMessage("Supabase 旧档案已复制到本地 CSV；远端记录未删除。 ");
      setRemoteProfile((current) => current ? { ...current, importedAt: new Date().toISOString() } : current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入远端档案失败。");
    } finally { setWorking(false); }
  }

  async function handleExport() {
    if (exportMode === "encrypted") {
      if (exportPassword.length < 8) { setMessage("加密密码至少需要 8 个字符。"); return; }
      if (exportPassword !== exportPasswordAgain) { setMessage("两次输入的备份密码不一致。"); return; }
    } else if (!window.confirm("普通 ZIP 不加密，任何拿到文件的人都能查看申请数据和材料。仍要继续吗？")) return;
    setWorking(true); setMessage("正在打包本地 CSV 和材料文件…");
    try {
      const backup = await createServerBackup(exportMode === "encrypted" ? exportPassword : undefined);
      downloadBlob(backup.blob, backup.fileName);
      setMessage("备份已经生成并下载。");
      setExportPassword(""); setExportPasswordAgain("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "备份生成失败。");
    } finally { setWorking(false); }
  }

  async function handleInspect() {
    if (!importFile) { setMessage("请先选择备份文件。"); return; }
    setWorking(true); setPreview(undefined); setMessage("正在校验备份完整性…");
    try {
      setPreview(await inspectServerBackup(importFile, importPassword));
      setMessage("备份校验通过。确认数量后再执行恢复。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "备份校验失败。");
    } finally { setWorking(false); }
  }

  async function handleRestore() {
    if (!preview || !importFile || !window.confirm("恢复会替换当前本地 CSV、材料文件和申请工作区。确定继续吗？")) return;
    setWorking(true); setMessage("正在恢复备份，请不要关闭页面…");
    try {
      await restoreServerBackup(importFile, importPassword);
      setMessage("备份恢复完成，页面即将刷新。");
      setTimeout(() => window.location.assign("/dashboard"), 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "恢复失败。");
      setWorking(false);
    }
  }

  const transferTo = transferFrom === "local" ? "supabase" : "local";

  return (
    <div className="dashboard-content content-narrow">
      <header className="page-heading"><div><span className="dashboard-date">存储、评分与备份</span><h1>设置与数据管理</h1><p>个人数据只在本机；Supabase 仅作为可选项目目录。</p></div></header>
      {message && <div className="notice" role="status">{message}</div>}

      <section className="settings-card storage-card">
        <div><span className="panel-label">本地工作区</span><h2>{status?.local.ready ? "运行正常" : "正在检查"}</h2><div className="storage-path-row"><span><strong>Private_Data</strong><code>{status?.local.privateDataDirectory || "正在初始化…"}</code></span><button type="button" onClick={() => reveal("private_data")} title="在访达中显示 Private_Data"><FolderOpen size={16} aria-hidden="true" /></button></div><div className="storage-path-row"><span><strong>material_center</strong><code>{status?.local.materialDirectory || "正在初始化…"}</code></span><button type="button" onClick={() => reveal("material_center")} title="在访达中显示 material_center"><FolderOpen size={16} aria-hidden="true" /></button></div></div>
        <div className="storage-facts"><span><strong>{status?.local.universities ?? 0}</strong> 所学校</span><span><strong>{status?.local.programs ?? 0}</strong> 个项目</span><span><strong>{status?.catalogMode === "local" ? "当前" : "备用"}</strong> 模式</span></div>
        {status?.local.migratedFromLegacy && <p className="storage-migration-status">旧 local-data 已复制并校验，原目录仍保留。</p>}
      </section>

      <section className="settings-card">
        <div className="panel-heading"><div><span className="panel-label">Supabase 诊断</span><h2>{status?.supabase.connected ? "连接正常" : status?.supabase.configured ? "连接失败" : "未配置"}</h2></div><span className={`zero-state-tag ${status?.supabase.connected ? "safe" : "warning"}`}>{status?.supabase.restrictedRole ? "受限角色" : "远端不可用"}</span></div>
        <p>{status?.supabase.error || `${status?.supabase.seededPrograms ?? 0} 个已种子项目；个人信息不会写入 Supabase。`}</p>
        {remoteProfile?.exists && !remoteProfile.importedAt && <button className="button button-outline" type="button" disabled={working} onClick={handleRemoteProfile}>导入 Supabase 旧档案</button>}
      </section>

      <section className="settings-card">
        <div className="panel-heading"><div><span className="panel-label">显式项目复制</span><h2>复制项目、来源与变更历史</h2></div><span className="zero-state-tag">不自动同步</span></div>
        <div className="transfer-controls"><select aria-label="复制来源" value={transferFrom} onChange={(event) => { setTransferFrom(event.target.value as CatalogMode); setTransferPreview(undefined); }}><option value="supabase">Supabase</option><option value="local">本地 CSV</option></select><span>→</span><strong>{transferTo === "local" ? "本地 CSV" : "Supabase"}</strong><button className="button button-outline" type="button" disabled={working} onClick={handleTransferPreview}>生成预览</button></div>
        {transferPreview && <div className="transfer-preview">
          <p>{transferPreview.newItems.length} 个新增项目会直接复制；冲突默认跳过。</p>
          {transferPreview.conflicts.map((item) => <label key={item.id}><input type="checkbox" checked={overwriteIds.has(item.id)} onChange={(event) => setOverwriteIds((current) => { const next = new Set(current); if (event.target.checked) next.add(item.id); else next.delete(item.id); return next; })} /><span><strong>{item.name}</strong><small>{item.reason === "identical" ? "内容相同" : "内容不同"}</small></span></label>)}
          <button className="button button-primary" type="button" disabled={working} onClick={handleTransfer}>复制新增项及所选覆盖项</button>
        </div>}
      </section>

      <section className="settings-card scoring-settings-card">
        <div className="panel-heading"><div><span className="panel-label">加权几何均值</span><h2>评分权重</h2></div><span className="zero-state-tag">每组共 100%</span></div>
        {scoring && <div className="weight-settings-grid"><fieldset><legend>项目目录竞争力</legend>{catalogWeightFields.map(([key, label]) => <label key={key}><span>{label}</span><input type="number" min="0" max="100" step="1" value={scoring.catalog[key]} onChange={(event) => updateWeight("catalog", key, event.target.value)} /><em>%</em></label>)}<strong>合计 {catalogWeightFields.reduce((sum, [key]) => sum + scoring.catalog[key], 0)}%</strong></fieldset><fieldset><legend>项目申请综合指数</legend>{applicationWeightFields.map(([key, label]) => <label key={key}><span>{label}</span><input type="number" min="0" max="100" step="1" value={scoring.application[key]} onChange={(event) => updateWeight("application", key, event.target.value)} /><em>%</em></label>)}<strong>合计 {applicationWeightFields.reduce((sum, [key]) => sum + scoring.application[key], 0)}%</strong></fieldset></div>}
        <button className="button button-primary" type="button" disabled={working || !scoring} onClick={handleSaveWeights}><Save size={15} aria-hidden="true" />保存评分权重</button>
      </section>

      <section className="settings-card probability-settings-card">
        <div className="panel-heading"><div><span className="panel-label">可选项目先验</span><h2>基础录取概率区间</h2></div><span className="zero-state-tag">无先验不显示概率</span></div>
        <div className="form-grid"><label className="full-field">项目<select value={priorProgramId} onChange={(event) => selectPriorProgram(event.target.value)}><option value="">选择项目</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label><label>区间下限（%）<input type="number" min="0.1" max="99" step="0.1" value={priorMinimum} onChange={(event) => setPriorMinimum(event.target.value)} /></label><label>区间上限（%）<input type="number" min="0.1" max="99" step="0.1" value={priorMaximum} onChange={(event) => setPriorMaximum(event.target.value)} /></label><label>申请人数（可选）<input type="number" min="1" step="1" value={priorApplicants} onChange={(event) => setPriorApplicants(event.target.value)} /></label><label>录取人数（可选）<input type="number" min="0" step="1" value={priorAdmitted} onChange={(event) => setPriorAdmitted(event.target.value)} /></label><label>年份 / 批次<input value={priorYear} onChange={(event) => setPriorYear(event.target.value)} /></label><label>来源说明<input value={priorSourceLabel} placeholder="例如 学校公开报录数据 / 用户确认" onChange={(event) => setPriorSourceLabel(event.target.value)} /></label><label className="full-field">来源链接<input type="url" value={priorSourceUrl} placeholder="公开来源可填写精确链接" onChange={(event) => setPriorSourceUrl(event.target.value)} /></label></div>
        <div className="settings-actions"><button className="button button-primary" type="button" disabled={working || !priorProgramId} onClick={() => handleSavePrior(false)}>保存区间</button><button className="button button-outline" type="button" disabled={working || !priorProgramId} onClick={() => handleSavePrior(true)}>清除区间</button></div>
      </section>

      {legacy && <section className="settings-card">
        <div className="panel-heading"><div><span className="panel-label">旧数据迁移</span><h2>IndexedDB 合并预览</h2></div><span className="zero-state-tag">旧库将保留</span></div>
        <div className="storage-facts"><span><strong>{legacy.profile}</strong> 份档案</span><span><strong>{legacy.programs}</strong> 个项目</span><span><strong>{legacy.materials}</strong> 份材料</span><span><strong>{legacy.applications}</strong> 个申请</span></div>
        <button className="button button-primary" type="button" disabled={working} onClick={handleLegacyMigration}>合并新增数据</button>
      </section>}

      <section className="settings-card">
        <div className="panel-heading"><div><span className="panel-label">完整工作区导出</span><h2>创建本地备份</h2></div><span className="zero-state-tag">CSV + 文件</span></div>
        <div className="mode-switch"><button className={exportMode === "encrypted" ? "active" : ""} type="button" onClick={() => setExportMode("encrypted")}><strong>密码加密</strong><small>导出 .eumaster</small></button><button className={exportMode === "plain" ? "active" : ""} type="button" onClick={() => setExportMode("plain")}><strong>普通 ZIP</strong><small>明文压缩包</small></button></div>
        {exportMode === "encrypted" && <div className="form-grid"><label>设置备份密码<input type="password" minLength={8} value={exportPassword} onChange={(event) => setExportPassword(event.target.value)} /></label><label>再次输入密码<input type="password" minLength={8} value={exportPasswordAgain} onChange={(event) => setExportPasswordAgain(event.target.value)} /></label></div>}
        <button className="button button-primary" type="button" disabled={working} onClick={handleExport}>{working ? "处理中…" : "生成并下载备份"}</button>
      </section>

      <section className="settings-card">
        <div className="panel-heading"><div><span className="panel-label">完整恢复</span><h2>校验并导入备份</h2></div><span className="zero-state-tag">先校验</span></div>
        <div className="form-grid"><label className="file-field">备份文件<input type="file" accept=".eumaster,.zip" onChange={(event) => { setImportFile(event.target.files?.[0]); setPreview(undefined); }} /><span>{importFile?.name || "选择 .eumaster 或 .zip"}</span></label><label>备份密码<input type="password" value={importPassword} placeholder="普通 ZIP 可留空" onChange={(event) => setImportPassword(event.target.value)} /></label></div>
        <button className="button button-outline" type="button" disabled={working} onClick={handleInspect}>校验备份</button>
        {preview && <div className="backup-preview"><div><span>导出时间</span><strong>{new Date(preview.exportedAt).toLocaleString("zh-CN")}</strong></div><div><span>项目</span><strong>{preview.summary.programs}</strong></div><div><span>材料</span><strong>{preview.summary.materials}</strong></div><div><span>申请</span><strong>{preview.summary.applications}</strong></div><div><span>文件版本</span><strong>{preview.summary.materialVersions}</strong></div><button className="button button-primary" type="button" disabled={working} onClick={handleRestore}>确认替换当前数据</button></div>}
      </section>

      <div className="notice notice-warning">CSV 是明文文件，仅当前 macOS 用户可访问；敏感数据外发前请使用密码加密备份。</div>
    </div>
  );
}
