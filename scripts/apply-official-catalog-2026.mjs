import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const ETS_GRE_COMPARISON_URL = "https://www.ets.org/gre/bschool-comparison-tool.html";
const STUDIELINK_URL = "https://www.studielink.nl/";
const TILBURG_TUITION_RATES_URL = "https://www.tilburguniversity.edu/sites/default/files/download/Instellingstarieven%20voor%20masteropleidingen%202026-2027.pdf";
const TILBURG_TUITION_ROADMAP_URL = "https://landbot.pro/v3/H-3098416-R73QZFJEEIQN3TAL/index.html";
const TILBURG_LIVING_COST_URL = "https://www.tilburguniversity.edu/education/masters-programs/tuition-fees-scholarships#:~:text=Estimated%20monthly%20costs,200%C2%A0per%20year";
const FETCHED_AT = new Date().toISOString();
const BACKGROUND_PLATFORMS = ["官网", "小红书", "Reddit", "B站", "YouTube", "知乎", "留学论坛/平台"];

function fact(sourceUrl, originalText, summaryZh, sourceTitle) {
  return { sourceUrl, sourceTitle, originalText, summaryZh, fetchedAt: FETCHED_AT, origin: "official", locked: false };
}

function overview(title, originalText, summaryZh, sourceUrl) {
  return { title, ...fact(sourceUrl, originalText, summaryZh, "项目官网") };
}

function criterion(id, kind, title, description, sourceUrl, options = {}) {
  return {
    id,
    kind,
    title,
    description,
    required: options.required ?? true,
    tags: options.tags ?? [],
    minimum: options.minimum,
    testType: options.testType,
    sourceUrl,
    verificationState: "confirmed",
    creditsEcts: options.creditsEcts ?? null,
    summaryZh: options.summaryZh ?? description,
  };
}

function requirement(id, materialType, title, originalText, summaryZh, sourceUrl, options = {}) {
  return {
    id,
    category: options.category ?? "申请材料",
    materialType,
    required: options.required ?? true,
    title,
    titleOriginal: options.titleOriginal ?? title,
    originalText,
    summaryZh,
    structuredRequirement: summaryZh,
    intake: options.intake ?? "2026/27",
    sourceUrl,
    fetchedAt: FETCHED_AT,
    verificationState: "confirmed",
    confidence: 1,
  };
}

function test(id, testName, sourceUrl, originalText, summaryZh, values = {}) {
  return {
    id,
    test: testName,
    required: values.required ?? true,
    minimumTotal: values.minimumTotal ?? null,
    minimumVerbal: values.minimumVerbal ?? null,
    minimumQuantitative: values.minimumQuantitative ?? null,
    minimumWriting: values.minimumWriting ?? null,
    minimumListening: values.minimumListening ?? null,
    minimumReading: values.minimumReading ?? null,
    minimumSpeaking: values.minimumSpeaking ?? null,
    scoreEdition: values.scoreEdition ?? "",
    comparisonReference: values.comparisonReference ?? "",
    comparisonUrl: values.comparisonUrl ?? "",
    ...fact(sourceUrl, originalText, summaryZh, "考试要求官网"),
  };
}

function date(id, intake, audience, kind, value, originalText, summaryZh, sourceUrl) {
  return { id, intake, audience, kind, date: value, ...fact(sourceUrl, originalText, summaryZh, "申请时间官网") };
}

function course(name, nameZh, sourceUrl, options = {}) {
  return {
    name,
    nameZh,
    tags: options.tags ?? [],
    creditsEcts: options.creditsEcts ?? null,
    sourceUrl,
    originalText: options.originalText ?? name,
    summaryZh: options.summaryZh ?? nameZh,
  };
}

function career(id, roles, employers, originalText, summaryZh, sourceUrl) {
  return { id, roles, employers, ...fact(sourceUrl, originalText, summaryZh, "就业官网") };
}

function premaster(supported, nonEuEligible, requirements, originalText, summaryZh, sourceUrl) {
  return { supported, nonEuEligible, requirements, ...fact(sourceUrl, originalText, summaryZh, "Pre-master 官网") };
}

function chinaBackground(policy, evidenceLevel, listName, originalText, summaryZh, communityConclusion, sourceUrl, references) {
  return {
    policy,
    evidenceLevel,
    listName,
    communityConclusion,
    platformsChecked: BACKGROUND_PLATFORMS,
    references: [
      { platform: "official", title: "当前官网规则", url: sourceUrl, note: originalText, relevance: "school" },
      ...references,
    ],
    ...fact(sourceUrl, originalText, summaryZh, "中国院校背景规则与社区参考"),
  };
}

function tilburgRequirements(prefix, sourceUrl, extras = []) {
  return [
    requirement(`${prefix}-passport`, "passport", "护照 / 身份证件", "Copy passport or ID card.", "按官网有效期与身份页要求上传。", sourceUrl),
    requirement(`${prefix}-diploma`, "degree_certificate", "学位与毕业证明", "Bachelor's and Master's diploma(s), or an official graduation statement when applicable.", "未毕业时按要求提交临时材料，录取后补认证件。", sourceUrl),
    requirement(`${prefix}-transcript`, "transcript", "正式成绩单", "Official transcript of records, signed and stamped, including current and exchange grades.", "需为学校正式成绩单；交换成绩一并提交。", sourceUrl),
    requirement(`${prefix}-cssd`, "other", "中国学历 CSSD 验证", "Chinese applicants must upload English Online Verification Reports for diploma, graduation certificate and transcript via CSSD.", "中国申请人需准备学位、毕业证及成绩单的英文在线验证报告。", sourceUrl),
    requirement(`${prefix}-translations`, "other", "正式翻译件", "Official sworn translations must be attached to stamped copies when documents are not in English or Dutch.", "非英语/荷兰语文件需提交与原件装订并盖章的宣誓翻译。", sourceUrl),
    requirement(`${prefix}-english`, "english_test", "英语成绩", "English language test results must be available when the application is submitted unless exempted.", "除豁免外，递交申请时即需满足英语要求。", sourceUrl),
    ...extras,
  ];
}

function maastrichtRequirements(prefix, sourceUrl) {
  return [
    requirement(`${prefix}-transcript`, "transcript", "正式成绩单", "Official grades transcript, signed and stamped, including overall GPA and an English translation where needed.", "提交签字盖章的正式成绩单、总 GPA 及必要翻译。", sourceUrl),
    requirement(`${prefix}-diploma`, "degree_certificate", "学位证书", "Copy of your diploma, if obtained.", "已毕业者提交学位证书副本。", sourceUrl),
    requirement(`${prefix}-cv`, "cv", "个人简历", "Curriculum vitae listing education, extracurricular activities, internships and professional experience.", "列明教育、课外活动、实习与工作经历。", sourceUrl),
    requirement(`${prefix}-motivation`, "motivation_letter", "动机信", "A motivation letter of about one or two pages.", "用 1-2 页说明申请动机及完成项目的能力。", sourceUrl),
    requirement(`${prefix}-statistics`, "course_description", "统计课程说明", "List statistics courses, credits and a short description of no more than 10 sentences per course.", "逐门列出统计课程、学分和简短描述；无统计课程也需声明。", sourceUrl),
    requirement(`${prefix}-gmat-gre`, "gre_gmat", "GMAT / GRE 学术能力证明", "GMAT Focus 515 or higher, old GMAT 550 with AWA 4.0, or a sufficient GRE table combination with AWA 3.5.", "非 AACSB/EQUIS 国际学历按官网路径提交 GMAT 或 GRE；GRE 由官方二维表判定。", sourceUrl),
    requirement(`${prefix}-photo`, "other", "证件照", "A recent passport picture.", "按 MyApplication 任务中的规格上传近期证件照。", sourceUrl),
    requirement(`${prefix}-passport`, "passport", "护照 / 身份证件", "Copy of a valid passport or EU/EEA identity card.", "提交有效护照或欧盟身份证件。", sourceUrl),
    requirement(`${prefix}-verification`, "application_form", "文件核验授权", "Permission for document verification form when the diploma is not verified by DUO.", "未由 DUO 核验时提交文件核验授权表。", sourceUrl),
    requirement(`${prefix}-english`, "english_test", "英语能力证明", "Applicants with a non-EU/EEA nationality need to submit proof of English proficiency.", "非欧盟申请人按 SBE 要求提交英语证明。", sourceUrl),
  ];
}

function vuRequirements(prefix, sourceUrl) {
  return [
    requirement(`${prefix}-application-file`, "application_form", "VU Master Application File", "Complete the programme-specific Master Application File.", "填写项目专属申请表并按栏目提供课程背景。", sourceUrl),
    requirement(`${prefix}-transcript`, "transcript", "成绩单", "Transcript of records for the relevant degree programme.", "提交本科阶段正式成绩单。", sourceUrl),
    requirement(`${prefix}-diploma`, "degree_certificate", "学位证书", "Degree certificate is required after admission if it was not available during application.", "申请时可暂缺，录取后按要求补交学位证。", sourceUrl),
    requirement(`${prefix}-writing`, "writing_sample", "学术写作样本", "An academic writing sample or thesis extract of 2-5 pages.", "提交论文或学术写作中能体现研究能力的 2-5 页。", sourceUrl),
    requirement(`${prefix}-courses`, "course_description", "课程描述", "Course descriptions showing the required academic background.", "用课程描述证明项目要求的知识领域。", sourceUrl),
    requirement(`${prefix}-english`, "english_test", "英语成绩", "Proof of English language proficiency according to the programme requirement.", "提交满足项目总分与小分要求的英语成绩。", sourceUrl),
    requirement(`${prefix}-passport`, "passport", "护照", "Copy of the passport identity page.", "提交护照个人信息页。", sourceUrl),
  ];
}

function uvaRequirements(prefix, sourceUrl) {
  return [
    requirement(`${prefix}-motivation`, "motivation_letter", "英文动机信", "Motivation letter in English, maximum 500 words.", "不超过 500 词，按项目问题说明背景与动机。", sourceUrl),
    requirement(`${prefix}-cv`, "cv", "英文简历", "Curriculum vitae in English.", "提交英文简历。", sourceUrl),
    requirement(`${prefix}-secondary`, "other", "高中成绩与毕业证明", "High school grade list and diploma.", "国际学历申请还需上传高中成绩与毕业证明。", sourceUrl),
    requirement(`${prefix}-transcript`, "transcript", "本科成绩单与评分说明", "Bachelor transcript including GPA and the institution's grading scale.", "成绩单需含 GPA，并附学校评分标准。", sourceUrl),
    requirement(`${prefix}-diploma`, "degree_certificate", "本科学位 / 在读课程", "Bachelor diploma, or remaining courses when still in the final year.", "已毕业提交学位；应届生列出尚未完成的课程。", sourceUrl),
    requirement(`${prefix}-thesis`, "thesis", "毕业论文 / 项目说明", "Description of the Bachelor thesis or graduation project.", "提供毕业论文或毕业项目说明以证明学术能力。", sourceUrl),
    requirement(`${prefix}-references`, "recommendation_letter", "两位推荐人", "Two academic referees submit their references by the stated deadline.", "填写两位学术推荐人的邮箱，并确保推荐在截止日前送达。", sourceUrl),
    requirement(`${prefix}-english`, "english_test", "英语成绩", "Proof that the programme-specific English language requirement is met.", "提交满足 IELTS 总分及全部小分要求的证明。", sourceUrl),
  ];
}

