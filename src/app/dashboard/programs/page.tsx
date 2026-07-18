"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, LayoutGrid, List, RefreshCw } from "lucide-react";
import { addCandidate, getPrograms, getUniversities } from "@/lib/catalog-client";
import { livingCostForProgram } from "@/lib/living-cost-data";
import {
  CATEGORY_LABELS,
  PROGRAM_CATEGORIES,
  type DiscoveryCandidate,
  type Program,
  type ProgramCategory,
  type ScoreSnapshot,
  type University,
} from "@/lib/types";

type Candidate = DiscoveryCandidate & { id?: string; alreadyActive?: boolean };
type StoredScore = ScoreSnapshot & { stale: boolean };
type SortKey = "default" | "competitiveness" | "ielts" | "gre" | "premaster";

function requiredScore(program: Program, test: "IELTS" | "GRE") {
  const requirement = program.testRequirements.find((item) => item.test === test && item.required);
  return requirement?.minimumTotal ?? null;
}

function testLabel(program: Program, test: "IELTS" | "GRE") {
  const requirement = program.testRequirements.find((item) => item.test === test);
  if (!requirement) return "未披露";
  if (!requirement.required) return "不要求";
  if (requirement.comparisonReference) return requirement.comparisonReference;
  return requirement.minimumTotal == null ? "要求，未注明分数" : `${requirement.minimumTotal}+`;
}

function premasterLabel(program: Program) {
  const info = program.premasterInfo;
  if (!info) return "未披露";
  if (info.supported === "no") return "不支持";
  if (info.nonEuEligible === "yes") return "支持非欧盟";
  if (info.nonEuEligible === "no") return "非欧盟不可申请";
  return info.supported === "yes" ? "支持，非欧盟待确认" : "未明确";
}

function euro(value: number | null | undefined) {
  return value == null ? "未披露" : `€${Math.round(value).toLocaleString("en-US")}`;
}

function tuitionLabel(program: Program) {
  if (program.tuitionEur != null) return euro(program.tuitionEur);
  return program.tuition.includes("待官网确认") ? "待确认" : "未披露";
}

