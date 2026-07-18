"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { addCandidate, getPrograms, getUniversities } from "@/lib/catalog-client";
import { CATEGORY_LABELS, PROGRAM_CATEGORIES, type DiscoveryCandidate, type Program, type ProgramCategory, type University } from "@/lib/types";

type Candidate = DiscoveryCandidate & { id?: string; alreadyActive?: boolean };

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState("all");
  const [category, setCategory] = useState<"all" | ProgramCategory>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");

  async function load() {
    try {
      const [programValues, universityValues] = await Promise.all([
        getPrograms({ universityId: universityId === "all" ? undefined : universityId, category: category === "all" ? undefined : category }),
        universities.length ? Promise.resolve(universities) : getUniversities(),
      ]);
      setPrograms(programValues); setUniversities(universityValues); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "读取目录失败。"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let current = true;
    const filters = { universityId: universityId === "all" ? undefined : universityId, category: category === "all" ? undefined : category };
    getUniversities().then((values) => { if (current) setUniversities(values); }).catch((error) => { if (current) setMessage(error instanceof Error ? error.message : "读取学校配置失败。"); });
    getPrograms(filters).then((values) => { if (current) { setPrograms(values); setMessage(""); } }).catch((error) => { if (current) { setPrograms([]); setMessage(error instanceof Error ? error.message : "读取目录失败。"); } }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [universityId, category]);

  useEffect(() => {
    const saved = window.localStorage.getItem("eu-master-program-view");
    if (saved === "cards") Promise.resolve("cards" as const).then(setViewMode);
  }, []);

  function selectView(mode: "list" | "cards") {
    setViewMode(mode);
    window.localStorage.setItem("eu-master-program-view", mode);
  }

  function toggleCompare(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 4) { setMessage("一次最多比较 4 个项目。"); return current; }
      return [...current, id];
    });
  }

  async function discover() {
    if (universityId === "all" || category === "all") { setMessage("官网补充搜索需要先选择一所学校和一个项目类型。"); return; }
    setDiscovering(true); setMessage(""); setCandidates([]);
    try {
      const response = await fetch("/api/catalog/discover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ universityId, category }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "官网搜索失败。");
      setCandidates(body.candidates); setMessage(`官网目录返回 ${body.candidates.length} 个候选；已先与数据库现有记录去重。${body.warnings?.[0] ? ` ${body.warnings[0]}` : ""}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "官网搜索失败。"); }
    finally { setDiscovering(false); }
  }

  async function activate(candidate: Candidate) {
    const stored = await addCandidate({ universityId: candidate.universityId, name: candidate.name, category: candidate.category, sourceUrl: candidate.sourceUrl, status: "active" });
    setCandidates((items) => items.map((item) => item.sourceUrl === candidate.sourceUrl ? { ...item, alreadyActive: true, id: stored.id } : item));
    await load();
  }

  async function addManual(event: React.FormEvent) {
    event.preventDefault();
    if (universityId === "all" || category === "all") { setMessage("手动添加前请选择学校和项目类型。"); return; }
    try {
      await addCandidate({ universityId, name: manualName.trim(), category, sourceUrl: manualUrl.trim(), status: "active" });
      setManualName(""); setManualUrl(""); setMessage("项目已写入当前项目库。"); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "添加失败。"); }
  }

  return (
    <div className="dashboard-content">
      <header className="page-heading"><div><span className="dashboard-date">本地 CSV 默认 · 官网按需补充</span><h1>项目目录</h1><p>学校配置始终来自本机；项目按顶栏所选模式读取。</p></div>{selected.length >= 2 ? <Link className="button button-primary" href={`/dashboard/programs/compare?ids=${selected.join(",")}`}>比较 {selected.length} 个项目 →</Link> : <span className="count-badge">{programs.length} 个项目</span>}</header>
      {message && <div className="notice" role="status">{message}</div>}

      <section className="catalog-toolbar">
        <label>学校<select value={universityId} onChange={(event) => { setLoading(true); setUniversityId(event.target.value); }}><option value="all">全部 14 所大学</option>{universities.map((item) => <option value={item.id} key={item.id}>{item.shortName} · {item.name}</option>)}</select></label>
        <label>项目类型<select value={category} onChange={(event) => { setLoading(true); setCategory(event.target.value as "all" | ProgramCategory); }}><option value="all">全部类型</option>{PROGRAM_CATEGORIES.map((item) => <option value={item} key={item}>{CATEGORY_LABELS[item]}</option>)}</select></label>
        <div className="catalog-view-switch" role="group" aria-label="项目排列方式"><button className={viewMode === "list" ? "active" : ""} type="button" onClick={() => selectView("list")} title="单行列表"><List size={15} aria-hidden="true" /></button><button className={viewMode === "cards" ? "active" : ""} type="button" onClick={() => selectView("cards")} title="双列卡片"><LayoutGrid size={15} aria-hidden="true" /></button></div>
        <span>{loading ? "读取中…" : `${programs.length} 个项目`}</span>
      </section>

      {loading ? <div className="empty-state">正在从项目库读取…</div> : programs.length ? <div className={`program-grid program-grid-${viewMode}`}>{programs.map((program) => {
        const schools = universities.filter((item) => program.institutionIds.includes(item.id));
        const checked = selected.includes(program.id);
        return <article className={`program-card ${checked ? "selected" : ""}`} key={program.id}>
          <div className="program-card-top"><span>{schools.map((item) => item.shortName).join(" + ") || "待关联学校"}</span><label className="compare-check"><input type="checkbox" checked={checked} onChange={() => toggleCompare(program.id)} /> 加入比较</label></div>
          <h2>{program.name}</h2><div className="tag-row">{program.categories.map((item) => <span key={item}>{CATEGORY_LABELS[item]}</span>)}</div>
          <dl><div><dt>地点</dt><dd>{program.city || schools[0]?.city || "待核验"}</dd></div><div><dt>学制</dt><dd>{program.duration || "待核验"}</dd></div><div><dt>学费</dt><dd>{program.tuitionEur == null ? (program.tuition || "待核验") : `€${program.tuitionEur.toLocaleString()}`}</dd></div></dl>
          <p className="program-course-preview">{program.coreCourses.length ? `核心课程：${program.coreCourses.slice(0,3).map((item) => item.name).join("、")}` : "核心课程待官网核验"}</p>
          <div className="program-card-footer"><span>完整度 {program.dataCompleteness}% · {program.lastFetchedAt ? `核验于 ${new Date(program.lastFetchedAt).toLocaleDateString("zh-CN")}` : "尚未首次抓取"}</span><Link href={`/dashboard/programs/${program.id}`}>查看详情 →</Link></div>
        </article>;
      })}</div> : message ? <div className="empty-state"><strong>项目目录读取失败</strong><p>{message}</p></div> : <div className="empty-state"><strong>没有符合条件的项目</strong><p>当前项目库没有匹配项；可调整筛选，或从官网补充搜索。</p></div>}

      <section className="discovery-panel">
        <div className="panel-heading"><div><span className="panel-label">明确触发官网请求</span><h2>从所选学校官网补充项目</h2></div><button className="button button-outline" type="button" disabled={discovering} onClick={discover}>{discovering ? "正在读取官网…" : "从官网补充搜索"}</button></div>
        {candidates.length > 0 && <div className="candidate-list">{candidates.map((candidate) => <article key={candidate.sourceUrl}><div><strong>{candidate.name}</strong><small>{candidate.sourceUrl}</small></div><a href={candidate.sourceUrl} target="_blank" rel="noreferrer">官网 ↗</a><button disabled={candidate.alreadyActive} type="button" onClick={() => activate(candidate)}>{candidate.alreadyActive ? "已在目录" : "确认入库"}</button></article>)}</div>}
        <details className="manual-add"><summary>官网目录未发现？手动录入一个官方 HTTPS 链接</summary><form onSubmit={addManual}><label>项目名称<input required value={manualName} onChange={(event) => setManualName(event.target.value)} /></label><label>官方项目页<input type="url" required value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} /></label><button type="submit">写入项目库</button></form></details>
      </section>
    </div>
  );
}
