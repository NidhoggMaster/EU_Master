"use client";

import { useEffect, useState } from "react";
import { getRemoteProfile, saveRemoteProfile } from "@/lib/profile-api";
import { applicantProfileSchema } from "@/lib/profile-schema";
import { emptyProfile, profileCompletion } from "@/lib/progress";
import type { ApplicantProfile, Course, EducationRecord, Experience, TestScore } from "@/lib/types";

const newEducation = (): EducationRecord => ({ id: crypto.randomUUID(), institution: "", degree: "", major: "", gpa: "", startYear: "", endYear: "" });
const newCourse = (): Course => ({ id: crypto.randomUUID(), name: "", grade: "", credits: "", category: "" });
const newTest = (): TestScore => ({ id: crypto.randomUUID(), type: "IELTS", score: "", testDate: "" });
const newExperience = (): Experience => ({ id: crypto.randomUUID(), type: "实习", organization: "", title: "", startDate: "", endDate: "", description: "" });
export default function ProfilePage() {
  const [profile, setProfile] = useState<ApplicantProfile>(emptyProfile());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getRemoteProfile()
      .then((value) => value && setProfile(value))
      .catch((reason) => setMessage(reason instanceof Error ? reason.message : "读取档案失败，请刷新重试。"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const validation = applicantProfileSchema.safeParse(profile);
    if (!validation.success) {
      setMessage(validation.error.issues[0]?.message || "档案字段格式不正确。");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const next = { ...profile, updatedAt: new Date().toISOString() };
      const saved = await saveRemoteProfile(next);
      setProfile(saved);
      setMessage("个人档案已通过后端安全写入 Supabase。");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "个人档案保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  function updateCollection<T extends EducationRecord | Course | TestScore | Experience>(
    key: "education" | "courses" | "tests" | "experiences",
    index: number,
    patch: Partial<T>,
  ) {
    setProfile((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function removeCollection(key: "education" | "courses" | "tests" | "experiences", index: number) {
    setProfile((current) => ({ ...current, [key]: current[key].filter((_item, itemIndex) => itemIndex !== index) }));
  }

  const completion = profileCompletion(profile);

  return (
    <div className="dashboard-content content-narrow">
      <header className="page-heading">
        <div><span className="dashboard-date">结构化申请档案</span><h1>个人档案</h1><p>分项记录背景信息，后续可直接对应项目要求。</p></div>
        <div className="completion-chip"><strong>{completion}%</strong><span>已完成</span></div>
      </header>
      {loading && <div className="notice">正在读取档案…</div>}
      {message && <div className="notice" role="status">{message}</div>}

      <form className="stack-form" onSubmit={handleSave}>
        <section className="form-section">
          <div className="section-title"><span>01</span><div><h2>基本信息</h2><p>姓名与当前身份信息</p></div></div>
          <div className="form-grid">
            <label>姓名<input value={profile.basic.fullName} onChange={(event) => setProfile({ ...profile, basic: { ...profile.basic, fullName: event.target.value } })} /></label>
            <label>邮箱<input type="email" value={profile.basic.email} onChange={(event) => setProfile({ ...profile, basic: { ...profile.basic, email: event.target.value } })} /></label>
            <label>国籍<input value={profile.basic.nationality} onChange={(event) => setProfile({ ...profile, basic: { ...profile.basic, nationality: event.target.value } })} /></label>
            <label>当前城市<input value={profile.basic.currentCity} onChange={(event) => setProfile({ ...profile, basic: { ...profile.basic, currentCity: event.target.value } })} /></label>
          </div>
        </section>

        <section className="form-section">
          <div className="section-title section-title-action"><span>02</span><div><h2>教育经历</h2><p>学校、学位、专业和 GPA</p></div><button type="button" onClick={() => setProfile({ ...profile, education: [...profile.education, newEducation()] })}>＋ 添加</button></div>
          {!profile.education.length && <p className="empty-inline">尚未添加教育经历。</p>}
          {profile.education.map((item, index) => (
            <div className="repeat-card" key={item.id}>
              <div className="form-grid">
                <label>学校<input value={item.institution} onChange={(event) => updateCollection<EducationRecord>("education", index, { institution: event.target.value })} /></label>
                <label>学位<input value={item.degree} placeholder="例如 Bachelor of Science" onChange={(event) => updateCollection<EducationRecord>("education", index, { degree: event.target.value })} /></label>
                <label>专业<input value={item.major} onChange={(event) => updateCollection<EducationRecord>("education", index, { major: event.target.value })} /></label>
                <label>GPA<input value={item.gpa} onChange={(event) => updateCollection<EducationRecord>("education", index, { gpa: event.target.value })} /></label>
                <label>开始年份<input inputMode="numeric" value={item.startYear} onChange={(event) => updateCollection<EducationRecord>("education", index, { startYear: event.target.value })} /></label>
                <label>结束年份<input inputMode="numeric" value={item.endYear} onChange={(event) => updateCollection<EducationRecord>("education", index, { endYear: event.target.value })} /></label>
              </div>
              <button className="text-danger" type="button" onClick={() => removeCollection("education", index)}>删除这条经历</button>
            </div>
          ))}
        </section>

        <section className="form-section">
          <div className="section-title section-title-action"><span>03</span><div><h2>核心课程</h2><p>用于证明数学、统计、编程和商科背景</p></div><button type="button" onClick={() => setProfile({ ...profile, courses: [...profile.courses, newCourse()] })}>＋ 添加</button></div>
          {!profile.courses.length && <p className="empty-inline">尚未添加课程。</p>}
          {profile.courses.map((item, index) => (
            <div className="repeat-card compact" key={item.id}>
              <div className="form-grid form-grid-four">
                <label>课程名称<input value={item.name} onChange={(event) => updateCollection<Course>("courses", index, { name: event.target.value })} /></label>
                <label>成绩<input value={item.grade} onChange={(event) => updateCollection<Course>("courses", index, { grade: event.target.value })} /></label>
                <label>学分<input value={item.credits} onChange={(event) => updateCollection<Course>("courses", index, { credits: event.target.value })} /></label>
                <label>类别<input value={item.category} placeholder="数学 / 统计 / 编程" onChange={(event) => updateCollection<Course>("courses", index, { category: event.target.value })} /></label>
              </div>
              <button className="text-danger" type="button" onClick={() => removeCollection("courses", index)}>删除</button>
            </div>
          ))}
        </section>

        <section className="form-section">
          <div className="section-title section-title-action"><span>04</span><div><h2>考试成绩</h2><p>语言、GRE 或 GMAT</p></div><button type="button" onClick={() => setProfile({ ...profile, tests: [...profile.tests, newTest()] })}>＋ 添加</button></div>
          {!profile.tests.length && <p className="empty-inline">尚未添加考试成绩。</p>}
          {profile.tests.map((item, index) => (
            <div className="repeat-card compact" key={item.id}>
              <div className="form-grid form-grid-three">
                <label>考试<select value={item.type} onChange={(event) => updateCollection<TestScore>("tests", index, { type: event.target.value as TestScore["type"] })}><option>IELTS</option><option>TOEFL</option><option>GRE</option><option>GMAT</option><option>其他</option></select></label>
                <label>成绩<input value={item.score} onChange={(event) => updateCollection<TestScore>("tests", index, { score: event.target.value })} /></label>
                <label>考试日期<input type="date" value={item.testDate} onChange={(event) => updateCollection<TestScore>("tests", index, { testDate: event.target.value })} /></label>
              </div>
              <button className="text-danger" type="button" onClick={() => removeCollection("tests", index)}>删除</button>
            </div>
          ))}
        </section>

        <section className="form-section">
          <div className="section-title section-title-action"><span>05</span><div><h2>经历与奖项</h2><p>实习、项目、科研和奖项</p></div><button type="button" onClick={() => setProfile({ ...profile, experiences: [...profile.experiences, newExperience()] })}>＋ 添加</button></div>
          {!profile.experiences.length && <p className="empty-inline">尚未添加经历。</p>}
          {profile.experiences.map((item, index) => (
            <div className="repeat-card" key={item.id}>
              <div className="form-grid">
                <label>类型<select value={item.type} onChange={(event) => updateCollection<Experience>("experiences", index, { type: event.target.value as Experience["type"] })}><option>实习</option><option>项目</option><option>科研</option><option>奖项</option><option>其他</option></select></label>
                <label>机构<input value={item.organization} onChange={(event) => updateCollection<Experience>("experiences", index, { organization: event.target.value })} /></label>
                <label>名称 / 职位<input value={item.title} onChange={(event) => updateCollection<Experience>("experiences", index, { title: event.target.value })} /></label>
                <label>时间<input value={`${item.startDate}${item.endDate ? ` — ${item.endDate}` : ""}`} placeholder="例如 2025.06 — 2025.09" onChange={(event) => updateCollection<Experience>("experiences", index, { startDate: event.target.value, endDate: "" })} /></label>
                <label className="full-field">简述<textarea rows={3} value={item.description} onChange={(event) => updateCollection<Experience>("experiences", index, { description: event.target.value })} /></label>
              </div>
              <button className="text-danger" type="button" onClick={() => removeCollection("experiences", index)}>删除这条经历</button>
            </div>
          ))}
        </section>

        <section className="form-section">
          <div className="section-title"><span>06</span><div><h2>技能</h2><p>使用逗号分隔</p></div></div>
          <label className="wide-label">技能<input value={profile.skills.join(", ")} placeholder="Python, SQL, Tableau" onChange={(event) => setProfile({ ...profile, skills: event.target.value.split(/[,，]/).map((value) => value.trim()).filter(Boolean) })} /></label>
        </section>

        <section className="form-section">
          <div className="section-title"><span>07</span><div><h2>申请偏好</h2><p>目标方向、入学时间与就业偏好</p></div></div>
          <div className="form-grid">
            <label>目标专业<input value={profile.preferences.fields.join(", ")} placeholder="信息系统, 数据科学" onChange={(event) => setProfile({ ...profile, preferences: { ...profile.preferences, fields: event.target.value.split(/[,，]/).map((value) => value.trim()).filter(Boolean) } })} /></label>
            <label>目标入学时间<input value={profile.preferences.intake} onChange={(event) => setProfile({ ...profile, preferences: { ...profile.preferences, intake: event.target.value } })} /></label>
            <label>预算<input value={profile.preferences.budget} placeholder="例如 €35,000 / 年" onChange={(event) => setProfile({ ...profile, preferences: { ...profile.preferences, budget: event.target.value } })} /></label>
            <label>城市偏好<input value={profile.preferences.cityPreference} onChange={(event) => setProfile({ ...profile, preferences: { ...profile.preferences, cityPreference: event.target.value } })} /></label>
            <label className="full-field">就业偏好<textarea rows={3} value={profile.preferences.employmentPreference} onChange={(event) => setProfile({ ...profile, preferences: { ...profile.preferences, employmentPreference: event.target.value } })} /></label>
          </div>
        </section>

        <div className="sticky-save"><span>档案完成度 {completion}% · Supabase 云端存储</span><button className="dashboard-primary" type="submit" disabled={loading || saving}>{saving ? "正在保存…" : "保存个人档案"}</button></div>
      </form>
    </div>
  );
}
