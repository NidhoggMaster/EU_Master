"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addCandidate, getPrograms, getUniversities } from "@/lib/catalog-client";
import { cacheCatalogPrograms, cacheDiscoveryCandidates, getLocalCatalogRows } from "@/lib/db";
import { CATEGORY_LABELS, PROGRAM_CATEGORIES, type DiscoveryCandidate, type LocalCatalogRow, type Program, type ProgramCategory, type University } from "@/lib/types";

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
  const [localRows, setLocalRows] = useState<LocalCatalogRow[]>([]);

  async function load() {
    try {
      const [programValues, universityValues] = await Promise.all([
        getPrograms({ universityId: universityId === "all" ? undefined : universityId, category: category === "all" ? undefined : category }),
        universities.length ? Promise.resolve(universities) : getUniversities(),
      ]);
      await cacheCatalogPrograms(programValues, Object.fromEntries(universityValues.map((item) => [item.id, item.name])));
      setPrograms(programValues); setUniversities(universityValues); setMessage("");
      setLocalRows(await getLocalCatalogRows());
    } catch (error) { setMessage(error instanceof Error ? error.message : "读取目录失败。"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let current = true;
    const filters = { universityId: universityId === "all" ? undefined : universityId, category: category === "all" ? undefined : category };
    Promise.all([getPrograms(filters), getUniversities()]).then(([programValues, universityValues]) => {
      return cacheCatalogPrograms(programValues, Object.fromEntries(universityValues.map((item) => [item.id, item.name]))).then(() => [programValues, universityValues] as const);
    }).then(([programValues, universityValues]) => {
      if (!current) return;
      setPrograms(programValues); setUniversities(universityValues); setMessage("");
    }).catch((error) => {
      if (current) setMessage(error instanceof Error ? error.message : "读取目录失败。");
    }).finally(() => {
      if (!current) return;
      setLoading(false); getLocalCatalogRows().then((rows) => current && setLocalRows(rows)).catch(() => undefined);
    });
    return () => { current = false; };
  }, [universityId, category]);

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
      await cacheDiscoveryCandidates(body.candidates, Object.fromEntries(universities.map((item) => [item.id, item.name])));
      setCandidates(body.candidates); setMessage(`官网目录返回 ${body.candidates.length} 个候选；已先与数据库现有记录去重。${body.warnings?.[0] ? ` ${body.warnings[0]}` : ""}`);
      setLocalRows(await getLocalCatalogRows());
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
      setManualName(""); setManualUrl(""); setMessage("项目已写入数据库。"); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "添加失败。"); }
  }

  function exportLocalTable() {
    const columns: Array<[keyof LocalCatalogRow, string]> = [
      ["id","项目 ID"],["status","状态"],["universities","学校"],["programName","项目"],["categories","类型"],["city","城市"],["campus","校区"],
      ["degreeType","学位"],["language","语言"],["duration","学制"],["ects","ECTS"],["coreCourses","核心课程"],["admissionCriteria","招生条件"],
      ["requiredDocuments","所需文件"],["tuitionEur","学费 EUR"],["deadline","截止日期"],["sourceUrl","官网"],["dataCompleteness","完整度"],["lastFetchedAt","官网抓取时间"],["syncedAt","本地同步时间"],
    ];
    const cell = (value: unknown) => {
      let text = value == null ? "" : String(value);
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"','""')}"`;
    };
    const csv = [columns.map(([,label]) => cell(label)).join(","), ...localRows.map((row) => columns.map(([key]) => cell(row[key])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF",csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href=url; anchor.download=`eu-master-programs-${new Date().toISOString().slice(0,10)}.csv`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="dashboard-content">
      <header className="page-heading"><div><span className="dashboard-date">数据库优先 · 官网按需补充</span><h1>项目目录</h1><p>常规筛选只查询私有项目库；官网请求仅在点击按钮后发生。</p></div>{selected.length >= 2 ? <Link className="button button-primary" href={`/dashboard/programs/compare?ids=${selected.join(",")}`}>比较 {selected.length} 个项目 →</Link> : <span className="count-badge">13 个预置样例</span>}</header>
      {message && <div className="notice" role="status">{message}</div>}

      <section className="catalog-toolbar">
        <label>学校<select value={universityId} onChange={(event) => { setLoading(true); setUniversityId(event.target.value); }}><option value="all">全部 14 所大学</option>{universities.map((item) => <option value={item.id} key={item.id}>{item.shortName} · {item.name}</option>)}</select></label>
        <label>项目类型<select value={category} onChange={(event) => { setLoading(true); setCategory(event.target.value as "all" | ProgramCategory); }}><option value="all">全部类型</option>{PROGRAM_CATEGORIES.map((item) => <option value={item} key={item}>{CATEGORY_LABELS[item]}</option>)}</select></label>
        <span>{loading ? "读取中…" : `${programs.length} 个项目`}</span>
      </section>

      {loading ? <div className="empty-state">正在从项目库读取…</div> : programs.length ? <div className="program-grid">{programs.map((program) => {
        const schools = universities.filter((item) => program.institutionIds.includes(item.id));
        const checked = selected.includes(program.id);
        return <article className={`program-card ${checked ? "selected" : ""}`} key={program.id}>
          <div className="program-card-top"><span>{schools.map((item) => item.shortName).join(" + ") || "待关联学校"}</span><label className="compare-check"><input type="checkbox" checked={checked} onChange={() => toggleCompare(program.id)} /> 加入比较</label></div>
          <h2>{program.name}</h2><div className="tag-row">{program.categories.map((item) => <span key={item}>{CATEGORY_LABELS[item]}</span>)}</div>
          <dl><div><dt>地点</dt><dd>{program.city || schools[0]?.city || "待核验"}</dd></div><div><dt>学制</dt><dd>{program.duration || "待核验"}</dd></div><div><dt>学费</dt><dd>{program.tuitionEur == null ? (program.tuition || "待核验") : `€${program.tuitionEur.toLocaleString()}`}</dd></div></dl>
          <p className="program-course-preview">{program.coreCourses.length ? `核心课程：${program.coreCourses.slice(0,3).map((item) => item.name).join("、")}` : "核心课程待官网核验"}</p>
          <div className="program-card-footer"><span>完整度 {program.dataCompleteness}% · {program.lastFetchedAt ? `核验于 ${new Date(program.lastFetchedAt).toLocaleDateString("zh-CN")}` : "尚未首次抓取"}</span><Link href={`/dashboard/programs/${program.id}`}>查看详情 →</Link></div>
        </article>;
      })}</div> : <div className="empty-state"><strong>没有符合条件的项目</strong><p>当前学校与类型交集为空；可调整筛选，或从官网补充搜索。</p></div>}

      <section className="local-catalog-panel">
        <div className="panel-heading"><div><span className="panel-label">IndexedDB 本地表格快照</span><h2>已收集项目信息</h2><p>数据库仍是权威来源；这里保存最近读取、发现和刷新的规范化行，不包含完整网页。</p></div><div className="local-table-actions"><span className="zero-state-tag">{localRows.length} 行</span><button className="button button-outline" type="button" disabled={!localRows.length} onClick={exportLocalTable}>导出 CSV</button></div></div>
        {localRows.length ? <div className="local-table-wrap"><table className="local-catalog-table"><thead><tr><th>状态</th><th>学校</th><th>项目</th><th>类型</th><th>城市 / 校区</th><th>学制 / ECTS</th><th>学费</th><th>核心课程</th><th>完整度</th><th>本地同步</th></tr></thead><tbody>{localRows.map((row) => <tr key={row.id}><td>{row.status}</td><td>{row.universities || row.universityIds.join(" + ")}</td><td><a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.programName}</a></td><td>{row.categories}</td><td>{[row.city,row.campus].filter(Boolean).join(" · ") || "待核验"}</td><td>{[row.duration,row.ects].filter(Boolean).join(" · ") || "待核验"}</td><td>{row.tuitionEur == null ? (row.tuition || "待核验") : `€${row.tuitionEur.toLocaleString()}`}</td><td>{row.coreCourses || "待核验"}</td><td>{row.dataCompleteness}%</td><td>{new Date(row.syncedAt).toLocaleString("zh-CN")}</td></tr>)}</tbody></table></div> : <p className="empty-inline">首次读取项目目录或执行官网发现后，本地表格会自动生成。</p>}
      </section>

      <section className="discovery-panel">
        <div className="panel-heading"><div><span className="panel-label">明确触发官网请求</span><h2>从所选学校官网补充项目</h2></div><button className="button button-outline" type="button" disabled={discovering} onClick={discover}>{discovering ? "正在读取官网…" : "从官网补充搜索"}</button></div>
        {candidates.length > 0 && <div className="candidate-list">{candidates.map((candidate) => <article key={candidate.sourceUrl}><div><strong>{candidate.name}</strong><small>{candidate.sourceUrl}</small></div><a href={candidate.sourceUrl} target="_blank" rel="noreferrer">官网 ↗</a><button disabled={candidate.alreadyActive} type="button" onClick={() => activate(candidate)}>{candidate.alreadyActive ? "已在目录" : "确认入库"}</button></article>)}</div>}
        <details className="manual-add"><summary>官网目录未发现？手动录入一个官方 HTTPS 链接</summary><form onSubmit={addManual}><label>项目名称<input required value={manualName} onChange={(event) => setManualName(event.target.value)} /></label><label>官方项目页<input type="url" required value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} /></label><button type="submit">写入项目库</button></form></details>
      </section>
    </div>
  );
}