const tilburgIelts = (prefix, sourceUrl) => test(
  `${prefix}-ielts`,
  "IELTS",
  sourceUrl,
  "IELTS Academic: minimum total score 6.5 and minimum 6.0 in Writing and Speaking. IELTS Online and One Skill Retake are not accepted.",
  "总分 6.5；写作、口语各 6.0。官网未规定听力/阅读单项最低分，不能自行补成 6.0。",
  { minimumTotal: 6.5, minimumWriting: 6, minimumSpeaking: 6, scoreEdition: "IELTS Academic" },
);

const vuIelts = (prefix, sourceUrl) => test(
  `${prefix}-ielts`,
  "IELTS",
  sourceUrl,
  "IELTS Academic 6.5 overall with a minimum of 6.0 in Listening, Reading, Writing and Speaking.",
  "总分 6.5，听说读写全部不低于 6.0。",
  { minimumTotal: 6.5, minimumListening: 6, minimumReading: 6, minimumWriting: 6, minimumSpeaking: 6, scoreEdition: "IELTS Academic 2026/27" },
);

const maastrichtTests = (prefix, admissionUrl, englishUrl) => [
  test(`${prefix}-ielts`, "IELTS", englishUrl, "Academic IELTS minimum overall score: 6.5.", "SBE 2026/27 规定 IELTS Academic 总分 6.5；该规则未披露单项最低分。", { minimumTotal: 6.5, scoreEdition: "IELTS Academic 2026/27" }),
  test(`${prefix}-gmat-focus`, "GMAT", admissionUrl, "GMAT Exam score 515 or higher; 595 or higher leads to automatic admission when all other conditions are met.", "GMAT Focus 最低 515；达到 595 且其余条件满足时可自动录取。", { minimumTotal: 515, scoreEdition: "GMAT Exam / Focus Edition" }),
  test(`${prefix}-gmat-old`, "GMAT", admissionUrl, "Old GMAT total 550 or higher with Analytical Writing Assessment 4.0; 650 and AWA 4.0 qualifies for automatic admission when all other conditions are met.", "旧版 GMAT 最低 550 且 AWA 4.0；650 且 AWA 4.0 对应官网自动录取门槛。", { minimumTotal: 550, minimumWriting: 4, scoreEdition: "GMAT 10th Edition" }),
  test(`${prefix}-gre`, "GRE", "https://www.maastrichtuniversity.nl/file/gre-admissions-table-sbepdf", "A sufficient Verbal and Quantitative combination in the official SBE GRE admissions table, plus Analytical Writing Assessment 3.5.", `GRE 无唯一总分：须在 SBE 官方二维表中落入“+”或“++”组合，AWA 至少 3.5。也可打开 ETS 工具作 GMAT 参考：${ETS_GRE_COMPARISON_URL}`, { minimumWriting: 3.5, scoreEdition: "GRE General Test / SBE admissions table", comparisonReference: "SBE Verbal × Quant 二维表达到 +；AWA 3.5", comparisonUrl: "https://www.maastrichtuniversity.nl/file/gre-admissions-table-sbepdf" }),
];

const tilburgGmatGre = (prefix, sourceUrl) => [
  test(`${prefix}-gmat`, "GMAT", sourceUrl, "GMAT Exam (Focus Edition): minimum total score 525.", "GMAT Focus 最低 525。", { minimumTotal: 525, scoreEdition: "GMAT Exam / Focus Edition" }),
  test(`${prefix}-gre`, "GRE", ETS_GRE_COMPARISON_URL, "GRE scores must be recalculated to a comparable GMAT score using the ETS conversion tool.", `GRE 需通过 ETS 官方工具换算，换算后的参考 GMAT 成绩须达到 525；软件不自行换算。项目官网依据：${sourceUrl}`, { scoreEdition: "GRE General Test / ETS comparison", comparisonReference: "ETS 换算后参考 GMAT Focus 525+", comparisonUrl: ETS_GRE_COMPARISON_URL }),
];

const maastrichtDates = (prefix, sourceUrl) => [
  date(`${prefix}-open`, "September 2026", "all", "application_open", "2025-10-01", "Applications open after 1 October 2025.", "2026/27 学年申请于 2025-10-01 后开放。", sourceUrl),
  date(`${prefix}-non-eu`, "September 2026", "non_eu", "deadline", "2026-05-01", "Non-EU/EEA complete-application deadline: 1 May 2026, 23:59 CET.", "非欧盟申请全流程截止 2026-05-01 23:59 CET。", sourceUrl),
  date(`${prefix}-eu`, "September 2026", "eu", "deadline", "2026-06-01", "EU/EEA/Swiss complete-application deadline: 1 June 2026, 23:59 CET.", "欧盟/瑞士申请截止 2026-06-01 23:59 CET。", sourceUrl),
  date(`${prefix}-tasks`, "September 2026", "all", "deadline", "2026-08-31", "All MyApplication tasks must be completed by 31 August 2026; visa tasks are earlier.", "MyApplication 最终任务截止 2026-08-31；需签证者必须更早完成。", sourceUrl),
];

