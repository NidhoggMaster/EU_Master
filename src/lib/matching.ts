import type { ApplicantProfile, MaterialType, MatchDimensionScore, ProgramComparison, ProgramDetail } from "./types";
import { eurToCny } from "./exchange-rates";

const weights = { courses: 35, degree: 20, gpa: 15, experience: 15, language: 10, materials: 5 } as const;
const labels = { courses: "先修课及核心课程", degree: "本科学位与专业背景", gpa: "GPA / 成绩条件", experience: "科研、实习和项目经历", language: "语言及标准化考试", materials: "申请材料准备度" } as const;

const taxonomy: Record<string, RegExp> = {
  mathematics: /math|calculus|linear algebra|数学|微积分|线性代数/i,
  statistics: /statistic|probability|econometric|统计|概率|计量/i,
  programming: /program|python|java|c\+\+|software|编程|程序设计/i,
  database: /database|sql|data management|数据库/i,
  information_systems: /information system|informatics|信息系统|信息管理/i,
  business: /business|management|economics|finance|marketing|商科|管理|经济|金融/i,
  research_methods: /research method|methodology|thesis|研究方法|论文/i,
};

export function standardTags(values: string[]) {
  const text = values.join(" ");
  return Object.entries(taxonomy).filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
}

function intersectionRatio(required: string[], actual: string[]) {
  if (!required.length) return 0;
  const set = new Set(actual);
  return required.filter((tag) => set.has(tag)).length / required.length;
}

function score(key: keyof typeof weights, fraction: number, reasons: string[], missingEvidence: string[]): MatchDimensionScore {
  const normalized = Math.max(0, Math.min(1, fraction));
  return { key, label: labels[key], weight: weights[key], score: Math.round(normalized * 100), earned: Math.round(normalized * weights[key] * 10) / 10, reasons, missingEvidence };
}

function jaccard(left: string[], right: string[]) {
  const a = new Set(left); const b = new Set(right); const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  return [...a].filter((value) => b.has(value)).length / union.size;
}

export function similarity(reference: ProgramDetail, candidate: ProgramDetail) {
  const category = jaccard(reference.categories, candidate.categories) * 50;
  const leftTags = standardTags([...reference.coreCourses.map((item) => `${item.name} ${item.tags.join(" ")}`), ...reference.admissionCriteria.flatMap((item) => item.tags)]);
  const rightTags = standardTags([...candidate.coreCourses.map((item) => `${item.name} ${item.tags.join(" ")}`), ...candidate.admissionCriteria.flatMap((item) => item.tags)]);
  const course = jaccard(leftTags, rightTags) * 35;
  const degreeDuration = (reference.degreeType && reference.degreeType === candidate.degreeType ? 7.5 : 0) + (reference.duration && reference.duration === candidate.duration ? 7.5 : 0);
  return Math.round((category + course + degreeDuration) * 10) / 10;
}

