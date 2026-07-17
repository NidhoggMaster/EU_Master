export const PROGRAM_CATEGORIES = ["business", "information", "computer", "data"] as const;
export type ProgramCategory = (typeof PROGRAM_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ProgramCategory, string> = {
  business: "商科",
  information: "信息",
  computer: "计算机",
  data: "数据",
};

export const MATERIAL_TYPES = [
  "transcript",
  "degree_certificate",
  "enrollment_certificate",
  "grading_scale",
  "course_description",
  "cv",
  "motivation_letter",
  "recommendation_letter",
  "english_test",
  "gre_gmat",
  "passport",
  "portfolio",
  "writing_sample",
  "thesis",
  "application_form",
  "financial_document",
  "other",
] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  transcript: "成绩单",
  degree_certificate: "学位证书",
  enrollment_certificate: "在读证明",
  grading_scale: "评分标准",
  course_description: "课程描述",
  cv: "简历",
  motivation_letter: "动机信",
  recommendation_letter: "推荐信",
  english_test: "语言成绩",
  gre_gmat: "GRE / GMAT",
  passport: "护照",
  portfolio: "作品集",
  writing_sample: "写作样本",
  thesis: "论文",
  application_form: "申请表",
  financial_document: "财务材料",
  other: "其他",
};

export interface University {
  id: string;
  name: string;
  shortName: string;
  city: string;
  country: "NL";
  homepageUrl: string;
  catalogUrl: string;
  allowedHosts: string[];
}

export interface ProgramRequirement {
  id: string;
  category: string;
  materialType: MaterialType;
  required: boolean;
  title: string;
  originalText: string;
  structuredRequirement: string;
  intake: string;
  sourceUrl: string;
  fetchedAt?: string;
  verificationState: "manual" | "pending" | "confirmed";
  confidence?: number;
}

export interface Program {
  id: string;
  institutionIds: string[];
  name: string;
  categories: ProgramCategory[];
  sourceUrl: string;
  faculty: string;
  degreeType: string;
  language: string;
  duration: string;
  ects: string;
  mode: string;
  intakes: string[];
  deadline: string;
  tuition: string;
  applicationFee: string;
  applicationPlatform: string;
  premaster: string;
  quota: string;
  requirements: ProgramRequirement[];
  lastFetchedAt?: string;
  createdAt: string;
  updatedAt: string;
  seeded: boolean;
}

export interface EducationRecord {
  id: string;
  institution: string;
  degree: string;
  major: string;
  gpa: string;
  startYear: string;
  endYear: string;
}

export interface Course {
  id: string;
  name: string;
  grade: string;
  credits: string;
  category: string;
}

export interface TestScore {
  id: string;
  type: "IELTS" | "TOEFL" | "GRE" | "GMAT" | "其他";
  score: string;
  testDate: string;
}

export interface Experience {
  id: string;
  type: "实习" | "项目" | "科研" | "奖项" | "其他";
  organization: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ApplicantProfile {
  id: "current";
  basic: {
    fullName: string;
    email: string;
    nationality: string;
    currentCity: string;
  };
  education: EducationRecord[];
  courses: Course[];
  tests: TestScore[];
  experiences: Experience[];
  skills: string[];
  preferences: {
    countries: string[];
    fields: string[];
    intake: string;
    budget: string;
    cityPreference: string;
    employmentPreference: string;
  };
  updatedAt: string;
}

export interface Material {
  id: string;
  title: string;
  type: MaterialType;
  status: "draft" | "ready" | "expired";
  currentVersionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialVersion {
  id: string;
  materialId: string;
  version: number;
  fileName: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: string;
}

export interface ApplicationRequirementSnapshot {
  id: string;
  sourceRequirementId: string;
  title: string;
  materialType: MaterialType;
  required: boolean;
  originalText: string;
  materialId: string;
  satisfied: boolean;
}

export interface ApplicationTask {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  createdAt: string;
}

export interface Application {
  id: string;
  programId: string;
  programName: string;
  intake: string;
  deadline: string;
  status: "planning" | "preparing" | "submitted" | "offer" | "rejected" | "withdrawn";
  requirements: ApplicationRequirementSnapshot[];
  tasks: ApplicationTask[];
  requirementsSourceUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SourceSnapshot {
  id: string;
  programId: string;
  sourceUrl: string;
  fetchedAt: string;
  contentHash: string;
  parserVersion: string;
  excerpts: string[];
}

export interface FieldChange {
  id: string;
  programId: string;
  field: string;
  label: string;
  previousValue: string;
  proposedValue: string;
  sourceUrl: string;
  excerpt: string;
  confidence: number;
  risk: "low" | "review";
  status: "applied" | "pending" | "accepted" | "rejected";
  createdAt: string;
}

export interface DiscoveryCandidate {
  name: string;
  sourceUrl: string;
  universityId: string;
  category: ProgramCategory;
  matchedKeywords: string[];
}

export interface CatalogRefreshResult {
  automaticUpdates: Omit<FieldChange, "id" | "programId" | "status" | "createdAt">[];
  reviewItems: Omit<FieldChange, "id" | "programId" | "status" | "createdAt">[];
  snapshot: Omit<SourceSnapshot, "id" | "programId">;
  warnings: string[];
}

export interface BackupRecords {
  profile?: ApplicantProfile;
  universities: University[];
  programs: Program[];
  materials: Material[];
  materialVersions: Omit<MaterialVersion, "blob">[];
  applications: Application[];
  sourceSnapshots: SourceSnapshot[];
  fieldChanges: FieldChange[];
}