const enrichments = {
  "utwente-bit": (() => {
    const admission = "https://www.utwente.nl/en/education/master/programmes/business-information-technology/admission-application/international-students/";
    const curriculum = "https://www.utwente.nl/en/education/master/programmes/business-information-technology/specialisations/data-science-business/courses-research/";
    const factsheet = "https://www.utwente.nl/en/education/master/programmes/business-information-technology/masters-structure/factsheet/";
    const main = "https://www.utwente.nl/en/education/master/programmes/business-information-technology/";
    return {
      overview: overview("Business Information Technology", "Learn to use IT to improve business processes and bridge business administration and computer science.", "以企业流程与数字化问题为核心，把商业管理、信息系统、数据与计算机科学结合起来。", main),
      admissionCriteria: [
        criterion("ut-bit-degree", "degree", "相关理学学士", "Bachelor of Science or equivalent in a related field.", admission),
        criterion("ut-bit-business", "prerequisite", "商业管理基础", "Finance, HRM, organisation/strategy, business intelligence, management and marketing.", admission),
        criterion("ut-bit-cs", "prerequisite", "计算机科学基础", "Object-oriented programming, information systems and databases.", admission),
        criterion("ut-bit-math", "prerequisite", "数学基础", "Calculus, statistics, probability and linear algebra.", admission),
        criterion("ut-bit-research", "prerequisite", "研究方法", "Research methodology and an academic research project and/or design.", admission),
        criterion("ut-bit-cgpa", "gpa", "CGPA 建议门槛", "The programme page states a CGPA of at least 70-75% of the maximum score.", admission, { minimum: 70 }),
      ],
      requirements: [
        requirement("ut-bit-diploma", "degree_certificate", "学位证书", "Copy of diploma.", "提交学位证书；未毕业可按条件录取流程后补。", admission),
        requirement("ut-bit-cv", "cv", "个人简历", "CV stating work experience, extracurricular activities, honours and awards.", "列明相关工作、课外活动、荣誉和奖励。", admission),
        requirement("ut-bit-motivation", "motivation_letter", "动机信", "Motivation letter, maximum two pages.", "动机信最多 2 页。", admission),
        requirement("ut-bit-transcript", "transcript", "成绩单", "Transcript of records.", "提交完整本科成绩单。", admission),
        requirement("ut-bit-thesis", "thesis", "论文英文摘要", "English summary of the thesis, including the applicant's own contribution for group work.", "提交毕业论文英文摘要；小组项目要说明个人贡献。", admission),
        requirement("ut-bit-courses", "course_description", "数学与研究方法课程描述", "Course descriptions for mathematics and methodology courses.", "重点提供数学和研究方法课程描述。", admission),
        requirement("ut-bit-english", "english_test", "英语成绩", "Official English certificate must meet the requirement before the application deadline.", "语言成绩必须在申请截止日前满足，不提供语言条件录取。", admission),
      ],
      coreCourses: [
        course("Enterprise Security", "企业安全", curriculum),
        course("Empirical and Design Science Foundations", "实证与设计科学基础", curriculum),
        course("Business Process Integration Lab", "业务流程集成实验", curriculum),
        course("Enterprise Architecture", "企业架构", curriculum),
        course("Applications of AI in Business", "商业人工智能应用", curriculum),
        course("Business Case Development for IT-Projects", "IT 项目商业案例开发", curriculum),
      ],
      applicationDates: [
        date("ut-bit-sep-non-eu", "September 2026", "non_eu", "deadline", "2026-05-01", "Non-EU deadline for 1 September 2026: 1 May 2026.", "2026 年 9 月入学非欧盟截止 2026-05-01。", factsheet),
        date("ut-bit-sep-eu", "September 2026", "eu", "deadline", "2026-07-01", "EU deadline for 1 September 2026: 1 July 2026.", "2026 年 9 月入学欧盟截止 2026-07-01。", factsheet),
        date("ut-bit-feb-non-eu", "February 2027", "non_eu", "deadline", "2026-10-01", "Non-EU deadline for 1 February 2027: 1 October 2026.", "2027 年 2 月入学非欧盟截止 2026-10-01。", factsheet),
        date("ut-bit-feb-eu", "February 2027", "eu", "deadline", "2026-12-01", "EU deadline for 1 February 2027: 1 December 2026.", "2027 年 2 月入学欧盟截止 2026-12-01。", factsheet),
      ],
      testRequirements: [test("ut-bit-ielts", "IELTS", admission, "IELTS Academic overall 6.5, with at least 6.0 in every section. Online, Indicator, One Skill Retake and General Training are not accepted.", "IELTS Academic 总分 6.5，听说读写全部 6.0；不接受 Online、Indicator、One Skill Retake 或 General Training。", { minimumTotal: 6.5, minimumListening: 6, minimumReading: 6, minimumWriting: 6, minimumSpeaking: 6, scoreEdition: "IELTS Academic" })],
      premasterInfo: premaster("unknown", "unknown", "The admission page notes that some applicants may be admitted on condition of first following a pre-master.", "In some cases you might be admitted under the condition that you follow the Pre-Master's first.", "官网确认可能给出先修 Pre-master 的条件录取，但未在该项目页披露国际生统一资格表。", admission),
      applicationFee: "€100（非荷兰高等教育学历的国际申请人）",
      applicationFeeEur: 100,
      applicationPlatform: "Eligibility e-check + Studielink",
      deadline: "Sep 2026: non-EU 1 May / EU 1 Jul; Feb 2027: non-EU 1 Oct / EU 1 Dec",
      applicationLinks: { programUrl: main, curriculumUrl: curriculum, eligibilityUrl: admission, materialsUrl: admission, careersUrl: main, premasterUrl: admission, studielinkUrl: STUDIELINK_URL },
    };
  })(),

  "maastricht-biss": (() => {
    const main = "https://www.maastrichtuniversity.nl/education/master/programmes/business-intelligence-and-smart-services";
    const admission = `${main}/admission-requirements`;
    const curriculum = `${main}/courses-and-curriculum`;
    const careers = `${main}/your-future`;
    const premasterUrl = "https://www.maastrichtuniversity.nl/pre-master-business-intelligence-and-smart-services";
    const eer = "https://www.maastrichtuniversity.nl/file/3-sbe-msc-eer-2026-2027-v20260421pdf";
    return {
      overview: overview("Business Intelligence and Smart Services", "Turn data into innovation. Combine service design, analytics and AI for real-world solutions.", "围绕服务设计、商业分析与人工智能，把数据转化为可落地的智能服务和商业决策。", main),
      admissionCriteria: [
        criterion("biss-degree", "degree", "国际本科学历", "Applicants with an international university or university of applied sciences diploma may apply; the Board assesses the complete file.", admission),
        criterion("biss-statistics", "prerequisite", "统计课程背景", "The application must document relevant statistics courses, credits and content.", admission),
        criterion("biss-academic", "other", "学术能力证明", "For a non-AACSB/EQUIS international diploma, submit GMAT or GRE evidence at the published threshold.", admission),
      ],
      requirements: maastrichtRequirements("biss", admission),
      coreCourses: [
        course("Service Design", "服务设计", eer),
        course("Business Analytics", "商业分析", eer),
        course("Business Intelligence and Data Governance", "商业智能与数据治理", eer),
        course("Machine Learning for Smart Services", "智能服务机器学习", eer),
        course("Smart Service Skills", "智能服务技能", eer),
        course("Smart Service Project", "智能服务项目", eer),
        course("Smart Service Management", "智能服务管理（选修）", eer),
        course("Analysing Unstructured Data", "非结构化数据分析（选修）", eer),
        course("Descriptive and Predictive Analytics", "描述与预测分析（选修）", eer),
        course("Data Visualisation", "数据可视化（选修）", eer),
      ],
      careerOutcomes: [career("biss-careers", ["Service designer", "Service engineer", "Smart service consultant", "Service manager", "Business intelligence consultant", "Big data analyst", "Big data architect"], ["Technology companies", "Consulting firms", "Government agencies", "Research institutes"], "Potential roles include service designer, smart service consultant, business intelligence consultant, big data analyst and big data architect.", "就业覆盖智能服务设计、商业智能咨询、数据分析/架构，也可进入政府、研究机构或继续 PhD。", careers)],
      applicationDates: maastrichtDates("biss", admission),
      testRequirements: maastrichtTests("biss", admission, eer),
      premasterInfo: premaster("yes", "yes", "A six-month, 30 ECTS pre-master is available for eligible university-degree holders; completion gives direct access to BISS.", "A six-month, 30 ECTS pre-master prepares eligible applicants for direct admission to BISS.", "支持 30 ECTS、6 个月的 Pre-master；国际大学学历由招生委员会评估资格。", premasterUrl),
      tuition: "€21,500（非欧盟，2026/27）；€2,694（法定学费适用者）",
      tuitionEur: 21500,
      tuitionAcademicYear: "2026/27",
      applicationFee: "€100（非欧盟/欧洲经济区既往教育，按官网条件）",
      applicationFeeEur: 100,
      applicationPlatform: "Studielink + MyApplication",
      deadline: "1 May 2026 (non-EU) / 1 June 2026 (EU/EEA/Swiss)",
      applicationLinks: { programUrl: main, curriculumUrl: curriculum, eligibilityUrl: admission, materialsUrl: admission, careersUrl: careers, premasterUrl, studielinkUrl: STUDIELINK_URL },
    };
  })(),

  "maastricht-dbe": (() => {
    const main = "https://www.maastrichtuniversity.nl/education/master/programmes/digital-business-and-economics";
    const admission = `${main}/admission-requirements`;
    const curriculum = `${main}/courses-and-curriculum`;
    const careers = `${main}/your-future`;
    const premasterUrl = "https://www.maastrichtuniversity.nl/pre-master-digital-business-and-economics";
    const eer = "https://www.maastrichtuniversity.nl/file/3-sbe-msc-eer-2026-2027-v20260421pdf";
    return {
      overview: overview("Digital Business and Economics", "Explore how digital transformation impacts business, society and ethics through AI, blockchain, robotics and machine morality.", "研究数字化转型如何改变企业、经济、社会与伦理，覆盖 AI、区块链、机器人和数字价值创造。", main),
      admissionCriteria: [
        criterion("dbe-degree", "degree", "国际本科学历", "International university or university of applied sciences graduates may apply for individual assessment.", admission),
        criterion("dbe-statistics", "prerequisite", "统计与数学基础", "The Board evaluates the level of statistics and mathematics and the fit of the bachelor's programme.", admission),
        criterion("dbe-academic", "other", "学术能力证明", "For a non-AACSB/EQUIS international diploma, GMAT or GRE evidence is required.", admission),
      ],
      requirements: maastrichtRequirements("dbe", admission),
      coreCourses: [
        course("Digital Business and Economics", "数字商业与经济", eer),
        course("Digital Value Creation", "数字价值创造", eer),
        course("Data Analytics for Digital Business and Economics", "数字商业与经济数据分析", eer),
        course("Ethics, Privacy and Security in a Digital Society", "数字社会的伦理、隐私与安全", eer),
        course("Generative AI in Digital Business and Economics", "数字商业与经济中的生成式 AI", eer),
        course("Master's Thesis", "硕士论文", eer),
      ],
      careerOutcomes: [career("dbe-careers", ["IT consultant", "Data science product owner", "Digital transformation specialist", "Digital policy specialist"], ["Consulting firms", "Technology companies", "Public-sector organisations"], "Career directions include IT consultancy, data-science product ownership, digital transformation, AI adoption and digital policy.", "可进入 IT 咨询、数据产品、数字化转型、AI 采用与数字政策岗位。", careers)],
      applicationDates: maastrichtDates("dbe", admission),
      testRequirements: maastrichtTests("dbe", admission, eer),
      premasterInfo: premaster("yes", "yes", "The six-month 30 ECTS pre-master starts in February and gives direct access after successful completion.", "The pre-master lasts six months and 30 ECTS and leads to direct access after completion.", "支持 6 个月、30 ECTS 的 Pre-master，完成后可直接衔接 DBE。", premasterUrl),
      tuitionAcademicYear: "2026/27",
      applicationFee: "€100（非欧盟/欧洲经济区既往教育，按官网条件）",
      applicationFeeEur: 100,
      applicationPlatform: "Studielink + MyApplication",
      deadline: "1 May 2026 (non-EU) / 1 June 2026 (EU/EEA/Swiss)",
      applicationLinks: { programUrl: main, curriculumUrl: curriculum, eligibilityUrl: admission, materialsUrl: admission, careersUrl: careers, premasterUrl, studielinkUrl: STUDIELINK_URL },
    };
  })(),

  "tilburg-im-strategy": (() => {
    const main = "https://www.tilburguniversity.edu/education/masters-programs/information-management-strategy-and-governance";
    const admission = `${main}/application`;
    const curriculum = `${main}/program`;
    const careers = `${main}/career`;
    const premasterUrl = `${main}/premaster`;
    const criteria = [
      ["academic", "Academic training", 6, "6-12 ECTS academic training"],
      ["math", "Mathematics", 6, "6-12 ECTS mathematics"],
      ["statistics", "Statistics", 6, "6-12 ECTS statistics"],
      ["management", "Management and Organization", 6, "6-12 ECTS management and organisation"],
      ["finance", "Finance", 6, "6-12 ECTS finance"],
      ["marketing", "Marketing", 6, "6 ECTS marketing"],
      ["accounting", "Accounting", 12, "12 ECTS accounting"],
      ["im", "Information Management", 6, "6 ECTS information management"],
    ].map(([id, title, credits, description]) => criterion(`tilburg-im-${id}`, "prerequisite", title, description, admission, { creditsEcts: credits }));
    criteria.push(criterion("tilburg-im-databases", "prerequisite", "数据库知识", "Knowledge of databases is strongly recommended.", admission, { required: false }));
    const extraMaterials = [
      requirement("tilburg-im-course-list", "course_description", "Information Management Course List", "Use the programme's Course List template and include all requested course details.", "必须用项目模板整理相关课程与学分。", admission),
      requirement("tilburg-im-gmat-gre", "gre_gmat", "GMAT / GRE 成绩", "GMAT/GRE result, or an approximate test date in OSIRIS when the result is pending.", "GMAT/GRE 为必需质量条件；申请时可先填预计考试日期。", admission),
      requirement("tilburg-im-motivation", "motivation_letter", "动机信", "Statement of purpose / motivation letter.", "提交项目动机信。", admission),
      requirement("tilburg-im-cv", "cv", "个人简历", "Resume / curriculum vitae.", "提交个人简历。", admission),
    ];
    return {
      overview: overview("Information Management: Strategy and Governance", "Learn to align Information Systems strategy and business strategy, ensuring effective governance and value creation.", "学习把信息系统战略与业务战略对齐，重点覆盖 IT 治理、数据治理、风险、安全与企业架构。", curriculum),
      admissionCriteria: criteria,
      requirements: tilburgRequirements("tilburg-im", admission, extraMaterials),
      coreCourses: [
        course("IT Governance and Strategic Sourcing", "IT 治理与战略采购", curriculum, { creditsEcts: 6 }),
        course("Cybersecurity Risk Management", "网络安全风险管理", curriculum, { creditsEcts: 6 }),
        course("Interactive Data Transformation", "交互式数据转换", curriculum, { creditsEcts: 6 }),
        course("Data & AI Governance", "数据与 AI 治理", curriculum, { creditsEcts: 6 }),
        course("Enterprise Architecture as a Business Strategy", "作为商业战略的企业架构", curriculum, { creditsEcts: 6 }),
      ],
      careerOutcomes: [career("tilburg-im-strategy-career", ["Business analyst", "IT consultant", "IT risk consultant", "Business information analyst", "Information systems specialist"], ["Deloitte", "Accenture", "AEGON", "Capgemini", "EY", "PwC", "Royal Dutch Shell"], "Official examples include Business Analyst at Deloitte, IT Consultant at Accenture, IT Risk Consultant at Deloitte and Business Information Analyst at AEGON.", "典型方向为业务分析、IT 咨询、信息治理和 IT 风险，官网列有 Deloitte、Accenture、AEGON、Capgemini、EY、PwC 等案例。", careers)],
      applicationDates: [
        date("tilburg-im-strategy-non-eu", "August 2026", "non_eu", "deadline", "2026-04-01", "Non-EEA deadline for Strategy and Governance starting end of August: 1 April.", "非欧盟截止 2026-04-01。", admission),
        date("tilburg-im-strategy-eu", "August 2026", "eu", "deadline", "2026-06-01", "EEA deadline for Strategy and Governance starting end of August: 1 June.", "欧盟截止 2026-06-01。", admission),
      ],
      testRequirements: [tilburgIelts("tilburg-im-strategy", admission), ...tilburgGmatGre("tilburg-im-strategy", admission)],
      premasterInfo: premaster("yes", "yes", "The Admissions Committee automatically considers deficiencies up to 30 ECTS for a pre-master.", "The committee automatically considers the application for a pre-master to remedy deficiencies of maximally 30 ECTS.", "申请硕士时会自动评估最多 30 ECTS 的 Pre-master 补缺方案，国际申请人无需另行预判。", premasterUrl),
      applicationPlatform: "Studielink + OSIRIS Aanmeld",
      deadline: "1 April (non-EEA) / 1 June (EEA), August intake",
      applicationLinks: { programUrl: main, curriculumUrl: curriculum, eligibilityUrl: admission, materialsUrl: admission, careersUrl: careers, premasterUrl, studielinkUrl: STUDIELINK_URL },
    };
  })(),

};

