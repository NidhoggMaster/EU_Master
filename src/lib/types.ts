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
  campusName?: string;
  campusArea?: string;
  locationNotes?: string;
  livingCostMonthlyMinEur?: number | null;
  livingCostMonthlyMaxEur?: number | null;
  livingCostSourceUrl?: string;
  factsFetchedAt?: string;
  rankings?: RankingFact[];
}

export type FactOrigin = "official" | "manual" | "estimated";

export interface FactSource {
  sourceUrl: string;
  sourceTitle?: string;
  originalText: string;
  summaryZh: string;
  fetchedAt?: string;
  origin: FactOrigin;
  locked?: boolean;
}

export interface RankingFact extends FactSource {
  id: string;
  scope: "university" | "subject" | "program";
  provider: string;
  year: number;
  region: string;
  subject: string;
  rank: string;
}

export interface ProgramOverview extends FactSource {
  title: string;
}

export interface CareerOutcome extends FactSource {
  id: string;
  roles: string[];
  employers: string[];
}

export interface ProgramDate extends FactSource {
  id: string;
  intake: string;
  audience: "non_eu" | "eu" | "all";
  kind: "application_open" | "deadline" | "study_start" | "study_end";
  date: string;
}

export interface ProgramTestRequirement extends FactSource {
  id: string;
  test: "IELTS" | "GRE" | "GMAT";
  required: boolean;
  minimumTotal: number | null;
  minimumVerbal: number | null;
  minimumQuantitative: number | null;
  minimumWriting: number | null;
  minimumListening: number | null;
  minimumReading: number | null;
  minimumSpeaking: number | null;
  scoreEdition: string;
  comparisonReference?: string;
  comparisonUrl?: string;
}

export interface ChinaEligibility extends FactSource {
  policy: "unknown" | "accepted" | "restricted" | "institution_list";
  listName: string;
  evidenceLevel?: "high" | "medium" | "low";
  communityConclusion?: string;
  platformsChecked?: string[];
  references?: Array<{
    platform: "official" | "reddit" | "xiaohongshu" | "bilibili" | "youtube" | "zhihu" | "forum" | "agency";
    title: string;
    url: string;
    note: string;
    relevance: "program" | "school" | "adjacent";
  }>;
}

export interface PremasterInfo extends FactSource {
  supported: "yes" | "no" | "unknown";
  nonEuEligible: "yes" | "no" | "unknown";
  requirements: string;
}

export interface ProgramLinks {
  programUrl: string;
  curriculumUrl: string;
  eligibilityUrl: string;
  materialsUrl: string;
  careersUrl: string;
  premasterUrl: string;
  studielinkUrl: string;
  tuitionUrl?: string;
  tuitionCalculatorUrl?: string;
}

export interface AdmissionProbabilityPrior {
  minimum: number;
  maximum: number;
  applicantCount?: number;
  admittedCount?: number;
  year: string;
  sourceUrl: string;
  sourceLabel: string;
  origin: "official" | "manual" | "estimated";
  updatedAt: string;
}

export interface CoreCourse {
  name: string;
  tags: string[];
  sourceUrl?: string;
  nameZh?: string;
  creditsEcts?: number | null;
  originalText?: string;
  summaryZh?: string;
}

export interface AdmissionCriterion {
  id: string;
  kind: "prerequisite" | "degree" | "gpa" | "experience" | "language" | "other";
  title: string;
  description: string;
  required: boolean;
  tags: string[];
  minimum?: number;
  testType?: string;
  sourceUrl: string;
  verificationState: "pending" | "confirmed" | "manual";
  creditsEcts?: number | null;
  summaryZh?: string;
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
  titleOriginal?: string;
  summaryZh?: string;
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
  tuitionEur: number | null;
  tuitionAcademicYear: string;
  applicationFee: string;
  applicationFeeEur: number | null;
  applicationPlatform: string;
  premaster: string;
  quota: string;
  campusName: string;
  city: string;
  campusArea: string;
  locationNotes: string;
  coreCourses: CoreCourse[];
  admissionCriteria: AdmissionCriterion[];
  requirements: ProgramRequirement[];
  dataCompleteness: number;
  status: "active" | "candidate" | "archived";
  lastFetchedAt?: string;
  createdAt: string;
  updatedAt: string;
  seeded: boolean;
  overview: ProgramOverview | null;
  rankings: RankingFact[];
  careerOutcomes: CareerOutcome[];
  applicationDates: ProgramDate[];
  testRequirements: ProgramTestRequirement[];
  chinaEligibility: ChinaEligibility | null;
  premasterInfo: PremasterInfo | null;
  applicationLinks: ProgramLinks;
  admissionProbabilityPrior: AdmissionProbabilityPrior | null;
  fieldLocks: string[];
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
  verbal?: string;
  quantitative?: string;
  writing?: string;
  listening?: string;
  reading?: string;
  speaking?: string;
  edition?: string;
  etsPredictedGmat?: string;
  etsPredictionDate?: string;
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
  scope: "basic" | "program";
  programId: string;
  requirementId: string;
  prepared: boolean;
  notes: string;
  archived: boolean;
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
  startDate?: string;
  endDate?: string;
  studielinkUrl?: string;
  scoreSnapshotId?: string;
}

