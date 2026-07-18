import type {
  ApplicantProfile,
  AdmissionProbabilityPrior,
  MaterialType,
  MatchDimension,
  MatchDimensionScore,
  ProgramComparison,
  ProgramDetail,
  RequirementMatchOverride,
} from "./types";
import { eurToCny } from "./exchange-rates";
import { livingCostForProgram } from "./living-cost-data";

export const ETS_GRE_COMPARISON_URL = "https://www.ets.org/gre/bschool-comparison-tool.html";
export const CATALOG_SCORE_WEIGHTS: Record<MatchDimension, number> = {
  courses: 30,
  degree: 10,
  gpa: 10,
  experience: 10,
  language: 30,
  materials: 0,
  basicMaterials: 0,
  specialMaterials: 0,
  project: 10,
};
export const APPLICATION_SCORE_WEIGHTS: Record<MatchDimension, number> = {
  courses: 25,
  degree: 5,
  gpa: 5,
  experience: 0,
  language: 25,
  materials: 0,
  basicMaterials: 20,
  specialMaterials: 10,
  project: 10,
};

const labels: Record<MatchDimension, string> = {
  courses: "先修课与课程匹配",
  degree: "本科学位与专业",
  gpa: "GPA / 成绩条件",
  experience: "科研、实习与项目经历",
  language: "IELTS / GRE / GMAT",
  materials: "材料准备度",
  basicMaterials: "基本材料",
  specialMaterials: "项目特需材料",
  project: "项目竞争因素",
};

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

function dimension(key: MatchDimension, fraction: number, known: boolean, reasons: string[], missingEvidence: string[]): MatchDimensionScore {
  const normalized = Math.max(0, Math.min(1, fraction));
  return {
    key,
    label: labels[key],
    weight: CATALOG_SCORE_WEIGHTS[key],
    score: Math.round(normalized * 100),
    earned: Math.round(normalized * CATALOG_SCORE_WEIGHTS[key] * 10) / 10,
    reasons,
    missingEvidence,
    known,
  };
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
  return Math.round(Math.min(100, category + course + degreeDuration) * 10) / 10;
}

export function weightedGeometricScore(dimensions: MatchDimensionScore[]) {
  const weighted = dimensions.filter((item) => item.weight > 0 && item.known);
  const knownWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0);
  const coverage = totalWeight ? Math.round(knownWeight / totalWeight * 100) : 0;
  if (!knownWeight || coverage < 60) return { score: null, coverage };
  const logarithm = weighted.reduce((sum, item) => sum + item.weight * Math.log(Math.max(0.05, item.score / 100)), 0) / knownWeight;
  return { score: Math.round(Math.exp(logarithm) * 100), coverage };
}