{
  const strategy = enrichments["tilburg-im-strategy"];
  const main = "https://www.tilburguniversity.edu/education/masters-programs/information-management-intelligence-and-innovation";
  const admission = "https://www.tilburguniversity.edu/education/masters-programs/information-management-strategy-and-governance/application";
  const curriculum = `${main}/program`;
  const careers = `${main}/career`;
  enrichments["tilburg-im-intelligence"] = {
    ...structuredClone(strategy),
    overview: overview("Information Management: Intelligence and Innovation", "Use business intelligence, analytics and AI to support digital transformation, process innovation and new business models.", "以商业智能、分析与 AI 为核心，研究数字化转型、流程创新和数据驱动商业模式。", curriculum),
    coreCourses: [
      course("Enterprise Architecture as a Business Strategy", "作为商业战略的企业架构", curriculum, { creditsEcts: 6 }),
      course("Business Intelligence and Business Analytics", "商业智能与商业分析", curriculum, { creditsEcts: 6 }),
      course("Business Process Innovation with AI", "AI 驱动的业务流程创新", curriculum, { creditsEcts: 6 }),
      course("Digital Transformation and Innovation", "数字化转型与创新", curriculum, { creditsEcts: 6 }),
    ],
    applicationDates: [
      date("tilburg-im-intelligence-non-eu", "January 2027", "non_eu", "deadline", "2026-10-01", "Non-EEA deadline for Intelligence and Innovation starting end of January: 1 October.", "2027 年 1 月入学非欧盟截止 2026-10-01。", admission),
      date("tilburg-im-intelligence-eu", "January 2027", "eu", "deadline", "2026-12-01", "EEA deadline for Intelligence and Innovation starting end of January: 1 December.", "2027 年 1 月入学欧盟截止 2026-12-01。", admission),
    ],
    testRequirements: [tilburgIelts("tilburg-im-intelligence", admission), ...tilburgGmatGre("tilburg-im-intelligence", admission)],
    careerOutcomes: [career("tilburg-im-intelligence-career", ["Business intelligence specialist", "Business analyst", "Digital transformation consultant", "Process innovation specialist"], ["Consulting firms", "Technology companies", "Business and government organisations"], "The track prepares graduates to apply business intelligence, analytics and AI in digital transformation and process innovation.", "典型方向为商业智能、业务分析、数字化转型咨询与流程创新。", careers)],
    deadline: "1 October (non-EEA) / 1 December (EEA), January intake",
    applicationLinks: { ...strategy.applicationLinks, programUrl: main, curriculumUrl: curriculum, eligibilityUrl: admission, materialsUrl: admission, careersUrl: careers },
  };
}

{
  const main = "https://www.tilburguniversity.edu/education/masters-programs/data-science-and-society";
  const admission = `${main}/application`;
  const curriculum = `${main}/program`;
  const careers = `${main}/career`;
  const premasterUrl = `${main}/premaster`;
  enrichments["tilburg-dss-business"] = {
    overview: overview("Data Science and Society - Business Track", "Combine data science methods with domain knowledge to address questions in business and society.", "面向非纯技术背景，把统计、编程和机器学习用于商业与社会问题；Business Track 强调业务场景解释与应用。", main),
    admissionCriteria: [
      criterion("tilburg-dss-degree", "degree", "匹配的学术本科学位", "The Admissions Committee assesses whether the previous programme and the selected track form a suitable match.", admission),
      criterion("tilburg-dss-methods", "prerequisite", "研究方法与统计", "Applicants need sufficient prior knowledge of research methods and statistics.", admission),
      criterion("tilburg-dss-track", "other", "Business Track 匹配", "The programme is intended for applicants who add data-science skills to a non-technical disciplinary background; track fit is assessed individually.", admission),
    ],
    requirements: tilburgRequirements("tilburg-dss", admission, [
      requirement("tilburg-dss-motivation", "motivation_letter", "指定格式动机陈述", "Statement of purpose using the required programme format.", "按项目提供的格式说明动机与 Business Track 匹配。", admission),
      requirement("tilburg-dss-cv", "cv", "个人简历", "Resume / curriculum vitae.", "提交个人简历。", admission),
      requirement("tilburg-dss-statistics", "course_description", "统计课程清单", "Complete the statistics checklist.", "用项目清单逐项证明研究方法与统计背景。", admission),
      requirement("tilburg-dss-track-form", "application_form", "方向选择表", "Submit the track preference form.", "确认所选 Business Track 并提交方向表。", admission),
    ]),
    coreCourses: [
      course("Data Mining", "数据挖掘", curriculum),
      course("Statistics and Methodology", "统计与方法论", curriculum),
      course("Programming for Data Science", "数据科学编程", curriculum),
      course("Machine Learning", "机器学习", curriculum),
    ],
    careerOutcomes: [career("tilburg-dss-career", ["Data analyst", "Business analyst", "Data consultant", "Policy analyst"], ["Business organisations", "Consulting firms", "Public-sector organisations"], "The programme combines domain expertise with data-science skills for analytical roles in organisations and society.", "就业以数据分析、业务分析、咨询和公共政策分析为主。", careers)],
    applicationDates: [
      date("tilburg-dss-sep-non-eu", "August 2026", "non_eu", "deadline", "2026-04-01", "Non-EEA deadline for the end-of-August intake: 1 April.", "9 月学期非欧盟截止 2026-04-01。", admission),
      date("tilburg-dss-sep-eu", "August 2026", "eu", "deadline", "2026-06-01", "EEA deadline for the end-of-August intake: 1 June.", "9 月学期欧盟截止 2026-06-01。", admission),
      date("tilburg-dss-jan-non-eu", "January 2027", "non_eu", "deadline", "2026-10-01", "Non-EEA deadline for the end-of-January intake: 1 October.", "2027 年 1 月入学非欧盟截止 2026-10-01。", admission),
      date("tilburg-dss-jan-eu", "January 2027", "eu", "deadline", "2026-12-01", "EEA deadline for the end-of-January intake: 1 December.", "2027 年 1 月入学欧盟截止 2026-12-01。", admission),
    ],
    testRequirements: [tilburgIelts("tilburg-dss", admission)],
    premasterInfo: premaster("yes", "yes", "Applicants whose prior education is close but not directly admissible may be assessed for the programme's pre-master.", "The international admission procedure can assess eligible applicants for a pre-master route.", "国际申请会在硕士审理中一并评估 Pre-master 可能性，最终取决于既往学科和统计基础。", premasterUrl),
    applicationPlatform: "Studielink + OSIRIS Aanmeld",
    deadline: "Sep: 1 Apr non-EEA / 1 Jun EEA; Jan: 1 Oct non-EEA / 1 Dec EEA",
    applicationLinks: { programUrl: main, curriculumUrl: curriculum, eligibilityUrl: admission, materialsUrl: admission, careersUrl: careers, premasterUrl, studielinkUrl: STUDIELINK_URL },
  };
}