function rankingLabel(program: Program) {
  const world = program.rankings.filter((ranking) => ranking.scope === "university").map((ranking) => ranking.rank);
  const subjects = program.rankings.filter((ranking) => ranking.scope === "subject").map((ranking) => ranking.rank);
  if (!world.length && !subjects.length) return "QS 排名待录入";
  return [`QS 2027 ${world.join(" / ")}`, subjects.length ? `相关学科 2026 ${subjects.join(" / ")}` : ""].filter(Boolean).join(" · ");
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [scores, setScores] = useState<StoredScore[]>([]);
  const [universityId, setUniversityId] = useState("all");
  const [category, setCategory] = useState<"all" | ProgramCategory>("all");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [message, setMessage] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");

  async function load() {
    const filters = {
      universityId: universityId === "all" ? undefined : universityId,
      category: category === "all" ? undefined : category,
    };
    try {
      const [programValues, universityValues] = await Promise.all([
        getPrograms(filters),
        universities.length ? Promise.resolve(universities) : getUniversities(),
      ]);
      setPrograms(programValues);
      setUniversities(universityValues);
      if (programValues.length) {
        const response = await fetch(`/api/catalog/scores?programIds=${programValues.map((item) => item.id).join(",")}`, { cache: "no-store" });
        if (response.ok) setScores(await response.json());
      } else {
        setScores([]);
      }
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取目录失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let current = true;
    const filters = {
      universityId: universityId === "all" ? undefined : universityId,
      category: category === "all" ? undefined : category,
    };
    Promise.all([getUniversities(), getPrograms(filters)])
      .then(async ([universityValues, programValues]) => {
        if (!current) return;
        setUniversities(universityValues);
        setPrograms(programValues);
        const response = programValues.length
          ? await fetch(`/api/catalog/scores?programIds=${programValues.map((item) => item.id).join(",")}`, { cache: "no-store" })
          : null;
        if (current) setScores(response?.ok ? await response.json() : []);
        if (current) setMessage("");
      })
      .catch((error) => {
        if (!current) return;
        setPrograms([]);
        setMessage(error instanceof Error ? error.message : "读取项目目录失败。");
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [universityId, category]);

  useEffect(() => {
    const saved = window.localStorage.getItem("eu-master-program-view");
    if (saved === "cards") Promise.resolve("cards" as const).then(setViewMode);
  }, []);

  const universityMap = useMemo(() => new Map(universities.map((item) => [item.id, item])), [universities]);
  const scoreMap = useMemo(() => new Map(scores.map((item) => [item.programId, item])), [scores]);
  const displayedPrograms = useMemo(() => {
    const values = [...programs];
    if (sortKey === "competitiveness") {
      values.sort((left, right) => (scoreMap.get(right.id)?.score ?? -1) - (scoreMap.get(left.id)?.score ?? -1));
    } else if (sortKey === "ielts" || sortKey === "gre") {
      const test = sortKey === "ielts" ? "IELTS" : "GRE";
      values.sort((left, right) => (requiredScore(left, test) ?? Number.POSITIVE_INFINITY) - (requiredScore(right, test) ?? Number.POSITIVE_INFINITY));
    } else if (sortKey === "premaster") {
      values.sort((left, right) => Number(right.premasterInfo?.nonEuEligible === "yes") - Number(left.premasterInfo?.nonEuEligible === "yes"));
    } else {
      values.sort((left, right) => left.name.localeCompare(right.name, "en"));
    }
    return values;
  }, [programs, scoreMap, sortKey]);

  function selectView(mode: "list" | "cards") {
    setViewMode(mode);
    window.localStorage.setItem("eu-master-program-view", mode);
  }

  function toggleCompare(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 8) {
        setMessage("一次最多比较 8 个项目。");
        return current;
      }
      return [...current, id];
    });
  }

  async function confirmScores() {
    if (!programs.length) return;
    setCalculating(true);
    setMessage("");
    try {
      const response = await fetch("/api/catalog/scores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ programIds: programs.map((item) => item.id) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "竞争力计算失败。");
      setScores(body.snapshots.map((item: ScoreSnapshot) => ({ ...item, stale: false })));
      setMessage("竞争力已按当前档案、课程与项目要求确认。资料变化后需要重新确认。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "竞争力计算失败。");
    } finally {
      setCalculating(false);
    }
  }

  async function discover() {
    if (universityId === "all" || category === "all") {
      setMessage("官网补充搜索需要先选择一所学校和一个项目类型。");
      return;
    }
    setDiscovering(true);
    setMessage("");
    setCandidates([]);
    try {
      const response = await fetch("/api/catalog/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ universityId, category }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "官网搜索失败。");
      setCandidates(body.candidates);
      setMessage(`官网目录返回 ${body.candidates.length} 个候选。${body.warnings?.[0] ? ` ${body.warnings[0]}` : ""}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "官网搜索失败。");
    } finally {
      setDiscovering(false);
    }
  }

  async function activate(candidate: Candidate) {
    const stored = await addCandidate({
      universityId: candidate.universityId,
      name: candidate.name,
      category: candidate.category,
      sourceUrl: candidate.sourceUrl,
      status: "active",
    });
    setCandidates((items) => items.map((item) => item.sourceUrl === candidate.sourceUrl ? { ...item, alreadyActive: true, id: stored.id } : item));
    await load();
  }

  async function addManual(event: React.FormEvent) {
    event.preventDefault();
    if (universityId === "all" || category === "all") {
      setMessage("手动添加前请选择学校和项目类型。");
      return;
    }
    try {
      await addCandidate({ universityId, name: manualName.trim(), category, sourceUrl: manualUrl.trim(), status: "active" });
      setManualName("");
      setManualUrl("");
      setMessage("项目已写入当前项目库。");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "添加失败。");
    }
  }

  return (
    <div className="dashboard-content catalog-page">
      <header className="page-heading">
        <div><span className="dashboard-date">2027+ 入学 · 非欧盟申请标准</span><h1>项目目录</h1><p>项目要求来自官网；竞争力需按当前个人资料手动确认。</p></div>
        <div className="page-heading-actions">
          <button className="button button-outline" type="button" disabled={calculating || loading || !programs.length} onClick={confirmScores}><RefreshCw size={15} aria-hidden="true" />{calculating ? "计算中" : "确认计算"}</button>
          {selected.length >= 2
            ? <Link className="button button-primary" href={`/dashboard/compare?ids=${selected.join(",")}`}>比较 {selected.length} 个项目 <ArrowRight size={15} aria-hidden="true" /></Link>
            : <span className="count-badge">已选 {selected.length}/8</span>}
        </div>
      </header>
      {message && <div className="notice" role="status">{message}</div>}

      <section className="catalog-toolbar">
        <label>学校<select value={universityId} onChange={(event) => { setLoading(true); setUniversityId(event.target.value); }}><option value="all">全部 14 所大学</option>{universities.map((item) => <option value={item.id} key={item.id}>{item.shortName} · {item.name}</option>)}</select></label>
        <label>项目类型<select value={category} onChange={(event) => { setLoading(true); setCategory(event.target.value as "all" | ProgramCategory); }}><option value="all">全部类型</option>{PROGRAM_CATEGORIES.map((item) => <option value={item} key={item}>{CATEGORY_LABELS[item]}</option>)}</select></label>
        <label>排序<select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}><option value="default">项目名称</option><option value="competitiveness">竞争力</option><option value="ielts">IELTS 要求</option><option value="gre">GRE 要求</option><option value="premaster">Pre-master 支持</option></select></label>
        <div className="catalog-view-switch" role="group" aria-label="项目排列方式"><button className={viewMode === "list" ? "active" : ""} type="button" onClick={() => selectView("list")} title="单行列表"><List size={15} aria-hidden="true" /></button><button className={viewMode === "cards" ? "active" : ""} type="button" onClick={() => selectView("cards")} title="双列卡片"><LayoutGrid size={15} aria-hidden="true" /></button></div>
        <span>{loading ? "读取中" : `${displayedPrograms.length} 个项目`}</span>
      </section>

      <section className="dashboard-panel ranking-overview" aria-labelledby="ranking-overview-title">
        <div><span className="panel-label">QS 2026 相关学科</span><h2 id="ranking-overview-title">申请方向速览</h2></div>
        <div className="ranking-overview-grid">
          <article><strong>第一梯队</strong><p>UvA Information Studies 的 Data Science、Information 与 CS 三个口径最强。</p></article>
          <article><strong>第二梯队</strong><p>VU Information Sciences / DBI、Utrecht Business Informatics、TU/e + Tilburg JADS。</p></article>
          <article><strong>商科更强</strong><p>Tilburg Information Management 应按管理信息系统判断；商科与经济排名明显强于纯 CS。</p></article>
          <article><strong>结合匹配度</strong><p>Maastricht、Twente、Radboud 更应同时看课程、录取匹配、就业地点与实习资源。</p></article>
        </div>
      </section>

      {loading ? <div className="empty-state">正在读取项目目录…</div> : displayedPrograms.length ? (
        <div className={`catalog-results catalog-results-${viewMode}`}>
          {displayedPrograms.map((program) => {
            const schools = program.institutionIds.map((id) => universityMap.get(id)).filter(Boolean) as University[];
            const school = schools[0];
            const score = scoreMap.get(program.id);
            const livingCost = livingCostForProgram(program, schools);
            const livingMin = livingCost ? livingCost.monthlyMinEur * 12 : null;
            const livingMax = livingCost ? livingCost.monthlyMaxEur * 12 : null;
            const checked = selected.includes(program.id);
            return <article className={`catalog-program ${checked ? "selected" : ""}`} key={program.id}>
              <div className="catalog-program-select"><input aria-label={`比较 ${program.name}`} type="checkbox" checked={checked} onChange={() => toggleCompare(program.id)} /></div>
              <div className="catalog-program-identity">
                <span>{schools.map((item) => item.shortName).join(" + ") || "待关联学校"} · {program.city || school?.city || "地点未披露"}</span>
                <h2><a href={program.applicationLinks.programUrl || program.sourceUrl} target="_blank" rel="noreferrer">{program.name}<ExternalLink size={14} aria-hidden="true" /></a></h2>
                <small>{program.categories.map((item) => CATEGORY_LABELS[item]).join(" / ")} · 完整度 {program.dataCompleteness}%</small>
                <small className="catalog-program-ranking">{rankingLabel(program)}</small>
              </div>
              <dl className="catalog-program-facts">
                <div><dt>学制</dt><dd>{program.duration || "未披露"}</dd></div>
                <div><dt>学费</dt><dd>{tuitionLabel(program)}</dd></div>
                <div><dt>生活费 / 年</dt><dd>{livingMin == null ? "未披露" : `${euro(livingMin)}–${euro(livingMax ?? livingMin)}`}</dd></div>
                <div><dt>竞争力</dt><dd className={score?.stale ? "score-stale" : ""}>{score?.score == null ? (score ? `${score.evidenceCoverage}% 证据` : "待确认") : `${Math.round(score.score)} / 100`}{score?.stale ? " · 已过期" : ""}</dd></div>
                <div><dt>IELTS</dt><dd>{testLabel(program, "IELTS")}</dd></div>
                <div><dt>GRE</dt><dd>{testLabel(program, "GRE")}</dd></div>
                <div><dt>Pre-master</dt><dd>{premasterLabel(program)}</dd></div>
              </dl>
              <div className="catalog-program-actions"><Link href={`/dashboard/programs/${program.id}`} title="查看项目详情"><span>项目详情</span><ArrowRight size={16} aria-hidden="true" /></Link></div>
            </article>;
          })}
        </div>
      ) : message ? <div className="empty-state"><strong>项目目录读取失败</strong><p>{message}</p></div> : <div className="empty-state"><strong>没有符合条件的项目</strong><p>调整筛选，或从学校官网补充项目。</p></div>}

      <section className="discovery-panel">
        <div className="panel-heading"><div><span className="panel-label">项目补充</span><h2>读取学校官网目录</h2></div><button className="button button-outline" type="button" disabled={discovering} onClick={discover}>{discovering ? "正在读取官网" : "搜索官网"}</button></div>
        {candidates.length > 0 && <div className="candidate-list">{candidates.map((candidate) => <article key={candidate.sourceUrl}><div><strong>{candidate.name}</strong><small>{candidate.sourceUrl}</small></div><a href={candidate.sourceUrl} target="_blank" rel="noreferrer">官网 <ExternalLink size={13} aria-hidden="true" /></a><button disabled={candidate.alreadyActive} type="button" onClick={() => activate(candidate)}>{candidate.alreadyActive ? "已在目录" : "确认入库"}</button></article>)}</div>}
        <details className="manual-add"><summary>手动录入官方链接</summary><form onSubmit={addManual}><label>项目名称<input required value={manualName} onChange={(event) => setManualName(event.target.value)} /></label><label>官方项目页<input type="url" required value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} /></label><button type="submit">写入项目库</button></form></details>
      </section>
    </div>
  );
}