function numeric(value: string | undefined) {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function requirementScore(minimum: number | null, actual: number | null) {
  if (minimum == null || actual == null) return null;
  if (actual >= minimum) return 1;
  return Math.max(0, actual / minimum);
}

function languageDimension(program: ProgramDetail, profile: ApplicantProfile) {
  const requirements = program.testRequirements;
  if (requirements.length) {
    const scores: number[] = [];
    const missing: string[] = [];
    const reasons: string[] = [];
    for (const requirement of requirements.filter((item) => item.required)) {
      const test = profile.tests.find((item) => item.type === requirement.test);
      if (!test) { missing.push(`未填写 ${requirement.test} 成绩`); continue; }
      const parts = [
        requirementScore(requirement.minimumTotal, numeric(test.score)),
        requirementScore(requirement.minimumVerbal, numeric(test.verbal)),
        requirementScore(requirement.minimumQuantitative, numeric(test.quantitative)),
        requirementScore(requirement.minimumWriting, numeric(test.writing)),
        requirementScore(requirement.minimumListening, numeric(test.listening)),
        requirementScore(requirement.minimumReading, numeric(test.reading)),
        requirementScore(requirement.minimumSpeaking, numeric(test.speaking)),
      ].filter((value): value is number => value != null);
      if (parts.length) {
        scores.push(Math.min(...parts));
        reasons.push(`${requirement.test} 已按总分及已公布小分逐项比较。`);
      } else missing.push(`${requirement.test} 官网门槛或个人分项不完整`);
    }
    return dimension("language", scores.length ? Math.max(...scores) : 0, Boolean(scores.length), reasons, missing);
  }
  const criteria = program.admissionCriteria.filter((item) => item.kind === "language" && item.verificationState !== "pending");
  if (!criteria.length) return dimension("language", 0, false, [], ["官网尚无结构化 IELTS / GRE / GMAT 门槛。"]) ;
  const matched = criteria.some((criterion) => profile.tests.some((test) => (!criterion.testType || test.type === criterion.testType) && (!criterion.minimum || (numeric(test.score) ?? 0) >= criterion.minimum)));
  return dimension("language", matched ? 1 : 0, true, matched ? ["已有标化成绩满足一项官网门槛。"] : [], matched ? [] : ["标化成绩未达到已识别门槛。"]);
}

export function baseProbabilityInterval(prior: AdmissionProbabilityPrior) {
  const total = prior.applicantCount;
  const successes = prior.admittedCount;
  if (total && successes != null && total > 0 && successes >= 0 && successes <= total) {
    const z = 1.96;
    const proportion = successes / total;
    const denominator = 1 + z * z / total;
    const centre = (proportion + z * z / (2 * total)) / denominator;
    const margin = z * Math.sqrt((proportion * (1 - proportion) + z * z / (4 * total)) / total) / denominator;
    return { minimum: Math.max(0.001, centre - margin), maximum: Math.min(0.999, centre + margin) };
  }
  return { minimum: prior.minimum, maximum: prior.maximum };
}

function probabilityInterval(program: ProgramDetail, score: number | null, hardRisks: string[]) {
  const prior = program.admissionProbabilityPrior;
  if (!prior || score == null || hardRisks.length) return { minimum: null, maximum: null };
  const base = baseProbabilityInterval(prior);
  const adjust = (value: number) => {
    const probability = Math.max(0.001, Math.min(0.999, value));
    const shifted = Math.log(probability / (1 - probability)) + 0.8 * ((score - 50) / 25);
    return Math.max(1, Math.min(99, Math.round(100 / (1 + Math.exp(-shifted)))));
  };
  return { minimum: adjust(base.minimum), maximum: adjust(base.maximum) };
}

export function compareProgram(
  program: ProgramDetail,
  profile: ApplicantProfile,
  readyTypes: MaterialType[],
  rate: number,
  reference?: ProgramDetail,
  overrides: RequirementMatchOverride[] = [],
  weights: Record<MatchDimension, number> = CATALOG_SCORE_WEIGHTS,
): ProgramComparison {
  const verified = program.admissionCriteria.filter((item) => item.verificationState === "confirmed" || item.verificationState === "manual");
  const courseCriteria = verified.filter((item) => item.kind === "prerequisite");
  const requiredTags = [...new Set(courseCriteria.flatMap((item) => standardTags([item.title, item.description, ...item.tags])))];
  const applicantTags = standardTags([...profile.courses.map((item) => `${item.name} ${item.category}`), ...profile.skills]);
  const overrideValues = courseCriteria.map((criterion) => overrides.find((item) => item.programId === program.id && item.criterionId === criterion.id)?.state).filter(Boolean);
  const overrideFraction = overrideValues.length ? overrideValues.reduce((sum, state) => sum + (state === "matched" ? 1 : state === "partial" ? 0.5 : 0), 0) / overrideValues.length : null;
  const courseFraction = overrideFraction ?? intersectionRatio(requiredTags, applicantTags);
  const courseScore = dimension("courses", courseFraction, Boolean(courseCriteria.length && (requiredTags.length || overrideValues.length)), overrideValues.length ? ["已采用手工确认的课程匹配。"] : requiredTags.length ? [`匹配 ${requiredTags.filter((tag) => applicantTags.includes(tag)).length}/${requiredTags.length} 个课程标签。`] : [], courseCriteria.length ? requiredTags.filter((tag) => !applicantTags.includes(tag)) : ["官网尚无结构化先修课。"]);

  const degreeCriteria = verified.filter((item) => item.kind === "degree");
  const degreeText = profile.education.map((item) => `${item.degree} ${item.major}`).join(" ");
  const degreeMet = degreeCriteria.some((criterion) => standardTags([criterion.description, ...criterion.tags]).some((tag) => standardTags([degreeText]).includes(tag)) || criterion.tags.some((tag) => degreeText.toLowerCase().includes(tag.toLowerCase())));
  const degreeScore = dimension("degree", degreeMet ? 1 : 0, Boolean(degreeCriteria.length && profile.education.length), degreeMet ? ["学历或专业与官网背景条件相符。"] : [], degreeCriteria.length ? (profile.education.length ? ["未匹配官网专业背景条件。"] : ["个人中心未填写学历。"] ) : ["官网尚无结构化学历条件。"]);

  const gpaCriteria = verified.filter((item) => item.kind === "gpa");
  const applicantGpa = Math.max(0, ...profile.education.map((item) => numeric(item.gpa) ?? 0));
  const minimumGpa = Math.max(0, ...gpaCriteria.map((item) => item.minimum ?? 0));
  const gpaKnown = Boolean(gpaCriteria.length && applicantGpa);
  const gpaMet = gpaKnown && (!minimumGpa || applicantGpa >= minimumGpa);
  const gpaScore = dimension("gpa", minimumGpa && applicantGpa ? Math.min(1, applicantGpa / minimumGpa) : gpaMet ? 1 : 0, gpaKnown, gpaMet ? [`GPA ${applicantGpa} 达到已识别门槛。`] : [], gpaCriteria.length ? (applicantGpa ? [`GPA ${applicantGpa} 低于 ${minimumGpa}。`] : ["个人中心未填写可比较 GPA。"] ) : ["官网尚无结构化 GPA 条件。"]);

  const experienceCriteria = verified.filter((item) => item.kind === "experience");
  const experienceKnown = Boolean(experienceCriteria.length && profile.experiences.length);
  const experienceMet = experienceKnown && profile.experiences.some((item) => Boolean(item.title && item.description));
  const experienceScore = dimension("experience", experienceMet ? 1 : 0, experienceKnown, experienceMet ? ["已有经历记录可对应官网条件。"] : [], experienceCriteria.length ? ["缺少可核对的经历证据。"] : ["官网未明确要求经历。"]);
  const testScore = languageDimension(program, profile);

  const requiredMaterials = [...new Set(program.requirements.filter((item) => item.required).map((item) => item.materialType))];
  const readyMaterials = requiredMaterials.filter((type) => readyTypes.includes(type));
  const missingMaterials = requiredMaterials.filter((type) => !readyTypes.includes(type));
  const materialsScore = dimension("materials", requiredMaterials.length ? readyMaterials.length / requiredMaterials.length : 0, Boolean(requiredMaterials.length), requiredMaterials.length ? [`已准备 ${readyMaterials.length}/${requiredMaterials.length} 类材料。`] : [], requiredMaterials.length ? missingMaterials : ["官网尚无材料清单。"]);

  const prior = program.admissionProbabilityPrior;
  const projectScore = dimension("project", prior ? Math.max(0.05, Math.min(1, (prior.minimum + prior.maximum) / 2)) : 0, Boolean(prior), prior ? [`基础概率区间来自 ${prior.sourceLabel}。`] : [], prior ? [] : ["没有带来源的报录比或基础概率。"]);
  const dimensions = [courseScore, degreeScore, gpaScore, experienceScore, testScore, materialsScore, projectScore]
    .map((item) => ({ ...item, weight: weights[item.key] ?? 0, earned: Math.round(item.score * (weights[item.key] ?? 0)) / 100 }));
  const hardRisks: string[] = [];
  if (degreeCriteria.some((item) => item.required) && degreeScore.known && !degreeMet) hardRisks.push("学位或专业背景条件未满足");
  if (gpaCriteria.some((item) => item.required) && gpaScore.known && !gpaMet) hardRisks.push("GPA / 成绩条件未满足");
  if ((program.testRequirements.some((item) => item.required) || verified.some((item) => item.kind === "language" && item.required)) && testScore.known && testScore.score < 100) hardRisks.push("语言或标准化考试条件未满足");
  const aggregate = weightedGeometricScore(dimensions);
  const probability = probabilityInterval(program, aggregate.score, hardRisks);
  const livingCost = livingCostForProgram(program, program.universities);
  const livingMin = livingCost ? livingCost.monthlyMinEur * 12 : null;
  const livingMax = livingCost ? livingCost.monthlyMaxEur * 12 : null;
  const firstYearMin = program.tuitionEur == null || livingMin == null ? null : program.tuitionEur + livingMin + (program.applicationFeeEur ?? 0);
  const firstYearMax = program.tuitionEur == null || livingMax == null ? null : program.tuitionEur + livingMax + (program.applicationFeeEur ?? 0);
  return {
    program, score: aggregate.score, evidenceCoverage: aggregate.coverage, probabilityMinimum: probability.minimum, probabilityMaximum: probability.maximum,
    scoreStatus: hardRisks.length ? "hard_risk" : aggregate.score == null ? "insufficient" : "ready",
    dataCompleteness: program.dataCompleteness, dimensions, hardRisks, requiredMaterials, readyMaterials, missingMaterials, tuitionEur: program.tuitionEur,
    livingCostAnnualMinEur: livingMin, livingCostAnnualMaxEur: livingMax, firstYearMinEur: firstYearMin, firstYearMaxEur: firstYearMax,
    firstYearMinCny: firstYearMin == null ? null : eurToCny(firstYearMin, rate), firstYearMaxCny: firstYearMax == null ? null : eurToCny(firstYearMax, rate),
    similarity: reference && reference.id !== program.id ? similarity(reference, program) : 100,
  };
}