{
  const main = "https://www.tilburguniversity.edu/education/masters-programs/data-science-business-entrepreneurship";
  const admission = `${main}/application`;
  const curriculum = `${main}/program`;
  const careers = `${main}/career`;
  enrichments["jads-dsbe"] = {
    overview: overview("Data Science in Business and Entrepreneurship", "Integrate data science, business and entrepreneurship and apply advanced analytics to real organisational challenges.", "把数据工程、机器学习、商业战略和创业实践结合，用真实项目解决组织问题。", main),
    admissionCriteria: [
      criterion("jads-degree", "degree", "研究型技术本科学历", "A research-oriented technical bachelor's degree or equivalent is expected for direct admission.", admission),
      criterion("jads-math-stats", "prerequisite", "数学与统计合计", "At least 15 ECTS in mathematics and statistics.", admission, { creditsEcts: 15 }),
      criterion("jads-math", "prerequisite", "数学", "At least 5 ECTS in mathematics.", admission, { creditsEcts: 5 }),
      criterion("jads-statistics", "prerequisite", "统计", "At least 5 ECTS in statistics.", admission, { creditsEcts: 5 }),
      criterion("jads-databases", "prerequisite", "数据库", "Prior coursework in databases.", admission),
      criterion("jads-algorithms", "prerequisite", "数据结构与算法", "Prior coursework in data structures and algorithms.", admission),
      criterion("jads-programming", "prerequisite", "编程", "Prior programming coursework, preferably Python.", admission),
      criterion("jads-ml", "prerequisite", "机器学习 / 数据挖掘", "Prior coursework in machine learning or data mining.", admission),
    ],
    requirements: tilburgRequirements("jads", admission, [
      requirement("jads-course-list", "course_description", "相关课程清单", "Submit a course list showing mathematics, statistics, programming, algorithms, databases and machine-learning preparation.", "逐项列出数理与技术先修课及学分。", admission),
      requirement("jads-motivation", "motivation_letter", "动机信", "Motivation letter.", "说明数据科学、商业和创业方向的匹配。", admission),
      requirement("jads-cv", "cv", "个人简历", "Curriculum vitae.", "提交个人简历。", admission),
    ]),
    coreCourses: [
      course("Data Intrapreneurship in Action", "企业内数据创业实践", curriculum),
      course("Advanced Machine Learning", "高级机器学习", curriculum),
      course("Data Engineering", "数据工程", curriculum),
      course("Strategy and Business Models", "战略与商业模式", curriculum),
    ],
    careerOutcomes: [career("jads-career", ["Data scientist", "Machine-learning specialist", "Data engineer", "Analytics consultant", "Data entrepreneur"], ["Technology companies", "Consulting firms", "Data-driven start-ups"], "The programme prepares students for data-science, engineering, consulting and entrepreneurial roles.", "就业覆盖数据科学、机器学习、数据工程、分析咨询和数据创业。", careers)],
    applicationDates: [
      date("jads-sep-non-eu", "August 2026", "non_eu", "deadline", "2026-04-01", "Non-EEA deadline for the end-of-August intake: 1 April.", "9 月学期非欧盟截止 2026-04-01。", admission),
      date("jads-sep-eu", "August 2026", "eu", "deadline", "2026-06-01", "EEA deadline for the end-of-August intake: 1 June.", "9 月学期欧盟截止 2026-06-01。", admission),
      date("jads-jan-non-eu", "January 2027", "non_eu", "deadline", "2026-10-01", "Non-EEA deadline for the end-of-January intake: 1 October.", "2027 年 1 月入学非欧盟截止 2026-10-01。", admission),
      date("jads-jan-eu", "January 2027", "eu", "deadline", "2026-12-01", "EEA deadline for the end-of-January intake: 1 December.", "2027 年 1 月入学欧盟截止 2026-12-01。", admission),
    ],
    testRequirements: [tilburgIelts("jads", admission)],
    premasterInfo: premaster("yes", "yes", "A relevant degree with at least 15 ECTS mathematics/statistics, including 5 ECTS in each, may qualify for the JADS pre-master after assessment.", "Applicants with the stated mathematics and statistics background are most likely eligible for a JADS pre-master.", "支持 Pre-master；重点门槛为数学+统计至少 15 ECTS，且两类各至少 5 ECTS。", admission),
    applicationPlatform: "Studielink + OSIRIS Aanmeld",
    deadline: "Sep: 1 Apr non-EEA / 1 Jun EEA; Jan: 1 Oct non-EEA / 1 Dec EEA",
    applicationLinks: { programUrl: main, curriculumUrl: curriculum, eligibilityUrl: admission, materialsUrl: admission, careersUrl: careers, premasterUrl: admission, studielinkUrl: STUDIELINK_URL },
  };
}

{
  const main = "https://vu.nl/en/education/master/digital-business-and-innovation";
  const admission = `${main}/admissions`;
  const curriculum = `${main}/curriculum`;
  const careers = `${main}/future`;
  const materials = "https://vu.nl/en/education/more-about/application-documents-master";
  const language = "https://assets-us-01.kc-usercontent.com/d8b6f1f5-816c-005b-1dc1-e363dd7ce9a5/6b920796-959b-411e-a04c-4dae4c326cea/English%20Language%20Proficiency%20Overview%2026-27.pdf";
  const premasterUrl = "https://vu.nl/en/education/master/digital-business-and-innovation-premaster/admissions";
  enrichments["vu-dbi"] = {
    overview: overview("Digital Business and Innovation", "Bridge business and technology by combining information systems, innovation management and digital transformation.", "连接商业与技术，重点研究信息系统、创新管理、数字化转型及新技术对组织的影响。", main),
    admissionCriteria: [
      criterion("vu-dbi-degree", "degree", "研究型大学学士", "A degree equivalent to a Dutch academic Bachelor's degree obtained at a research university, nominally three years.", admission),
      criterion("vu-dbi-is", "prerequisite", "Information Systems", "Demonstrable knowledge of Information Systems.", admission),
      criterion("vu-dbi-im", "prerequisite", "Innovation Management", "Demonstrable knowledge of Innovation Management.", admission),
      criterion("vu-dbi-rm", "prerequisite", "Research Methods", "Demonstrable knowledge of Research Methods apart from Statistics.", admission),
      criterion("vu-dbi-ba", "prerequisite", "Business Administration", "Demonstrable knowledge of Business Administration.", admission),
    ],
    requirements: vuRequirements("vu-dbi", materials),
    coreCourses: [
      course("Digital Business and Information Systems", "数字商业与信息系统", curriculum),
      course("Management of Digital Innovation", "数字创新管理", curriculum),
      course("Working and Organizing in a Digital Age", "数字时代的工作与组织", curriculum),
      course("Ethics in a Digital World", "数字世界伦理", curriculum),
      course("Research Design and Methods", "研究设计与方法", curriculum),
      course("Thesis", "硕士论文", curriculum),
    ],
    careerOutcomes: [career("vu-dbi-career", ["IT consultant", "Project manager", "Business analyst", "Innovation consultant", "Business developer", "Start-up entrepreneur"], ["Deloitte", "KPMG", "Large consulting firms", "Technology companies"], "Typical roles include IT consultant or project manager, business analyst or innovation consultant, business developer and start-up entrepreneur.", "典型岗位为 IT 咨询/项目管理、业务分析、创新咨询、业务开发和创业。", careers)],
    applicationDates: [
      date("vu-dbi-non-eu", "September 2026", "non_eu", "deadline", "2026-04-01", "International applicants requiring a visa or residence permit: 1 April 2026.", "需签证/居留许可的非欧盟申请截止 2026-04-01。", admission),
      date("vu-dbi-eu", "September 2026", "eu", "deadline", "2026-06-01", "EU/EEA applicants: 1 June 2026.", "欧盟申请截止 2026-06-01。", admission),
    ],
    testRequirements: [vuIelts("vu-dbi", language)],
    premasterInfo: premaster("yes", "unknown", "International applicants first apply to the Master's; the Admission Board may refer them to the 30 ECTS February-July pre-master.", "International students cannot apply directly to the pre-master; the Admission Board may refer an applicant after assessing the Master's application.", "支持 30 ECTS Pre-master。国际申请人不能直接申请，需先申请硕士并由招生委员会转介；官网未保证所有非欧盟身份均可获转介。", premasterUrl),
    applicationFee: "€100（国际学历申请）",
    applicationFeeEur: 100,
    applicationPlatform: "Studielink + VU Dashboard",
    deadline: "1 April 2026 (visa/non-EU) / 1 June 2026 (EU/EEA)",
    applicationLinks: { programUrl: main, curriculumUrl: curriculum, eligibilityUrl: admission, materialsUrl: materials, careersUrl: careers, premasterUrl, studielinkUrl: STUDIELINK_URL },
  };
}

{
  const main = "https://vu.nl/en/education/master/information-sciences";
  const admission = `${main}/admissions`;
  const curriculum = `${main}/curriculum`;
  const careers = `${main}/future`;
  const materials = "https://vu.nl/en/education/more-about/application-documents-master";
  const language = "https://assets-us-01.kc-usercontent.com/d8b6f1f5-816c-005b-1dc1-e363dd7ce9a5/6b920796-959b-411e-a04c-4dae4c326cea/English%20Language%20Proficiency%20Overview%2026-27.pdf";
  const premasterUrl = "https://vu.nl/en/education/master/information-sciences-pre-masters-programme/admissions";
  enrichments["vu-is"] = {
    overview: overview("Information Sciences", "Design responsible and sustainable socio-technical software and data systems for digital transformation.", "以负责任、可持续的社会技术系统为主线，培养数字架构、信息系统设计和组织转型能力。", main),
    admissionCriteria: [
      criterion("vu-is-degree", "degree", "研究型大学相关学士", "A Dutch WO-equivalent Bachelor's degree in Information Sciences or a closely related field such as Computer Science, Informatics, Business Analytics or Artificial Intelligence.", admission),
      criterion("vu-is-domain", "prerequisite", "信息科学课程", "Business Modelling and Requirements Engineering, Human-Computer Interaction and an Information Sciences project.", admission),
      criterion("vu-is-cs", "prerequisite", "计算机科学课程", "Base-level Programming, Software Engineering and Databases.", admission),
      criterion("vu-is-context", "prerequisite", "跨学科背景", "Relevant Business/Economics, Social Sciences, or Culture and Communication Studies courses.", admission),
    ],
    requirements: vuRequirements("vu-is", materials),
    coreCourses: [
      course("Master Project Information Sciences", "信息科学硕士项目", curriculum),
      course("Digitalization and Sustainability", "数字化与可持续性", curriculum),
      course("Knowledge Organization", "知识组织", curriculum),
      course("Digital Architecture", "数字架构", curriculum),
      course("The Social Web", "社会化网络", curriculum),
      course("Research Methodology and Thesis Design", "研究方法与论文设计", curriculum),
    ],
    careerOutcomes: [career("vu-is-career", ["Chief Sustainability Officer", "Junior Digital Architect", "IT consultant", "Data analyst", "Product owner", "Data manager", "Data steward"], ["Technology companies", "Consulting firms", "Public organisations"], "Official examples include Chief Sustainability Officer, Junior Digital Architect, IT consultant and data analyst.", "可从事可持续数字化、数字架构、IT 咨询、数据分析、产品和数据治理岗位。", careers)],
    applicationDates: [
      date("vu-is-non-eu", "September 2026", "non_eu", "deadline", "2026-04-01", "Non-EU/EEA applicants requiring a visa or residence permit: 1 April 2026.", "需签证的非欧盟申请截止 2026-04-01。", admission),
      date("vu-is-eu", "September 2026", "eu", "deadline", "2026-07-15", "Non-Dutch EU/EEA applicants: 15 July 2026.", "非荷兰欧盟申请截止 2026-07-15。", admission),
    ],
    testRequirements: [
      vuIelts("vu-is", language),
      test("vu-is-gre", "GRE", admission, "A GRE or GMAT test score is not required.", "该项目明确不要求 GRE/GMAT。", { required: false, scoreEdition: "GRE General Test" }),
      test("vu-is-gmat", "GMAT", admission, "A GRE or GMAT test score is not required.", "该项目明确不要求 GRE/GMAT。", { required: false, scoreEdition: "GMAT" }),
    ],
    premasterInfo: premaster("yes", "unknown", "International applicants apply to the Master's first; the Admission Board may suggest a customised pre-master.", "Applicants with a non-Dutch degree do not apply directly to the pre-master; the Board may suggest it after assessing the Master's application.", "支持定制 Pre-master；国际学历先申请硕士，由委员会决定是否转介。", premasterUrl),
    applicationFee: "€100（国际学历申请）",
    applicationFeeEur: 100,
    applicationPlatform: "Studielink + VU Dashboard",
    deadline: "1 April 2026 (visa/non-EU) / 15 July 2026 (non-Dutch EU/EEA)",
    applicationLinks: { programUrl: main, curriculumUrl: curriculum, eligibilityUrl: admission, materialsUrl: materials, careersUrl: careers, premasterUrl, studielinkUrl: STUDIELINK_URL },
  };
}

