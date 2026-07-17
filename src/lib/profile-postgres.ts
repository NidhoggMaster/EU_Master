import "server-only";

import { applicantProfileSchema } from "./profile-schema";
import { withDb } from "./server/postgres";
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
  return withDb(async (client) => {
    const result = await client.query<ProfileRow>(
      `select ${returnedColumns}
       from private.applicant_profiles
       where id = $1
       limit 1`,
      ["current"],
    );
    return result.rows[0] ? rowToProfile(result.rows[0]) : undefined;
  });
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
  return withDb(async (client) => {
    const result = await client.query<ProfileRow>(
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
  });
}
