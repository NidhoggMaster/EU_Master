"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FileUp, FolderOpen, History, Trash2 } from "lucide-react";
import { getPrograms } from "@/lib/catalog-client";
import { MATERIAL_TYPES, MATERIAL_TYPE_LABELS, type Material, type MaterialType, type Program, type StoredMaterialVersion } from "@/lib/types";
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
  const [programs, setPrograms] = useState<Program[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MaterialType>("transcript");
  const [scope, setScope] = useState<Material["scope"]>("basic");
  const [programId, setProgramId] = useState("");
  const [prepared, setPrepared] = useState(false);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File>();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string>();
  const [versions, setVersions] = useState<Record<string, StoredMaterialVersion[]>>({});

  useEffect(() => { getPrograms().then(setPrograms).catch(() => undefined); }, []);
  const programMap = useMemo(() => new Map(programs.map((program) => [program.id, program.name])), [programs]);
  const basicMaterials = useMemo(() => [...materials].filter((material) => !material.archived && material.scope === "basic").sort((a, b) => a.title.localeCompare(b.title, "zh-CN")), [materials]);
  const programMaterials = useMemo(() => [...materials].filter((material) => !material.archived && material.scope === "program").sort((a, b) => (programMap.get(a.programId) ?? "").localeCompare(programMap.get(b.programId) ?? "", "zh-CN") || a.title.localeCompare(b.title, "zh-CN")), [materials, programMap]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setMessage("请填写材料名称。");
      return;
    }
    if (scope === "program" && !programId) {
      setMessage("项目特需材料需要选择所属项目。");
      return;
    }
    try {
      if (file) validateFile(file);
      setSaving(true);
      await createMaterial(title.trim(), type, prepared ? "ready" : "draft", file, { scope, programId: scope === "program" ? programId : "", prepared, notes });
      setTitle("");
      setFile(undefined);
      setPrepared(false);
      setNotes("");
      const input = document.getElementById("material-file") as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage(file ? "清单项和首个文件版本已保存到 material_center。" : "清单项已保存；可以稍后上传文件版本。");
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "材料保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleNewVersion(material: Material, nextFile?: File) {
    if (!nextFile) return;
    try {
      validateFile(nextFile);
      await addMaterialVersion(material.id, nextFile);
      setMessage(`已为“${material.title}”保存新文件版本。`);
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
    try {
      const items = await getMaterialVersions(materialId);
      setVersions((current) => ({ ...current, [materialId]: items }));
      setExpanded(materialId);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "读取材料版本失败。");
    }
  }

  async function togglePrepared(material: Material) {
    const nextPrepared = !material.prepared;
    await updateMaterial({ ...material, prepared: nextPrepared, status: nextPrepared ? "ready" : "draft" });
    reload();
  }

  async function handleDelete(material: Material) {
    if (!window.confirm(`确定删除“${material.title}”及全部文件版本吗？已被申请引用的材料不能删除。`)) return;
    try {
      await deleteMaterial(material.id);
      setMessage("材料已删除。");
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "材料删除失败。");
    }
  }

  async function openFolder() {
    const response = await fetch("/api/storage/reveal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ target: "material_center" }) });
    const body = await response.json();
    if (!response.ok) setMessage(body.error || "无法打开材料目录。");
  }

  function renderMaterial(material: Material) {
    return <article className={`material-check-item ${material.prepared ? "prepared" : ""}`} key={material.id}>
      <button className="material-check" type="button" aria-label={material.prepared ? `取消完成 ${material.title}` : `标记完成 ${material.title}`} onClick={() => togglePrepared(material)}>{material.prepared && <Check size={16} aria-hidden="true" />}</button>
      <div className="material-copy"><strong>{material.title}</strong><small>{MATERIAL_TYPE_LABELS[material.type]} · {material.currentVersionId ? "已有本地文件" : "仅清单"} · 更新于 {new Date(material.updatedAt).toLocaleDateString("zh-CN")}</small>{material.notes && <p>{material.notes}</p>}</div>
      <div className="material-actions">
        <button type="button" onClick={() => toggleVersions(material.id)} title="查看文件版本"><History size={15} aria-hidden="true" /><span>{expanded === material.id ? "收起" : "版本"}</span></button>
        <label title="上传新文件版本"><FileUp size={15} aria-hidden="true" /><span>上传</span><input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(event) => { void handleNewVersion(material, event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
        <button className="danger-link" type="button" onClick={() => handleDelete(material)} title="删除材料"><Trash2 size={15} aria-hidden="true" /></button>
      </div>
      {expanded === material.id && <div className="version-list">{(versions[material.id] ?? []).length ? (versions[material.id] ?? []).map((version) => <div key={version.id}><span><strong>v{version.version}</strong>{version.fileName}<small>{fileSize(version.size)} · {new Date(version.createdAt).toLocaleString("zh-CN")}</small></span><a className="button button-secondary" href={version.downloadUrl} download={version.fileName}>下载</a></div>) : <p className="empty-inline">尚未上传文件；清单状态仍可独立勾选。</p>}</div>}
    </article>;
  }

  return <div className="dashboard-content materials-page">
    <header className="page-heading"><div><span className="dashboard-date">清单与文件版本分离</span><h1>材料中心</h1><p>准备状态可以直接勾选；文件只保存在本机 material_center。</p></div><button className="button button-outline" type="button" onClick={openFolder}><FolderOpen size={15} aria-hidden="true" />在访达中显示</button></header>
    {(message || error) && <div className={`notice ${error ? "notice-error" : ""}`} role="status">{error || message}</div>}

    <section className="upload-panel material-create-panel">
      <div><span className="panel-label">添加清单项</span><h2>新材料</h2><p>文件可选，支持 PDF、Word、JPG 和 PNG，单文件不超过 20 MB。</p></div>
      <form onSubmit={handleCreate}>
        <label>材料名称<input required value={title} placeholder="例如 本科成绩单" onChange={(event) => setTitle(event.target.value)} /></label>
        <label>材料类型<select value={type} onChange={(event) => setType(event.target.value as MaterialType)}>{MATERIAL_TYPES.map((item) => <option value={item} key={item}>{MATERIAL_TYPE_LABELS[item]}</option>)}</select></label>
        <label>用途<select value={scope} onChange={(event) => setScope(event.target.value as Material["scope"])}><option value="basic">基本材料</option><option value="program">项目特需</option></select></label>
        {scope === "program" && <label>所属项目<select required value={programId} onChange={(event) => setProgramId(event.target.value)}><option value="">选择项目</option>{programs.map((program) => <option value={program.id} key={program.id}>{program.name}</option>)}</select></label>}
        <label className="material-prepared-input"><input type="checkbox" checked={prepared} onChange={(event) => setPrepared(event.target.checked)} />已准备</label>
        <label className="file-field">文件（可选）<input id="material-file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(event) => setFile(event.target.files?.[0])} /><span>{file ? `${file.name} · ${fileSize(file.size)}` : "暂不上传"}</span></label>
        <label className="full-field">备注<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <button className="button button-primary" type="submit" disabled={saving}>{saving ? "保存中" : "添加材料"}</button>
      </form>
    </section>

    {loading ? <div className="empty-state">正在读取材料…</div> : <div className="material-groups">
      <section><div className="panel-heading"><div><span className="panel-label">可跨项目复用</span><h2>基本材料</h2></div><span className="count-badge">{basicMaterials.filter((item) => item.prepared).length}/{basicMaterials.length}</span></div>{basicMaterials.length ? <div className="material-check-list">{basicMaterials.map(renderMaterial)}</div> : <p className="empty-inline">尚未建立基本材料清单。</p>}</section>
      <section><div className="panel-heading"><div><span className="panel-label">按项目归档</span><h2>项目特需材料</h2></div><span className="count-badge">{programMaterials.filter((item) => item.prepared).length}/{programMaterials.length}</span></div>{programMaterials.length ? <div className="material-check-list">{programMaterials.map((material) => <div className="program-material-block" key={material.id}><span>{programMap.get(material.programId) || "未关联项目"}</span>{renderMaterial(material)}</div>)}</div> : <p className="empty-inline">尚未建立项目特需材料清单。</p>}</section>
    </div>}
  </div>;
}