{
  const main = "https://www.ru.nl/en/education/masters/information-sciences";
  const admission = `${main}/admission-and-application`;
  const curriculum = `${main}/study-programme/curriculum-of-information-sciences`;
  const careers = `${main}/career-prospects`;
  const language = "https://www.ru.nl/en/education/application-and-admission/language-requirements/english-language-requirements/minimum-test-scores-pre-masters";
  const premasterUrl = `${main}/pre-masters`;
  enrichments["radboud-is"] = {
    overview: overview("Information Sciences", "Become a digital architect who bridges technology and management and designs secure, competitive business solutions.", "培养连接技术与管理的数字架构能力，重点解决业务-IT 对齐、安全、隐私和组织设计问题。", main),
    admissionCriteria: [
      criterion("ru-is-degree", "degree", "研究型大学相关学士", "A foreign Bachelor's degree equivalent to a Dutch research-university degree in Information Science, Computing Science, Business Administration or a related programme.", admission),
      criterion("ru-is-business", "prerequisite", "商业管理 15 EC", "A theoretical Computing Science background requires 15 credits of Business Administration.", admission, { creditsEcts: 15 }),
      criterion("ru-is-cs", "prerequisite", "计算机科学 15 EC", "A Business Administration background requires 15 credits covering Information Systems, Programming, Requirements Engineering and Security.", admission, { creditsEcts: 15 }),
      criterion("ru-is-thesis", "prerequisite", "毕业项目 / 论文", "A Bachelor final project including a thesis worth at least 10 EC.", admission, { creditsEcts: 10 }),
      criterion("ru-is-research", "prerequisite", "学术研究能力", "Familiarity with research methods, academic writing and critical thinking.", admission),
    ],
    requirements: [
      requirement("ru-is-passport", "passport", "护照 / 欧盟身份证", "Scan of a valid passport personal-details page or European ID card.", "提交有效护照个人信息页或欧盟身份证。", admission),
      requirement("ru-is-diploma", "degree_certificate", "本科毕业证书", "Signed and stamped Bachelor's diploma, or declare pending graduation in OSIRIS.", "已毕业提交签字盖章证书；应届生在系统中声明。", admission),
      requirement("ru-is-transcript", "transcript", "正式成绩单与评分标准", "Official signed and stamped transcript plus the grading-scale description.", "提交正式成绩单及评分标准。", admission),
      requirement("ru-is-translation", "other", "宣誓翻译", "Sworn translations of diploma and transcript when originals are not Dutch, English or German.", "非荷/英/德语材料需宣誓翻译，并同时提交原件。", admission),
      requirement("ru-is-courses", "course_description", "完整课程描述", "Course descriptions for completed and unfinished courses, including content, hours, literature, research work and thesis/internship.", "逐门列出内容、学时、教材，并突出研究课、实践和论文/实习。", admission),
      requirement("ru-is-motivation", "motivation_letter", "个人陈述 / 动机信", "Describe programme fit, future plans, research interests and how previous education prepared you.", "具体说明项目匹配、未来计划和研究兴趣。", admission),
      requirement("ru-is-cv", "cv", "教育与经历概览", "Chronological overview of education, internships, training and work experience.", "按时间顺序整理教育、实习、培训与工作经历。", admission),
      requirement("ru-is-english", "english_test", "英语证明", "English certificate may be supplied after conditional admission when required in the decision.", "可先申请；若录取条件要求，需在注册截止前补齐英语证明。", admission),
    ],
    coreCourses: [
      course("Research Methods", "研究方法", curriculum, { creditsEcts: 3 }),
      course("System and User Approaches to Information Science", "信息科学的系统与用户方法", curriculum, { creditsEcts: 6 }),
      course("Philosophy and Ethics for Computing and Information Sciences", "计算与信息科学哲学伦理", curriculum, { creditsEcts: 3 }),
      course("Software Development Entrepreneurship", "软件开发创业", curriculum, { creditsEcts: 6 }),
      course("System Development Management", "系统开发管理", curriculum, { creditsEcts: 6 }),
      course("Master's Thesis", "硕士论文", curriculum, { creditsEcts: 18 }),
    ],
    careerOutcomes: [career("ru-is-career", ["Digital architect", "Information security officer", "Privacy officer", "Business-IT alignment specialist", "IT consultant"], ["Government agencies", "Banks and insurers", "Private enterprises", "Consulting firms"], "Graduates bridge users, management and IT and may work in digital architecture, security, privacy or business-IT alignment.", "就业方向包括数字架构、信息安全/隐私、业务-IT 对齐与咨询。", careers)],
    applicationDates: [
      date("ru-is-open", "September 2026", "all", "application_open", "2025-10-01", "Applications open 1 October 2025.", "申请于 2025-10-01 开放。", admission),
      date("ru-is-non-eu", "September 2026", "non_eu", "deadline", "2026-04-01", "Non-EU/EEA deadline: 1 April 2026.", "非欧盟申请截止 2026-04-01。", admission),
      date("ru-is-scholarship", "September 2026", "non_eu", "deadline", "2026-01-31", "Scholarship application deadline: 31 January 2026.", "奖学金申请截止 2026-01-31。", admission),
      date("ru-is-eu", "September 2026", "eu", "deadline", "2026-07-01", "EU/EEA deadline: 1 July 2026.", "欧盟申请截止 2026-07-01。", admission),
    ],
    testRequirements: [test("ru-is-ielts", "IELTS", language, "IELTS Academic overall 6.5, Writing 6.5 and all other subscores 6.0.", "IELTS 总分 6.5，写作 6.5，听力、阅读、口语各 6.0。", { minimumTotal: 6.5, minimumWriting: 6.5, minimumListening: 6, minimumReading: 6, minimumSpeaking: 6, scoreEdition: "IELTS Academic" })],
    premasterInfo: premaster("yes", "yes", "Applicants missing only a small part of the criteria may be eligible for a customised English-taught pre-master.", "Students with a small deficiency may be eligible for a customised pre-master in English.", "支持英语定制 Pre-master，适用于仅缺少少量先修条件的申请人。", premasterUrl),
    applicationPlatform: "Studielink + OSIRIS Application",
    deadline: "1 April 2026 (non-EU/EEA) / 1 July 2026 (EU/EEA)",
    applicationLinks: { programUrl: main, curriculumUrl: curriculum, eligibilityUrl: admission, materialsUrl: admission, careersUrl: careers, premasterUrl, studielinkUrl: STUDIELINK_URL },
  };
}

function uvaCommon(prefix, main, admission, curriculum, careers, trackCriteria, courses, careerData) {
  const language = "https://www.uva.nl/shared-content/programmas/en/masters/information-studies-data-science/application-and-admission/international-prior-education/english-language-requirements.html";
  return {
    admissionCriteria: [
      criterion(`${prefix}-degree`, "degree", "学士学位与数据/技术亲和度", "A Bachelor's degree and affinity with data and technology.", admission),
      criterion(`${prefix}-academic`, "prerequisite", "Academic Skills", "Academic skills including research, writing, scientific reasoning, critical reflection and statistics.", admission, { creditsEcts: 6 }),
      ...trackCriteria,
      criterion(`${prefix}-gpa`, "gpa", "最低 GPA", "GPA equivalent to Dutch 6.5, US 3.0 or UK upper second-class 2:1.", admission, { minimum: 6.5 }),
    ],
    requirements: uvaRequirements(prefix, admission),
    coreCourses: courses,
    careerOutcomes: [career(`${prefix}-career`, careerData.roles, careerData.employers, careerData.originalText, careerData.summaryZh, careers)],
    applicationDates: [
      date(`${prefix}-non-eu`, "September 2026", "non_eu", "deadline", "2026-01-31", "International non-EU/EEA deadline: 31 January, 23:59 CEST.", "非欧盟国际学历截止 2026-01-31 23:59 CEST。", admission),
      date(`${prefix}-eu`, "September 2026", "eu", "deadline", "2026-04-30", "EU/EEA deadline: 30 April, 23:59 CEST.", "欧盟申请截止 2026-04-30 23:59 CEST。", admission),
    ],
    testRequirements: [test(`${prefix}-ielts`, "IELTS", language, "IELTS Academic overall 7.0 with 6.5 in every subscore. Online, Indicator and One Skill Retake are not accepted.", "IELTS Academic 总分 7.0，听说读写全部 6.5；不接受 Online、Indicator 或 One Skill Retake。", { minimumTotal: 7, minimumListening: 6.5, minimumReading: 6.5, minimumWriting: 6.5, minimumSpeaking: 6.5, scoreEdition: "IELTS Academic" })],
    premasterInfo: premaster("no", "no", "The Information Studies programme does not offer a pre-master route for these tracks.", "No pre-Master Information Studies is offered.", "Information Studies 不提供 Pre-master；先修不足不能通过本项目预科补齐。", admission),
    quota: "Information Studies 两方向合计每学年最多 150 人",
    applicationFee: "€100（国际学历申请）",
    applicationFeeEur: 100,
    applicationPlatform: "Studielink + DataNose",
    deadline: "31 January (non-EU/EEA) / 30 April (EU/EEA), 23:59 CEST",
    applicationLinks: { programUrl: main, curriculumUrl: curriculum, eligibilityUrl: admission, materialsUrl: admission, careersUrl: careers, premasterUrl: admission, studielinkUrl: STUDIELINK_URL },
  };
}

