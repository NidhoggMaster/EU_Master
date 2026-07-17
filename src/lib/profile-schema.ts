import { z } from "zod";
import type { ApplicantProfile } from "./types";

const shortText = (maximum: number) => z.string().max(maximum);
const email = z.string().max(254).refine(
  (value) => !value || /^\S+@\S+\.\S+$/.test(value),
  "请输入有效的邮箱地址。",
);

const educationRecordSchema = z.object({
  id: shortText(64),
  institution: shortText(200),
  degree: shortText(200),
  major: shortText(200),
  gpa: shortText(40),
  startYear: shortText(20),
  endYear: shortText(20),
});

const courseSchema = z.object({
  id: shortText(64),
  name: shortText(200),
  grade: shortText(40),
  credits: shortText(40),
  category: shortText(120),
});

const testScoreSchema = z.object({
  id: shortText(64),
  type: z.enum(["IELTS", "TOEFL", "GRE", "GMAT", "其他"]),
  score: shortText(80),
  testDate: shortText(40),
});

const experienceSchema = z.object({
  id: shortText(64),
  type: z.enum(["实习", "项目", "科研", "奖项", "其他"]),
  organization: shortText(200),
  title: shortText(200),
  startDate: shortText(80),
  endDate: shortText(80),
  description: shortText(5_000),
});

export const applicantProfileSchema: z.ZodType<ApplicantProfile> = z.object({
  id: z.literal("current"),
  basic: z.object({
    fullName: shortText(120),
    email,
    nationality: shortText(120),
    currentCity: shortText(120),
  }),
  education: z.array(educationRecordSchema).max(20),
  courses: z.array(courseSchema).max(100),
  tests: z.array(testScoreSchema).max(20),
  experiences: z.array(experienceSchema).max(50),
  skills: z.array(shortText(120)).max(100),
  preferences: z.object({
    countries: z.array(shortText(120)).max(50),
    fields: z.array(shortText(200)).max(50),
    intake: shortText(120),
    budget: shortText(120),
    cityPreference: shortText(200),
    employmentPreference: shortText(2_000),
  }),
  updatedAt: z.string().max(64).refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "更新时间格式不正确。",
  ),
});
