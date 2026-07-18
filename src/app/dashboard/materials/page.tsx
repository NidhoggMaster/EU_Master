"use client";

import { useState } from "react";
import { MATERIAL_TYPES, MATERIAL_TYPE_LABELS, type Material, type MaterialType, type StoredMaterialVersion } from "@/lib/types";
import { useLocalQuery } from "@/lib/use-local-query";
import { addMaterialVersion, createMaterial, deleteMaterial, getMaterials, getMaterialVersions, updateMaterial } from "@/lib/workspace-client";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];

function validateFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(extension)) throw new Error("仅支持 PDF、Word、JPG 和 PNG 文件。");
  if (file.size > MAX_FILE_SIZE) throw new Error("单个文件不能超过 20 MB。");
  if (!file.size) throw new Error("不能上传空文件。");
}

function fileSize(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
}

export default function MaterialsPage() {
  const { data: materials, loading, error, reload } = useLocalQuery("materials", getMaterials, [] as Material[]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MaterialType>("transcript");
  const [status, setStatus] = useState<Material["status"]>("draft");
  const [file, setFile] = useState<File>();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string>();
  const [versions, setVersions] = useState<Record<string, StoredMaterialVersion[]>>({});

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !file) {
      setMessage("请填写材料名称并选择文件。");
      return;
    }
    try {
      validateFile(file);
      setSaving(true);
      await createMaterial(title.trim(), type, status, file);
      setTitle(""); setFile(undefined); setStatus("draft");
      const input = document.getElementById("material-file") as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage("材料和第一个版本已保存在本地数据目录。");
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "材料保存失败，浏览器空间可能不足。");
    } finally {
      setSaving(false);
    }
  }

  async function handleNewVersion(material: Material, nextFile?: File) {
    if (!nextFile) return;
    try {
      validateFile(nextFile);
      await addMaterialVersion(material.id, nextFile);
      setVersions((current) => ({ ...current, [material.id]: [] }));
      setMessage(`已为“${material.title}”创建新版本。`);
      reload();
      if (expanded === material.id) await toggleVersions(material.id, true);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "新版本保存失败。");
    }
  }

  async function toggleVersions(materialId: string, force = false) {
    if (expanded === materialId && !force) {
      setExpanded(undefined);
      return;
    }
    const items = await getMaterialVersions(materialId);
    setVersions((current) => ({ ...current, [materialId]: items }));
    setExpanded(materialId);
  }

  async function handleStatus(material: Material, nextStatus: Material["status"]) {
    await updateMaterial({ ...material, status: nextStatus });
    reload();
  }

  async function handleDelete(material: Material) {
    if (!window.confirm(`确定删除“${material.title}”及全部历史版本吗？`)) return;
    await deleteMaterial(material.id);
    setMessage("材料已删除，无法从应用内恢复。");
    reload();
  }

  return (
    <div className="dashboard-content">
      <header className="page-heading"><div><span className="dashboard-date">本地文件与版本</span><h1>材料中心</h1><p>文件只保存在当前电脑的数据目录，不会写入 Supabase。</p></div><span className="count-badge">{materials.length} 份材料</span></header>
      {(message || error) && <div className={`notice ${error ? "notice-error" : ""}`} role="status">{error || message}</div>}

      <section className="upload-panel">
        <div><span className="panel-label">添加材料</span><h2>保存新的申请文件</h2><p>支持 PDF、DOC/DOCX、JPG、PNG，单文件不超过 20 MB。</p></div>
        <form onSubmit={handleCreate}>
          <label>材料名称<input value={title} placeholder="例如 本科成绩单" onChange={(event) => setTitle(event.target.value)} /></label>
          <label>材料类型<select value={type} onChange={(event) => setType(event.target.value as MaterialType)}>{MATERIAL_TYPES.map((item) => <option value={item} key={item}>{MATERIAL_TYPE_LABELS[item]}</option>)}</select></label>
          <label>准备状态<select value={status} onChange={(event) => setStatus(event.target.value as Material["status"])}><option value="draft">准备中</option><option value="ready">可提交</option><option value="expired">已过期</option></select></label>
          <label className="file-field">选择文件<input id="material-file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(event) => setFile(event.target.files?.[0])} /><span>{file ? `${file.name} · ${fileSize(file.size)}` : "点击选择本地文件"}</span></label>
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? "保存中…" : "保存材料"}</button>
        </form>
      </section>

      {loading ? <div className="empty-state">正在读取材料…</div> : materials.length ? (
        <div className="material-list">
          {materials.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((material) => (
            <article className="material-card" key={material.id}>
              <div className="material-icon">{MATERIAL_TYPE_LABELS[material.type].slice(0, 1)}</div>
              <div className="material-copy"><strong>{material.title}</strong><small>{MATERIAL_TYPE_LABELS[material.type]} · 更新于 {new Date(material.updatedAt).toLocaleDateString("zh-CN")}</small></div>
              <select aria-label={`${material.title}准备状态`} value={material.status} onChange={(event) => handleStatus(material, event.target.value as Material["status"])}><option value="draft">准备中</option><option value="ready">可提交</option><option value="expired">已过期</option></select>
              <div className="material-actions">
                <button type="button" onClick={() => toggleVersions(material.id)}>{expanded === material.id ? "收起版本" : "查看版本"}</button>
                <label>上传新版<input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(event) => { handleNewVersion(material, event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
                <button className="danger-link" type="button" onClick={() => handleDelete(material)}>删除</button>
              </div>
              {expanded === material.id && (
                <div className="version-list">
                  {(versions[material.id] ?? []).map((version) => <div key={version.id}><span><strong>v{version.version}</strong>{version.fileName}<small>{fileSize(version.size)} · {new Date(version.createdAt).toLocaleString("zh-CN")}</small></span><a className="button button-secondary" href={version.downloadUrl} download={version.fileName}>下载</a></div>)}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : <div className="empty-state"><strong>还没有材料</strong><p>从成绩单、简历或语言成绩开始整理。</p></div>}
    </div>
  );
}