{
  const main = "https://www.uva.nl/en/programmes/masters/information-studies-data-science/data-science.html";
  const admission = "https://www.uva.nl/shared-content/programmas/en/masters/information-studies-data-science/application-and-admission/international-prior-education/international-prior-education-foldout-menu.html";
  const curriculum = "https://www.uva.nl/shared-content/programmas/en/masters/information-studies-data-science/study-programme/study-programme.html";
  const careers = "https://www.uva.nl/shared-content/programmas/en/masters/information-studies-data-science/career-prospects/career-prospects.html";
  enrichments["uva-ds"] = {
    overview: overview("Information Studies - Data Science", "Become an all-round data scientist who can take a data-driven project from problem framing to implementation and assess organisational and social implications.", "训练完整数据项目能力：从业务/社会问题建模、统计与机器学习，到系统实现及组织和社会影响评估。", main),
    ...uvaCommon("uva-ds", main, admission, curriculum, careers, [
      criterion("uva-ds-programming", "prerequisite", "编程", "Good programming skills in any language, preferably Python.", admission, { creditsEcts: 12 }),
      criterion("uva-ds-statistics", "prerequisite", "统计", "University-level statistics preparation.", admission, { creditsEcts: 6 }),
      criterion("uva-ds-modelling", "prerequisite", "数据与信息建模", "Data and information modelling preparation.", admission, { creditsEcts: 12 }),
    ], [
      course("Fundamentals of Data Science", "数据科学基础", curriculum),
      course("Statistics, Simulation, and Optimisation", "统计、仿真与优化", curriculum),
      course("Applied Machine Learning", "应用机器学习", curriculum),
      course("Data Systems Project", "数据系统项目", curriculum),
      course("Big Data", "大数据", curriculum),
    ], {
      roles: ["Data scientist", "Data analyst", "Machine-learning specialist", "Data consultant", "Researcher"],
      employers: ["Technology companies", "Consulting firms", "Research organisations", "Government and non-profit organisations"],
      originalText: "Graduates apply data science across industry, government, non-profit and research settings.",
      summaryZh: "可进入数据科学、机器学习、分析咨询和研究岗位，覆盖企业、政府与非营利机构。",
    }),
  };
}

{
  const main = "https://www.uva.nl/en/programmes/masters/information-studies-information-systems/information-systems.html";
  const admission = "https://www.uva.nl/en/programmes/masters/information-studies-information-systems/application-and-admission/international-prior-education/international-prior-education-foldout-menu.html";
  const curriculum = "https://www.uva.nl/shared-content/programmas/en/masters/information-studies-information-systems/study-programme/study-programme.html";
  const careers = "https://www.uva.nl/en/programmes/masters/information-studies-information-systems/career-prospects/career-prospects.html";
  enrichments["uva-is"] = {
    overview: overview("Information Studies - Information Systems", "Bridge ICT and organisations by analysing, designing and managing information systems in their human and institutional context.", "连接 ICT 与组织，强调信息系统分析设计、人机交互、多媒体、数据建模和跨部门协作。", main),
    ...uvaCommon("uva-is", main, admission, curriculum, careers, [
      criterion("uva-is-programming", "prerequisite", "编程", "Good programming skills at university level.", admission, { creditsEcts: 12 }),
      criterion("uva-is-hci", "prerequisite", "HCI / 多媒体", "Preparation in human media perception, digital multimedia representation and Human-Computer Interaction.", admission),
      criterion("uva-is-modelling", "prerequisite", "数据与信息建模", "Data and information modelling preparation.", admission, { creditsEcts: 12 }),
    ], [
      course("Information Systems", "信息系统", curriculum),
      course("Data Systems Project", "数据系统项目", curriculum),
      course("Human-Computer Interaction", "人机交互", curriculum),
      course("Information and Knowledge Management", "信息与知识管理", curriculum),
      course("Master's Thesis", "硕士论文", curriculum),
    ], {
      roles: ["Consultant", "Business analyst", "Information systems designer", "ICT project coordinator", "Programme manager", "Researcher"],
      employers: ["Consulting firms", "Broadcasting and media companies", "Museums", "Public institutions", "ICT companies"],
      originalText: "Graduates work as consultants, analysts, designers, ICT project coordinators or programme managers and often bridge ICT and non-ICT stakeholders.",
      summaryZh: "典型岗位为咨询、业务分析、信息系统设计、ICT 项目协调/管理和研究，核心优势是连接技术与非技术团队。",
    }),
  };
}

{
  const main = "https://www.uu.nl/en/masters/business-informatics";
  const curriculum = `${main}/study-programme`;
  const careers = `${main}/career-prospects`;
enrichments["uu-bi"] = {
    overview: overview("Business Informatics", "Align ICT with business processes by combining information and computing science with organisational insight.", "结合信息科学、计算机科学与组织管理，设计和实施能真正匹配业务流程的信息系统。", main),
    coreCourses: [
      course("Scientific Research Methods for Business Informatics", "商业信息学科学研究方法", curriculum),
      course("Business Process Management", "业务流程管理", curriculum),
      course("Data Science and Society", "数据科学与社会", curriculum),
      course("Dilemmas of the Scientist 1", "科学家的伦理困境 1", curriculum),
      course("Dilemmas of the Scientist 2", "科学家的伦理困境 2", curriculum),
      course("Introduction to Business Informatics", "商业信息学导论", curriculum),
      course("Introducing Natural Sciences", "自然科学导论", curriculum),
      course("Method and Model-Driven Engineering", "方法与模型驱动工程", curriculum),
    ],
    careerOutcomes: [career("uu-bi-career", ["Business analyst", "Chief Information Officer", "Data scientist", "ICT consultant", "ICT project manager", "Product manager", "Software entrepreneur", "PhD researcher"], ["IT-intensive companies", "Consulting firms", "Research organisations"], "The 2025 Business Informatics alumni survey lists Business Analyst, CIO, Data Scientist, ICT Consultant, ICT Project Manager, Product Manager and Software Entrepreneur.", "2025 校友调查列出的方向包括业务分析、CIO、数据科学、ICT 咨询/项目管理、产品管理、软件创业和 PhD。", careers)],
    premasterInfo: premaster("yes", "no", "Deficiencies of at most 30 EC may lead to a customised pre-master, but it is limited to Dutch students and specified non-Dutch residents with Dutch educational backgrounds who do not require a study residence permit.", "A pre-master of at most 30 EC may be assigned, but it is not available to international applicants who require a residence permit for study.", "最多可用 30 EC Pre-master 补缺，但需要留学居留许可的非欧盟国际申请人不适用。", `${main}/application-and-admission/pre-masters-programme`),
    tuition: "€25,306（非欧盟，2026/27）；€2,694（法定学费适用者）",
    tuitionEur: 25306,
    tuitionAcademicYear: "2026/27",
    applicationLinks: { programUrl: main, curriculumUrl: curriculum, careersUrl: careers },
  };
}

const tuitionPatches = {
  "utwente-bit": {
    tuition: "€21,700（非欧盟）",
    tuitionEur: 21700,
    tuitionUrl: "https://www.utwente.nl/en/education/master/programmes/business-information-technology/financial-matters/",
  },
  "maastricht-biss": {
    tuition: "€21,500（非欧盟）",
    tuitionEur: 21500,
    tuitionUrl: "https://www.maastrichtuniversity.nl/education/master/programmes/business-intelligence-and-smart-services/tuition-fees",
  },
  "maastricht-dbe": {
    tuition: "€21,500（非欧盟）",
    tuitionEur: 21500,
    tuitionUrl: "https://www.maastrichtuniversity.nl/masters-business-and-economics",
  },
  "tilburg-im-strategy": {
    tuition: "€23,900（非欧盟）",
    tuitionEur: 23900,
    tuitionUrl: TILBURG_TUITION_RATES_URL,
  },
  "tilburg-im-intelligence": {
    tuition: "€23,900（非欧盟）",
    tuitionEur: 23900,
    tuitionUrl: TILBURG_TUITION_RATES_URL,
  },
  "tilburg-dss-business": {
    tuition: "€23,900（非欧盟）",
    tuitionEur: 23900,
    tuitionUrl: TILBURG_TUITION_RATES_URL,
  },
  "jads-dsbe": {
    tuition: "€23,900（非欧盟）",
    tuitionEur: 23900,
    tuitionUrl: TILBURG_TUITION_RATES_URL,
  },
  "vu-dbi": {
    tuition: "€24,830（非欧盟）",
    tuitionEur: 24830,
    tuitionUrl: "https://assets-us-01.kc-usercontent.com/d8b6f1f5-816c-005b-1dc1-e363dd7ce9a5/b380bad5-99ff-4349-803a-4aa1c041c5e2/2026_Instellingscollegeld_Master_EN.pdf",
  },
  "vu-is": {
    tuition: "€34,440（非欧盟）",
    tuitionEur: 34440,
    tuitionUrl: "https://assets-us-01.kc-usercontent.com/d8b6f1f5-816c-005b-1dc1-e363dd7ce9a5/b380bad5-99ff-4349-803a-4aa1c041c5e2/2026_Instellingscollegeld_Master_EN.pdf",
  },
  "radboud-is": {
    tuition: "€25,429（非欧盟）",
    tuitionEur: 25429,
    tuitionUrl: "https://www.ru.nl/en/education/masters/information-sciences/tuition",
  },
  "uva-ds": {
    tuition: "€34,300（非欧盟）",
    tuitionEur: 34300,
    tuitionUrl: "https://www.uva.nl/en/education/fees-and-funding/tuition-fees/tuition-fees.html",
  },
  "uva-is": {
    tuition: "€34,300（非欧盟）",
    tuitionEur: 34300,
    tuitionUrl: "https://www.uva.nl/en/education/fees-and-funding/tuition-fees/tuition-fees.html",
  },
  "uu-bi": {
    tuition: "€25,306（非欧盟）",
    tuitionEur: 25306,
    tuitionUrl: "https://www.uu.nl/en/masters/business-informatics",
  },
};

for (const [id, tuition] of Object.entries(tuitionPatches)) {
  const isTilburg = id.startsWith("tilburg-") || id === "jads-dsbe";
  enrichments[id] = {
    ...enrichments[id],
    tuition: tuition.tuition,
    tuitionEur: tuition.tuitionEur,
    tuitionAcademicYear: "2026/27",
    applicationLinks: {
      ...enrichments[id].applicationLinks,
      tuitionUrl: tuition.tuitionUrl,
      ...(isTilburg ? { tuitionCalculatorUrl: TILBURG_TUITION_ROADMAP_URL } : {}),
    },
  };
}

const universityFacts = {
  tilburg: {
    livingCostMonthlyMinEur: 1000,
    livingCostMonthlyMaxEur: 1200,
    livingCostSourceUrl: TILBURG_LIVING_COST_URL,
    factsFetchedAt: FETCHED_AT,
  },
};

