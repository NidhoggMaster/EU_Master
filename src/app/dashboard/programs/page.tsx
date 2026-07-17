"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getPrograms, getUniversities, saveProgram } from "@/lib/db";
import { CATEGORY_LABELS, PROGRAM_CATEGORIES, type DiscoveryCandidate, type Program, type ProgramCategory, type University } from "@/lib/types";
import { useLocalQuery } from "@/lib/use-local-query";

async function loadCatalog() {
  const [programs, universities] = await Promise.all([getPrograms(), getUniversities()]);
  return { programs, universities };
}

export default function ProgramsPage() {
  const { data, loading, error, reload } = useLocalQuery("programs", loadCatalog, { programs: [] as Program[], universities: [] as University[] });
  const [universityId, setUniversityId] = useState("all");
  const [category, setCategory] = useState<"all" | ProgramCategory>("all");
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [discoveryUniversity, setDiscoveryUniversity] = useState("");
  const [discoveryCategory, setDiscoveryCategory] = useState<ProgramCategory>("business");
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [message, setMessage] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualUrl, setManualUrl] = useState("");

  const universityMap = useMemo(() => new Map(data.universities.map((item) => [item.id, item])), [data.universities]);
  const visiblePrograms = data.programs.filter((program) => {
    const matchesUniversity = universityId === "all" || program.institutionIds.includes(universityId);
    const matchesCategory = category === "all" || program.categories.includes(category);
    return matchesUniversity && matchesCategory;
  });

  async function handleDiscover() {
    if (!discoveryUniversity) {
      setMessage("请先选择一所大学。");
      return;
    }
    setDiscovering(true);
    setMessage("正在低频读取该校官方硕士目录，请稍候…");
    setCandidates([]);
    try {
      const response = await fetch("/api/catalog/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ universityId: discoveryUniversity, category: discoveryCategory }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "项目发现失败。");
      setCandidates(payload.candidates);
      setMessage(payload.candidates.length ? `找到 ${payload.candidates.length} 个候选，请人工确认。` : "没有找到匹配候选，可使用官网链接手动添加。");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "项目发现失败。");
    } finally {
      setDiscovering(false);
    }
  }

  async function importCandidate(candidate: DiscoveryCandidate) {
    if (data.programs.some((item) => item.sourceUrl.replace(/\/$/, "") === candidate.sourceUrl.replace(/\/$/, ""))) {
      setMessage("该项目已经在目录中。");
      return;
    }
    const timestamp = new Date().toISOString();
    await saveProgram({
      id: crypto.randomUUID(), institutionIds: [candidate.universityId], name: candidate.name,
      categories: [candidate.category], sourceUrl: candidate.sourceUrl, faculty: "", degreeType: "", language: "",
      duration: "", ects: "", mode: "", intakes: [], deadline: "", tuition: "", applicationFee: "",
      applicationPlatform: "", premaster: "", quota: "", requirements: [], createdAt: timestamp, updatedAt: timestamp, seeded: false,
    });
    setCandidates((current) => current.filter((item) => item.sourceUrl !== candidate.sourceUrl));
    setMessage("项目已加入目录，可进入详情页更新官网数据。");
    reload();
  }

  async function addManualProgram(event: React.FormEvent) {
    event.preventDefault();
    const university = data.universities.find((item) => item.id === discoveryUniversity);
    if (!university || !manualName.trim() || !manualUrl.trim()) {
      setMessage("请填写大学、项目名称和官网链接。");
      return;
    }
    try {
      const url = new URL(manualUrl);
      if (url.protocol !== "https:" || !university.allowedHosts.includes(url.hostname)) throw new Error();
      await importCandidate({ name: manualName.trim(), sourceUrl: url.href, universityId: university.id, category: discoveryCategory, matchedKeywords: [] });
      setManualName("");
      setManualUrl("");
    } catch {
      setMessage("链接必须是所选大学的 HTTPS 官方域名。");
    }
  }

  return (
    <div className="dashboard-content">
      <header className="page-heading">
        <div><span className="dashboard-date">荷兰研究型大学</span><h1>项目目录</h1><p>按学校和方向筛选，官网数据只在你手动操作时更新。</p></div>
        <button className="dashboard-primary" type="button" onClick={() => setDiscoveryOpen((value) => !value)}>{discoveryOpen ? "关闭发现" : "＋ 发现新项目"}</button>
      </header>

      {message && <div className="notice" role="status">{message}</div>}
      {error && <div className="notice notice-error" role="alert">{error}</div>}

      {discoveryOpen && (
        <section className="discovery-panel">
          <div className="panel-heading"><div><span className="panel-label">单校＋分类发现</span><h2>读取一所大学的官方项目目录</h2></div><span className="zero-state-tag">手动触发</span></div>
          <div className="filter-row discovery-controls">
            <label>大学<select value={discoveryUniversity} onChange={(event) => setDiscoveryUniversity(event.target.value)}><option value="">选择大学</option>{data.universities.map((item) => <option value={item.id} key={item.id}>{item.shortName} · {item.name}</option>)}</select></label>
            <label>分类<select value={discoveryCategory} onChange={(event) => setDiscoveryCategory(event.target.value as ProgramCategory)}>{PROGRAM_CATEGORIES.map((item) => <option value={item} key={item}>{CATEGORY_LABELS[item]}</option>)}</select></label>
            <button className="button button-primary" disabled={discovering} type="button" onClick={handleDiscover}>{discovering ? "读取中…" : "查找候选"}</button>
          </div>
          {candidates.length > 0 && <div className="candidate-list">{candidates.map((candidate) => <article key={candidate.sourceUrl}><div><strong>{candidate.name}</strong><small>{candidate.matchedKeywords.join(" · ") || "官网链接"}</small></div><a href={candidate.sourceUrl} target="_blank" rel="noreferrer">查看官网</a><button type="button" onClick={() => importCandidate(candidate)}>确认加入</button></article>)}</div>}
          <details className="manual-add">
            <summary>目录无法读取？粘贴官方项目链接</summary>
            <form onSubmit={addManualProgram}>
              <label>项目名称<input value={manualName} onChange={(event) => setManualName(event.target.value)} /></label>
              <label>官方链接<input type="url" value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} /></label>
              <button type="submit">安全检查并加入</button>
            </form>
          </details>
        </section>
      )}

      <section className="catalog-toolbar" aria-label="项目筛选">
        <label>大学<select value={universityId} onChange={(event) => setUniversityId(event.target.value)}><option value="all">全部 14 所大学</option>{data.universities.map((item) => <option value={item.id} key={item.id}>{item.shortName} · {item.name}</option>)}</select></label>
        <label>方向<select value={category} onChange={(event) => setCategory(event.target.value as "all" | ProgramCategory)}><option value="all">全部方向</option>{PROGRAM_CATEGORIES.map((item) => <option value={item} key={item}>{CATEGORY_LABELS[item]}</option>)}</select></label>
        <span>{visiblePrograms.length} 个项目</span>
      </section>

      {loading ? <div className="empty-state">正在读取项目目录…</div> : visiblePrograms.length ? (
        <div className="program-grid">
          {visiblePrograms.map((program) => (
            <article className="program-card" key={program.id}>
              <div className="program-card-top"><span>{program.institutionIds.map((id) => universityMap.get(id)?.shortName).filter(Boolean).join(" × ")}</span><small>{program.seeded ? "内置样例" : "用户添加"}</small></div>
              <h2>{program.name}</h2>
              <div className="tag-row">{program.categories.map((item) => <span key={item}>{CATEGORY_LABELS[item]}</span>)}</div>
              <dl>
                <div><dt>语言</dt><dd>{program.language || "待更新"}</dd></div>
                <div><dt>学制</dt><dd>{program.duration || "待更新"}</dd></div>
                <div><dt>学分</dt><dd>{program.ects || "待更新"}</dd></div>
              </dl>
              <div className="program-card-footer"><span>{program.lastFetchedAt ? `更新于 ${new Date(program.lastFetchedAt).toLocaleDateString("zh-CN")}` : "尚未读取官网数据"}</span><Link href={`/dashboard/programs/${program.id}`}>查看详情 →</Link></div>
            </article>
          ))}
        </div>
      ) : <div className="empty-state"><strong>没有匹配项目</strong><p>调整大学或方向筛选条件。</p></div>}
    </div>
  );
}