export interface SourceSnapshot {
  id: string;
  programId: string;
  sourceUrl: string;
  fetchedAt: string;
  contentHash: string;
  parserVersion: string;
  excerpts: string[];
  provider?: "firecrawl" | "direct" | "seed";
}

export interface ProgramSource {
  id: string;
  programId: string;
  sourceUrl: string;
  sourceKind: string;
  title: string;
  provider: "firecrawl" | "direct" | "seed";
  contentHash: string;
  excerpts: string[];
  verificationState: "pending" | "confirmed" | "rejected";
  fetchedAt?: string;
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
  status: "applied" | "pending" | "accepted" | "rejected" | "superseded";
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
  provider?: "firecrawl" | "direct";
}

export interface ProgramDetail extends Program {
  universities: University[];
  sources: ProgramSource[];
  pendingChanges: FieldChange[];
}

export interface ExchangeRate {
  baseCurrency: "EUR";
  quoteCurrency: "CNY";
  effectiveDate: string;
  rate: number;
  sourceUrl: string;
  fetchedAt: string;
  stale: boolean;
}

export const MATCH_DIMENSIONS = ["courses", "degree", "gpa", "experience", "language", "materials", "basicMaterials", "specialMaterials", "project"] as const;
export type MatchDimension = (typeof MATCH_DIMENSIONS)[number];

export interface MatchDimensionScore {
  key: MatchDimension;
  label: string;
  weight: number;
  score: number;
  earned: number;
  reasons: string[];
  missingEvidence: string[];
  known: boolean;
}

export interface ProgramComparison {
  program: ProgramDetail;
  score: number | null;
  evidenceCoverage: number;
  probabilityMinimum: number | null;
  probabilityMaximum: number | null;
  scoreStatus: "ready" | "insufficient" | "hard_risk";
  dataCompleteness: number;
  dimensions: MatchDimensionScore[];
  hardRisks: string[];
  requiredMaterials: MaterialType[];
  readyMaterials: MaterialType[];
  missingMaterials: MaterialType[];
  tuitionEur: number | null;
  livingCostAnnualMinEur: number | null;
  livingCostAnnualMaxEur: number | null;
  firstYearMinEur: number | null;
  firstYearMaxEur: number | null;
  firstYearMinCny: number | null;
  firstYearMaxCny: number | null;
  similarity: number;
}

export interface LocalCatalogRow {
  id: string;
  status: Program["status"];
  universityIds: string[];
  universities: string;
  programName: string;
  categories: string;
  city: string;
  campus: string;
  location: string;
  degreeType: string;
  language: string;
  duration: string;
  ects: string;
  coreCourses: string;
  admissionCriteria: string;
  requiredDocuments: string;
  tuitionEur: number | null;
  tuition: string;
  deadline: string;
  sourceUrl: string;
  sourceCount: number;
  dataCompleteness: number;
  lastFetchedAt: string;
  syncedAt: string;
}

export interface CompareResponse {
  comparisons: ProgramComparison[];
  exchangeRate: ExchangeRate;
  disclaimer: string;
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
  scoreSnapshots?: ScoreSnapshot[];
  matchOverrides?: RequirementMatchOverride[];
  catalogTableRows?: LocalCatalogRow[];
}

export type CatalogMode = "local" | "supabase";

export interface StoredMaterialVersion extends Omit<MaterialVersion, "blob"> {
  filePath: string;
  downloadUrl: string;
}

export interface StorageStatus {
  catalogMode: CatalogMode;
  local: {
    ready: boolean;
    dataDirectory: string;
    privateDataDirectory: string;
    materialDirectory: string;
    migratedFromLegacy: boolean;
    universities: number;
    programs: number;
  };
  supabase: {
    configured: boolean;
    connected: boolean;
    restrictedRole: boolean;
    seededPrograms: number;
    error?: string;
  };
  firecrawl: { configured: boolean };
}

export type ScoreKind = "catalog" | "application";

export interface ScoreSnapshot {
  id: string;
  kind: ScoreKind;
  programId: string;
  applicationId: string;
  score: number | null;
  evidenceCoverage: number;
  probabilityMinimum: number | null;
  probabilityMaximum: number | null;
  hardRisks: string[];
  dimensions: MatchDimensionScore[];
  weights: Record<string, number>;
  weightsVersion: string;
  profileUpdatedAt: string;
  programUpdatedAt: string;
  materialUpdatedAt: string;
  confirmedAt: string;
}

export interface RequirementMatchOverride {
  id: string;
  programId: string;
  criterionId: string;
  state: "matched" | "partial" | "not_matched" | "unknown";
  note: string;
  updatedAt: string;
}

export interface ScoringSettings {
  catalog: Record<MatchDimension, number>;
  application: Record<MatchDimension, number>;
  version: string;
  updatedAt: string;
}

export interface TransferConflict {
  id: string;
  name: string;
  reason: "different" | "identical";
}

export interface TransferPreview {
  from: CatalogMode;
  to: CatalogMode;
  newItems: Array<{ id: string; name: string }>;
  conflicts: TransferConflict[];
}

export interface LegacyMigrationPreview {
  profile: number;
  programs: number;
  materials: number;
  materialVersions: number;
  applications: number;
  sourceSnapshots: number;
  fieldChanges: number;
}