const chinaProfiles = {
  utwente: chinaBackground(
    "restricted",
    "high",
    "官网会综合 985 / 211 / 双一流及其他院校层次",
    "Chinese applicants need a four-year Bachelor's degree and at least 75% CGPA; the institution attended is also reviewed.",
    "不是双非自动拒绝，但本科院校层次会直接参与审理；75% 只是最低线，课程匹配仍单独评估。",
    "论坛可见 UT 录取与双非申请样本，但项目和背景信息有限，不能据此推导安全分。",
    "https://www.utwente.nl/en/education/master/admission-requirements/",
    [{ platform: "forum", title: "UT Offer 讨论", url: "https://bbs.gter.net/thread-2538520-1-23.html", note: "仅能确认社区存在录取讨论，背景信息不完整。", relevance: "school" }],
  ),
  tilburg: chinaBackground(
    "accepted",
    "high",
    "官网明确欢迎所有学校/大学申请",
    "We welcome students from all schools/universities to apply; the Admissions Committee decides on the complete application.",
    "无公开 985/211 硬名单。重点是学术学位、课程清单、英语及项目要求的 GMAT/GRE。",
    "可复核平台有双非获得 Tilburg 硕士或预科录取案例；项目跨度较大，只能证明非自动拒绝。",
    "https://www.tilburguniversity.edu/education/masters-programs/admission-application",
    [
      { platform: "agency", title: "双非跨专业 Tilburg 录取案例", url: "https://m.igo.cn/liuxue/case/detail.php?caseid=20201203000005", note: "国内二本、英语背景，获得 Data Science and Society 硕士预科录取；2020 年案例。", relevance: "program" },
      { platform: "agency", title: "Tilburg / Maastricht 双非案例", url: "https://www.admitwrite.com/home/tutor.html?FAHNBE=xsxl2023120908cadhen&page=117", note: "青岛大学背景获得 Tilburg 与 Maastricht 硕士/预科录取，时间较早。", relevance: "school" },
    ],
  ),
  maastricht: chinaBackground(
    "accepted",
    "medium",
    "未公开中国院校硬名单，SBE 逐份审理",
    "International university and university of applied sciences diplomas may be assessed; the Board evaluates the complete application.",
    "双非可递交，不等于自动满足学历层次。SBE 更应关注统计课程、GPA 与 GMAT/GRE 路径。",
    "历史平台存在双非获 Maastricht 商科录取案例，但不是本次两个项目且年份较早，参考强度有限。",
    "https://www.maastrichtuniversity.nl/education/master/programmes/business-intelligence-and-smart-services/admission-requirements",
    [{ platform: "agency", title: "双非 Finance 录取案例", url: "https://www.shepherd-edu.com/c/%E6%88%90%E5%8A%9F%E6%A1%88%E4%BE%8B23%E8%8D%B7%E5%85%B0%E9%87%91%E8%9E%8D%E7%A1%95%E5%A3%AB%E5%85%A8%E5%BD%95%E5%8F%96%E4%B8%8A", note: "双非、较高 GPA/雅思/GMAT 获 Maastricht Finance 录取；2019 年相邻项目案例。", relevance: "adjacent" }],
  ),
  vu: chinaBackground(
    "accepted",
    "medium",
    "无公开中国院校名单，按 WO 学士等同与课程逐案评估",
    "VU assesses every non-Dutch diploma individually using Nuffic and equivalent sources, plus programme-specific requirements.",
    "双非不是公开硬拒条件；核心风险是学历是否等同荷兰研究型大学学士，以及先修课程是否充分。",
    "可复核平台有双非 Business Analytics 录取样本，但年份较早且不是当前两个项目。",
    "https://vu.nl/en/education/more-about/admissible-non-dutch-diploma-master",
    [{ platform: "agency", title: "VU Business Analytics 双非录取", url: "https://ishare.ifeng.com/c/s/v002onYCBqhELgDwvhpe--UrpNYyTr8rYakVLELEl24agrcc__", note: "双非、GPA 3.51/4、GMAT 700 的 2017 年相邻项目案例。", relevance: "adjacent" }],
  ),
  radboud: chinaBackground(
    "accepted",
    "medium",
    "Information Sciences 属理学院，官网未列中国院校硬名单",
    "A foreign Bachelor's degree must be equivalent to a Dutch research-university Bachelor and be in the same area of study.",
    "本项目未见 985/211 硬名单；主要审查研究型学士等同和专业/课程匹配。",
    "留学平台称管理与法学院曾偏向 985/211、其他学院可收双非；该说法非官网且较旧，仅作低权重佐证。",
    "https://www.ru.nl/en/education/application-and-admission/application-procedure-masters",
    [
      { platform: "agency", title: "Radboud 中国背景说明", url: "https://www.jjl.cn/article/1131659.html", note: "2023 年平台资料，称管理/法学院与其他学院政策不同；非官方。", relevance: "school" },
      { platform: "reddit", title: "Radboud 申请讨论", url: "https://www.reddit.com/r/StudyInTheNetherlands/comments/18ksn1x/what_are_the_best_universities_for_computer/", note: "国际申请者围绕 GPA 和计算机项目机会的讨论，不含中国院校名单。", relevance: "adjacent" },
    ],
  ),
  uva: chinaBackground(
    "accepted",
    "medium",
    "无公开中国院校硬名单；项目按学位、先修学分与排名择优",
    "International applicants are assessed on an academic Bachelor's degree, formal prerequisite credits and programme selection criteria.",
    "双非可申请，但 Information Studies 有名额和先修学分筛选；院校背景不能替代正式课程证明。",
    "知乎整理与 Reddit 项目录取讨论能验证项目审理方式，但没有足够中国双非样本可估算录取率。",
    "https://www.uva.nl/shared-content/programmas/en/masters/information-studies-data-science/application-and-admission/international-prior-education/international-prior-education-foldout-menu.html",
    [
      { platform: "zhihu", title: "UvA Information Studies 条件整理", url: "https://www.zhihu.com/en/article/613668026", note: "整理了正式先修学分、GPA 和限额；2023 年，需以当前官网为准。", relevance: "program" },
      { platform: "reddit", title: "UvA Data Science 录取讨论", url: "https://www.reddit.com/r/universityofamsterdam/comments/1bovi7t/am_i_accepted_to_uva/", note: "2024 年项目录取邮件讨论，不含中国院校层次。", relevance: "program" },
    ],
  ),
  uu: chinaBackground(
    "accepted",
    "low",
    "官网未列中国院校硬名单，招生委员会逐案判断学历等同",
    "The programme Admissions Committee decides whether the degree is equivalent to a Dutch academic Bachelor's degree and meets the specific entry requirements.",
    "未见双非自动拒绝条款；Business Informatics 仍以研究型学历、计算/信息课程和整体竞争力为主。",
    "平台有 UU 其他计算与社科项目的双非录取样本，但不是 Business Informatics，只能证明学校层面并非统一硬拒。",
    "https://www.uu.nl/en/masters/business-informatics/application-and-admission/degree-from-a-non-dutch-university",
    [{ platform: "agency", title: "UU 录取案例库", url: "https://crm.applysquare.com/institute-cn/nl.uu%2Ccase/", note: "含 2024 年双非申请标签和计算相关项目案例；项目不完全相同。", relevance: "school" }],
  ),
};

const chinaProfileByProgram = {
  "utwente-bit": "utwente",
  "maastricht-biss": "maastricht",
  "maastricht-dbe": "maastricht",
  "tilburg-im-strategy": "tilburg",
  "tilburg-im-intelligence": "tilburg",
  "tilburg-dss-business": "tilburg",
  "jads-dsbe": "tilburg",
  "vu-dbi": "vu",
  "vu-is": "vu",
  "radboud-is": "radboud",
  "uva-ds": "uva",
  "uva-is": "uva",
  "uu-bi": "uu",
};

for (const [id, profile] of Object.entries(chinaProfileByProgram)) {
  enrichments[id] = { ...enrichments[id], chinaEligibility: structuredClone(chinaProfiles[profile]) };
}

function completeness(program) {
  const values = [
    program.degreeType,
    program.language,
    program.duration,
    program.ects,
    program.deadline,
    program.tuitionEur != null,
    program.coreCourses.length,
    program.admissionCriteria.length,
    program.requirements.length,
    program.city,
    program.overview,
    program.applicationDates.length,
    program.testRequirements.length,
    program.premasterInfo,
    program.applicationLinks.eligibilityUrl || program.sourceUrl,
  ];
  return Math.round(values.filter(Boolean).length / values.length * 100);
}

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

export async function applyOfficialCatalog({
  baseUrl = process.env.EU_MASTER_BASE_URL || "http://127.0.0.1:3000",
  fetchImpl = fetch,
  logger = console,
  programIds = Object.keys(enrichments),
  universityIds = Object.keys(universityFacts),
} = {}) {
  const origin = new URL(baseUrl.replace(/\/$/, ""));
  const health = await readJson(await fetchImpl(new URL("/api/health", origin), { cache: "no-store" }));
  if (health.status !== "ready" || health.storage?.catalogMode !== "local") throw new Error("请先以本地 CSV 模式启动网站，再运行官方项目资料导入。");

  for (const id of universityIds) {
    const patch = universityFacts[id];
    if (!patch) throw new Error(`未知学校：${id}`);
    await readJson(await fetchImpl(new URL(`/api/catalog/universities/${encodeURIComponent(id)}`, origin), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }));
    logger.log(`[catalog:official] ${id}: 生活费 €${patch.livingCostMonthlyMinEur}–€${patch.livingCostMonthlyMaxEur} / 月`);
  }

  const results = [];
  for (const id of programIds) {
    const patch = enrichments[id];
    if (!patch) throw new Error(`未知项目：${id}`);
    const current = await readJson(await fetchImpl(new URL(`/api/catalog/programs/${encodeURIComponent(id)}`, origin), { cache: "no-store" }));
    const stored = { ...current };
    delete stored.universities;
    delete stored.sources;
    delete stored.pendingChanges;
    const next = {
      ...stored,
      ...patch,
      applicationLinks: { ...stored.applicationLinks, ...patch.applicationLinks },
      lastFetchedAt: FETCHED_AT,
      updatedAt: FETCHED_AT,
    };
    next.dataCompleteness = completeness(next);
    const saved = await readJson(await fetchImpl(new URL(`/api/catalog/programs/${encodeURIComponent(id)}`, origin), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    }));
    results.push({ id, completeness: saved.dataCompleteness, criteria: saved.admissionCriteria.length, requirements: saved.requirements.length, tests: saved.testRequirements.length });
    logger.log(`[catalog:official] ${id}: ${saved.dataCompleteness}% / ${saved.admissionCriteria.length} 条条件 / ${saved.requirements.length} 份材料 / ${saved.testRequirements.length} 项考试`);
  }
  return results;
}

async function main() {
  try {
    const results = await applyOfficialCatalog();
    console.log(`[catalog:official] 已写入 ${results.length} 个项目。`);
  } catch (error) {
    console.error(`[catalog:official] ${error instanceof Error ? error.message : "导入失败。"}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
