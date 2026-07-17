import "server-only";

import { Pool, type PoolConfig } from "pg";
import { applicantProfileSchema } from "./profile-schema";
import type { ApplicantProfile } from "./types";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  nationality: string;
  current_city: string;
  education: ApplicantProfile["education"];
  courses: ApplicantProfile["courses"];
  tests: ApplicantProfile["tests"];
  experiences: ApplicantProfile["experiences"];
  skills: ApplicantProfile["skills"];
  preferences: ApplicantProfile["preferences"];
  client_updated_at: Date | string | null;
  updated_at: Date | string;
};

const globalForProfilePool = globalThis as typeof globalThis & {
  euMasterProfilePool?: Pool;
};

function sessionPoolerUrl() {
  const connectionString = process.env.SUPABASE_SESSION_POOLER_URL;
  if (!connectionString) {
    throw new Error("缺少 SUPABASE_SESSION_POOLER_URL 服务端环境变量。");
  }

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("SUPABASE_SESSION_POOLER_URL 不是有效的 PostgreSQL 连接串。");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("SUPABASE_SESSION_POOLER_URL 必须使用 postgres:// 或 postgresql://。");
  }
  if (parsed.port !== "5432" || !parsed.hostname.endsWith(".pooler.supabase.com")) {
    throw new Error("请使用 Supabase Session Pool 连接串（pooler.supabase.com，端口 5432）。");
  }
  parsed.searchParams.set("sslmode", "verify-full");
  return parsed.toString();
}

function poolSize() {
  const requested = Number.parseInt(process.env.SUPABASE_SESSION_POOL_MAX || "5", 10);
  return Number.isFinite(requested) ? Math.min(10, Math.max(1, requested)) : 5;
}

export function getProfilePool() {
  if (!globalForProfilePool.euMasterProfilePool) {
    const config: PoolConfig = {
      connectionString: sessionPoolerUrl(),
      application_name: "eu-master-profile-api",
      max: poolSize(),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
      ssl: { rejectUnauthorized: true },
    };
    globalForProfilePool.euMasterProfilePool = new Pool(config);
  }
  return globalForProfilePool.euMasterProfilePool;
}

function timestamp(value: Date | string | null) {
  return value instanceof Date ? value.toISOString() : value;
}

function rowToProfile(row: ProfileRow): ApplicantProfile {
  return applicantProfileSchema.parse({
    id: row.id,
    basic: {
      fullName: row.full_name,
      email: row.email,
      nationality: row.nationality,
      currentCity: row.current_city,
    },
    education: row.education,
    courses: row.courses,
    tests: row.tests,
    experiences: row.experiences,
    skills: row.skills,
    preferences: row.preferences,
    updatedAt: timestamp(row.client_updated_at) || timestamp(row.updated_at),
  });
}

const returnedColumns = `
  id, full_name, email, nationality, current_city,
  education, courses, tests, experiences, skills, preferences,
  client_updated_at, updated_at
`;

export async function getStoredProfile() {
  const result = await getProfilePool().query<ProfileRow>(
    `select ${returnedColumns}
     from private.applicant_profiles
     where id = $1
     limit 1`,
    ["current"],
  );
  return result.rows[0] ? rowToProfile(result.rows[0]) : undefined;
}

export async function upsertStoredProfile(profile: ApplicantProfile) {
  const values = [
    profile.id,
    profile.basic.fullName,
    profile.basic.email,
    profile.basic.nationality,
    profile.basic.currentCity,
    JSON.stringify(profile.education),
    JSON.stringify(profile.courses),
    JSON.stringify(profile.tests),
    JSON.stringify(profile.experiences),
    JSON.stringify(profile.skills),
    JSON.stringify(profile.preferences),
    profile.updatedAt,
  ];
  const result = await getProfilePool().query<ProfileRow>(
    `insert into private.applicant_profiles (
       id, full_name, email, nationality, current_city,
       education, courses, tests, experiences, skills, preferences, client_updated_at
     ) values (
       $1, $2, $3, $4, $5,
       $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::timestamptz
     )
     on conflict (id) do update set
       full_name = excluded.full_name,
       email = excluded.email,
       nationality = excluded.nationality,
       current_city = excluded.current_city,
       education = excluded.education,
       courses = excluded.courses,
       tests = excluded.tests,
       experiences = excluded.experiences,
       skills = excluded.skills,
       preferences = excluded.preferences,
       client_updated_at = excluded.client_updated_at,
       updated_at = now()
     returning ${returnedColumns}`,
    values,
  );
  return rowToProfile(result.rows[0]);
}