export function compareProgram(program: ProgramDetail, profile: ApplicantProfile, readyTypes: MaterialType[], rate: number, reference?: ProgramDetail): ProgramComparison {
  const verified = program.admissionCriteria.filter((item) => item.verificationState === "confirmed" || item.verificationState === "manual");
  const courseCriteria = verified.filter((item) => item.kind === "prerequisite");
  const requiredTags = [...new Set(courseCriteria.flatMap((item) => standardTags([item.title, item.description, ...item.tags])))];
  const applicantTags = standardTags([...profile.courses.map((item) => `${item.name} ${item.category}`), ...profile.skills]);
  const courseScore = score("courses", intersectionRatio(requiredTags, applicantTags), requiredTags.length ? [`已匹配 ${requiredTags.filter((tag) => applicantTags.includes(tag)).length}/${requiredTags.length} 个标准课程标签。`] : [], requiredTags.length ? requiredTags.filter((tag) => !applicantTags.includes(tag)) : ["官网尚无已核验的先修课标签。"]) ;

  const degreeCriteria = verified.filter((item) => item.kind === "degree");
  const degreeText = profile.education.map((item) => `${item.degree} ${item.major}`).join(" ");
  const degreeMet = degreeCriteria.length > 0 && degreeCriteria.some((criterion) => standardTags([criterion.description, ...criterion.tags]).some((tag) => standardTags([degreeText]).includes(tag)) || criterion.tags.some((tag) => degreeText.toLowerCase().includes(tag.toLowerCase())));
  const degreeScore = score("degree", degreeMet ? 1 : 0, degreeMet ? ["个人学位/专业与一项官网背景条件相符。"] : [], degreeCriteria.length ? (degreeMet ? [] : ["尚无证据匹配官网的学位或专业背景条件。"]) : ["官网尚无已核验的学位背景字段。"]) ;

  const gpaCriteria = verified.filter((item) => item.kind === "gpa");
  const applicantGpa = Math.max(0, ...profile.education.map((item) => Number.parseFloat(item.gpa)).filter(Number.isFinite));
  const minimumGpa = Math.max(0, ...gpaCriteria.map((item) => item.minimum ?? 0));
  const gpaMet = gpaCriteria.length > 0 && applicantGpa > 0 && (minimumGpa === 0 || applicantGpa >= minimumGpa);
  const gpaScore = score("gpa", gpaMet ? 1 : 0, gpaMet ? [`已填写 GPA ${applicantGpa}${minimumGpa ? `，达到 ${minimumGpa}` : ""}。`] : [], gpaCriteria.length ? (applicantGpa ? [`GPA ${applicantGpa} 未满足官网最低条件 ${minimumGpa}。`] : ["个人档案未填写可比较的 GPA。"]) : ["官网尚无已核验的 GPA 字段。"]) ;

  const experienceCriteria = verified.filter((item) => item.kind === "experience");
  const experienceMet = experienceCriteria.length > 0 && profile.experiences.some((item) => Boolean(item.title && item.description));
  const experienceScore = score("experience", experienceMet ? 1 : 0, experienceMet ? ["档案中已有可用于说明经历的记录。"] : [], experienceCriteria.length ? (experienceMet ? [] : ["缺少科研、实习或项目经历证据。"]) : ["官网尚无已核验的经历条件。"]) ;

  const languageCriteria = verified.filter((item) => item.kind === "language");
  const languageMet = languageCriteria.length > 0 && languageCriteria.some((criterion) => profile.tests.some((test) => (!criterion.testType || test.type.toLowerCase() === criterion.testType.toLowerCase()) && (!criterion.minimum || Number(test.score) >= criterion.minimum)));
  const languageScore = score("language", languageMet ? 1 : 0, languageMet ? ["已有语言/标准化考试成绩满足一项官网条件。"] : [], languageCriteria.length ? (languageMet ? [] : ["未找到满足官网条件的语言或标准化考试成绩。"]) : ["官网尚无已核验的语言条件。"]) ;

  const requiredMaterials = [...new Set(program.requirements.filter((item) => item.required).map((item) => item.materialType))];
  const readyMaterials = requiredMaterials.filter((type) => readyTypes.includes(type));
  const missingMaterials = requiredMaterials.filter((type) => !readyTypes.includes(type));
  const materialsScore = score("materials", requiredMaterials.length ? readyMaterials.length / requiredMaterials.length : 0, requiredMaterials.length ? [`可提交材料 ${readyMaterials.length}/${requiredMaterials.length} 类。`] : [], requiredMaterials.length ? missingMaterials : ["官网尚无已核验的材料清单。"]) ;

  const dimensions = [courseScore, degreeScore, gpaScore, experienceScore, languageScore, materialsScore];
  const hardRisks: string[] = [];
  if (degreeCriteria.some((item) => item.required) && !degreeMet) hardRisks.push("学位或专业背景条件未满足");
  if (gpaCriteria.some((item) => item.required) && !gpaMet) hardRisks.push("GPA / 成绩条件未满足");
  if (languageCriteria.some((item) => item.required) && !languageMet) hardRisks.push("语言或标准化考试条件未满足");
  const university = program.universities[0];
  const livingMin = university?.livingCostMonthlyMinEur == null ? null : university.livingCostMonthlyMinEur * 12;
  const livingMax = university?.livingCostMonthlyMaxEur == null ? null : university.livingCostMonthlyMaxEur * 12;
  const firstYearMin = program.tuitionEur == null || livingMin == null ? null : program.tuitionEur + livingMin + (program.applicationFeeEur ?? 0);
  const firstYearMax = program.tuitionEur == null || livingMax == null ? null : program.tuitionEur + livingMax + (program.applicationFeeEur ?? 0);
  return {
    program, score: Math.round(dimensions.reduce((sum, item) => sum + item.earned, 0)), dataCompleteness: program.dataCompleteness,
    dimensions, hardRisks, requiredMaterials, readyMaterials, missingMaterials, tuitionEur: program.tuitionEur,
    livingCostAnnualMinEur: livingMin, livingCostAnnualMaxEur: livingMax, firstYearMinEur: firstYearMin, firstYearMaxEur: firstYearMax,
    firstYearMinCny: firstYearMin == null ? null : eurToCny(firstYearMin, rate), firstYearMaxCny: firstYearMax == null ? null : eurToCny(firstYearMax, rate),
    similarity: reference && reference.id !== program.id ? similarity(reference, program) : 100,
  };
}
