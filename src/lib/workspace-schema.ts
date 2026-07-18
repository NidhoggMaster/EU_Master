import { z } from "zod";
import { MATERIAL_TYPES } from "./types";

export const materialSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(180),
  type: z.enum(MATERIAL_TYPES),
  status: z.enum(["draft", "ready", "expired"]),
  currentVersionId: z.string().min(1).max(100),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const requirementSnapshotSchema = z.object({
  id: z.string().min(1).max(100), sourceRequirementId: z.string().max(100), title: z.string().min(1).max(300),
  materialType: z.enum(MATERIAL_TYPES), required: z.boolean(), originalText: z.string().max(20_000), materialId: z.string().max(100), satisfied: z.boolean(),
});

const applicationTaskSchema = z.object({
  id: z.string().min(1).max(100), title: z.string().min(1).max(300), dueDate: z.string().max(30), completed: z.boolean(), createdAt: z.string(),
});

export const applicationSchema = z.object({
  id: z.string().min(1).max(100), programId: z.string().min(1).max(120), programName: z.string().min(1).max(300),
  intake: z.string().max(120), deadline: z.string().max(30), status: z.enum(["planning", "preparing", "submitted", "offer", "rejected", "withdrawn"]),
  requirements: z.array(requirementSnapshotSchema).max(300), tasks: z.array(applicationTaskSchema).max(500), requirementsSourceUpdatedAt: z.string(),
  createdAt: z.string(), updatedAt: z.string(),
});

export function validateMaterialFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["pdf", "doc", "docx", "jpg", "jpeg", "png"].includes(extension)) throw new Error("仅支持 PDF、Word、JPG 和 PNG 文件。");
  if (!file.size) throw new Error("不能上传空文件。");
  if (file.size > 20 * 1024 * 1024) throw new Error("单个文件不能超过 20 MB。");
}
