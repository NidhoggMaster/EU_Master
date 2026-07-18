import type { Material } from "./types";

const SEEDED_AT = "2026-07-19T00:00:00.000Z";

const items: Array<Pick<Material, "id" | "title" | "type" | "notes">> = [
  { id: "basic-passport", title: "护照", type: "passport", notes: "检查有效期，并保留清晰彩色扫描件。" },
  { id: "basic-transcript", title: "中英文成绩单", type: "transcript", notes: "准备学校盖章版本；如仍在读，后续补最终成绩单。" },
  { id: "basic-enrollment-certificate", title: "中英文在读证明", type: "enrollment_certificate", notes: "在读申请人使用；毕业后可归档。" },
  { id: "basic-degree-certificate", title: "中英文学位 / 毕业证书", type: "degree_certificate", notes: "尚未毕业时保持未准备，取得后上传正式版本。" },
  { id: "basic-grading-scale", title: "学校评分标准", type: "grading_scale", notes: "优先使用成绩单背面或学校官方评分说明。" },
  { id: "basic-course-descriptions", title: "核心课程描述", type: "course_description", notes: "集中准备数学、统计、编程、信息系统和商科定量课程说明。" },
  { id: "basic-cv", title: "英文简历", type: "cv", notes: "保留可编辑源文件，并按项目需要生成投递版本。" },
  { id: "basic-english-test", title: "英语考试成绩", type: "english_test", notes: "记录成绩有效期和官方送分要求。" },
  { id: "basic-gre-gmat", title: "GRE / GMAT 成绩", type: "gre_gmat", notes: "仅在目标项目要求或用于增强定量证明时准备。" },
  { id: "basic-financial-document", title: "签证与资金材料", type: "financial_document", notes: "按录取后的签证和学校资金证明要求更新。" },
];

export const BASIC_MATERIAL_SEED_VERSION = "1";

export const defaultBasicMaterials: Material[] = items.map((item) => ({
  ...item,
  status: "draft",
  currentVersionId: "",
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
  scope: "basic",
  programId: "",
  requirementId: "",
  prepared: false,
  archived: false,
}));
