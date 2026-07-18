import "server-only";

import type { PoolClient } from "pg";
import type {
  ApplicantProfile,
  FieldChange,
  Program,
  ProgramCategory,
  ProgramDetail,
  ProgramSource,
  University,
} from "@/lib/types";
import { withDb } from "./postgres";

type Row = Record<string, unknown>;

const numberOrNull = (value: unknown) => value === null || value === undefined ? null : Number(value);
const iso = (value: unknown) => value instanceof Date ? value.toISOString() : value ? String(value) : undefined;

function mapUniversity(row: Row): University {
  return {
    id: String(row.id), name: String(row.name), shortName: String(row.short_name), city: String(row.city), country: "NL",
    homepageUrl: String(row.homepage_url), catalogUrl: String(row.catalog_url), allowedHosts: row.allowed_hosts as string[],
    campusName: String(row.campus_name ?? ""), campusArea: String(row.campus_area ?? ""), locationNotes: String(row.location_notes ?? ""),
    livingCostMonthlyMinEur: numberOrNull(row.living_cost_monthly_min_eur), livingCostMonthlyMaxEur: numberOrNull(row.living_cost_monthly_max_eur),
    livingCostSourceUrl: row.living_cost_source_url ? String(row.living_cost_source_url) : undefined, factsFetchedAt: iso(row.facts_fetched_at),
  };
}

function mapProgram(row: Row): Program {
  return {
    id: String(row.id), institutionIds: (row.institution_ids as string[] | undefined) ?? [], name: String(row.name),
    categories: row.categories as ProgramCategory[], sourceUrl: String(row.source_url), faculty: String(row.faculty ?? ""),
    degreeType: String(row.degree_type ?? ""), language: String(row.language ?? ""), duration: String(row.duration ?? ""), ects: String(row.ects ?? ""),
    mode: String(row.mode ?? ""), intakes: (row.intakes as string[]) ?? [], deadline: String(row.deadline ?? ""), tuition: String(row.tuition ?? ""),
    tuitionEur: numberOrNull(row.tuition_eur), tuitionAcademicYear: String(row.tuition_academic_year ?? ""), applicationFee: String(row.application_fee ?? ""),
    applicationFeeEur: numberOrNull(row.application_fee_eur), applicationPlatform: String(row.application_platform ?? ""), premaster: String(row.premaster ?? ""),
    quota: String(row.quota ?? ""), campusName: String(row.campus_name ?? ""), city: String(row.city ?? ""), campusArea: String(row.campus_area ?? ""),
    locationNotes: String(row.location_notes ?? ""), coreCourses: (row.core_courses as Program["coreCourses"]) ?? [],
    admissionCriteria: (row.admission_criteria as Program["admissionCriteria"]) ?? [], requirements: (row.requirements as Program["requirements"]) ?? [],
    dataCompleteness: Number(row.data_completeness ?? 0), status: row.status as Program["status"], seeded: Boolean(row.seeded),
    lastFetchedAt: iso(row.last_fetched_at), createdAt: iso(row.created_at) ?? "", updatedAt: iso(row.updated_at) ?? "",
  };
}

function mapChange(row: Row): FieldChange {
  return {
    id: String(row.id), programId: String(row.program_id), field: String(row.field), label: String(row.label),
    previousValue: String(row.previous_value ?? ""), proposedValue: String(row.proposed_value ?? ""), sourceUrl: String(row.source_url),
    excerpt: String(row.excerpt ?? ""), confidence: Number(row.confidence), risk: row.risk as FieldChange["risk"],
    status: row.status as FieldChange["status"], createdAt: iso(row.created_at) ?? "",
  };
}

function mapSource(row: Row): ProgramSource {
  return {
    id: String(row.id), programId: String(row.program_id), sourceUrl: String(row.source_url), sourceKind: String(row.source_kind),
    title: String(row.title), provider: row.provider as ProgramSource["provider"], contentHash: String(row.content_hash ?? ""),
    excerpts: row.excerpts as string[], verificationState: row.verification_state as ProgramSource["verificationState"], fetchedAt: iso(row.fetched_at),
  };
}

const baseProgramSql = `select p.*, coalesce(array_agg(pu.university_id order by pu.is_primary desc, pu.university_id) filter (where pu.university_id is not null), '{}') as institution_ids
  from private.programs p left join private.program_universities pu on pu.program_id = p.id`;

export async function listUniversities() {
  return withDb(async (client) => (await client.query("select * from private.universities order by name")).rows.map(mapUniversity));
}

export async function getUniversity(id: string) {
  return withDb(async (client) => {
    const row = (await client.query("select * from private.universities where id = $1", [id])).rows[0];
    return row ? mapUniversity(row) : undefined;
  });
}

export async function listPrograms(filters: { universityId?: string; category?: ProgramCategory; status?: Program["status"] } = {}) {
  return withDb(async (client) => {
    const values: unknown[] = [];
    const where: string[] = [];
    if (filters.universityId) { values.push(filters.universityId); where.push(`exists (select 1 from private.program_universities fpu where fpu.program_id=p.id and fpu.university_id=$${values.length})`); }
    if (filters.category) { values.push([filters.category]); where.push(`p.categories @> $${values.length}::text[]`); }
    values.push(filters.status ?? "active"); where.push(`p.status=$${values.length}`);
    const query = `${baseProgramSql} where ${where.join(" and ")} group by p.id order by p.name`;
    return (await client.query(query, values)).rows.map(mapProgram);
  });
}

async function detailWithClient(client: PoolClient, id: string): Promise<ProgramDetail | undefined> {
  const row = (await client.query(`${baseProgramSql} where p.id=$1 group by p.id`, [id])).rows[0];
  if (!row) return undefined;
  // A pg Client can run only one query at a time. Keep these reads sequential
  // inside the transaction to avoid driver-level interleaving warnings.
  const universities = await client.query("select u.* from private.universities u join private.program_universities pu on pu.university_id=u.id where pu.program_id=$1 order by pu.is_primary desc, u.name", [id]);
  const sources = await client.query("select * from private.program_sources where program_id=$1 order by fetched_at desc nulls last, created_at desc", [id]);
  const changes = await client.query("select * from private.program_field_changes where program_id=$1 and status='pending' order by created_at desc", [id]);
  return { ...mapProgram(row), universities: universities.rows.map(mapUniversity), sources: sources.rows.map(mapSource), pendingChanges: changes.rows.map(mapChange) };
}

export async function getProgramDetail(id: string) {
  return withDb((client) => detailWithClient(client, id));
}

export async function getProgramDetails(ids: string[]) {
  return withDb(async (client) => {
    const details: ProgramDetail[] = [];
    for (const id of ids) {
      const detail = await detailWithClient(client, id);
      if (detail) details.push(detail);
    }
    return details;
  });
}

export async function upsertCandidate(input: { id?: string; universityId: string; name: string; category: ProgramCategory; sourceUrl: string; status?: Program["status"] }) {
  return withDb(async (client) => {
    const existing = (await client.query("select id from private.programs where source_url=$1", [input.sourceUrl])).rows[0];
    const id = existing?.id ? String(existing.id) : input.id ?? crypto.randomUUID();
    await client.query(`insert into private.programs (id,name,categories,source_url,status,seeded) values ($1,$2,$3,$4,$5,false)
      on conflict (id) do update set name=excluded.name,categories=excluded.categories,source_url=excluded.source_url,status=case when private.programs.status='active' then 'active' else excluded.status end,updated_at=now()`,
      [id, input.name, [input.category], input.sourceUrl, input.status ?? "candidate"]);
    await client.query("insert into private.program_universities (program_id,university_id,is_primary) values ($1,$2,true) on conflict do nothing", [id, input.universityId]);
    await client.query(`insert into private.program_sources (program_id,source_url,source_kind,title,provider,verification_state) values ($1,$2,'program',$3,'seed','pending') on conflict (program_id,source_url) do nothing`, [id, input.sourceUrl, input.name]);
    return detailWithClient(client, id);
  });
}

export async function updateProgram(program: Program) {
  return withDb(async (client) => {
    await client.query(`update private.programs set name=$2,categories=$3,source_url=$4,faculty=$5,degree_type=$6,language=$7,duration=$8,ects=$9,mode=$10,intakes=$11,deadline=$12,tuition=$13,tuition_eur=$14,tuition_academic_year=$15,application_fee=$16,application_fee_eur=$17,application_platform=$18,premaster=$19,quota=$20,campus_name=$21,city=$22,campus_area=$23,location_notes=$24,core_courses=$25,admission_criteria=$26,requirements=$27,data_completeness=$28,status=$29,last_fetched_at=$30,updated_at=now() where id=$1`, [
      program.id, program.name, program.categories, program.sourceUrl, program.faculty, program.degreeType, program.language, program.duration, program.ects,
      program.mode, program.intakes, program.deadline, program.tuition, program.tuitionEur, program.tuitionAcademicYear, program.applicationFee,
      program.applicationFeeEur, program.applicationPlatform, program.premaster, program.quota, program.campusName, program.city, program.campusArea,
      program.locationNotes, JSON.stringify(program.coreCourses), JSON.stringify(program.admissionCriteria), JSON.stringify(program.requirements),
      program.dataCompleteness, program.status, program.lastFetchedAt ?? null,
    ]);
    return detailWithClient(client, program.id);
  });
}

export async function getCurrentProfile() {
  return withDb(async (client) => {
    const row = (await client.query("select * from private.applicant_profiles where id='current'")).rows[0];
    if (!row) return undefined;
    return { id: "current", basic: { fullName: row.full_name, email: row.email, nationality: row.nationality, currentCity: row.current_city }, education: row.education, courses: row.courses, tests: row.tests, experiences: row.experiences, skills: row.skills, preferences: row.preferences, updatedAt: iso(row.client_updated_at ?? row.updated_at) ?? "" } satisfies ApplicantProfile;
  });
}

export async function saveCurrentProfile(profile: ApplicantProfile) {
  return withDb(async (client) => {
    await client.query(`insert into private.applicant_profiles (id,full_name,email,nationality,current_city,education,courses,tests,experiences,skills,preferences,client_updated_at)
      values ('current',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (id) do update set full_name=excluded.full_name,email=excluded.email,nationality=excluded.nationality,current_city=excluded.current_city,education=excluded.education,courses=excluded.courses,tests=excluded.tests,experiences=excluded.experiences,skills=excluded.skills,preferences=excluded.preferences,client_updated_at=excluded.client_updated_at,updated_at=now()`,
      [profile.basic.fullName, profile.basic.email, profile.basic.nationality, profile.basic.currentCity, JSON.stringify(profile.education), JSON.stringify(profile.courses), JSON.stringify(profile.tests), JSON.stringify(profile.experiences), JSON.stringify(profile.skills), JSON.stringify(profile.preferences), profile.updatedAt]);
    return profile;
  });
}

export async function latestExchangeRate() {
  return withDb(async (client) => (await client.query("select * from private.exchange_rates where base_currency='EUR' and quote_currency='CNY' order by effective_date desc limit 1")).rows[0]);
}

export async function saveExchangeRate(input: { effectiveDate: string; rate: number; sourceUrl: string; fetchedAt: string }) {
  return withDb(async (client) => {
    await client.query(`insert into private.exchange_rates (base_currency,quote_currency,effective_date,rate,source_url,fetched_at) values ('EUR','CNY',$1,$2,$3,$4) on conflict (base_currency,quote_currency,effective_date) do update set rate=excluded.rate,source_url=excluded.source_url,fetched_at=excluded.fetched_at`, [input.effectiveDate, input.rate, input.sourceUrl, input.fetchedAt]);
  });
}

export async function decideFieldChange(programId: string, changeId: string, decision: "accepted" | "rejected") {
  return withDb(async (client) => {
    const row = (await client.query("select * from private.program_field_changes where id=$1 and program_id=$2 and status='pending' for update", [changeId, programId])).rows[0];
    if (!row) return undefined;
    if (decision === "accepted") {
      const allowed = new Set(["deadline", "tuition", "coreCourses", "admissionCriteria", "requirements", "applicationFee", "premaster"]);
      if (!allowed.has(row.field)) throw new Error("该字段不允许通过审核接口写入。");
      const columns: Record<string,string> = { coreCourses:"core_courses", admissionCriteria:"admission_criteria", applicationFee:"application_fee" };
      const column = columns[row.field] ?? row.field;
      if (row.field === "requirements") {
        const current = (await client.query("select requirements from private.programs where id=$1", [programId])).rows[0]?.requirements ?? [];
        let additions: Program["requirements"];
        try {
          const parsed = JSON.parse(row.proposed_value);
          additions = Array.isArray(parsed) ? parsed.map((item) => ({ ...item, verificationState: "confirmed" })) : [];
        } catch {
          additions = [{ id: crypto.randomUUID(), category: "官网抓取", materialType: "other", required: true, title: row.label, originalText: row.proposed_value, structuredRequirement: row.proposed_value, intake: "", sourceUrl: row.source_url, fetchedAt: new Date().toISOString(), verificationState: "confirmed", confidence: Number(row.confidence) }];
        }
        const merged = [...current, ...additions.filter((addition) => !current.some((item: Program["requirements"][number]) => item.materialType === addition.materialType && item.title === addition.title))];
        await client.query("update private.programs set requirements=$1,updated_at=now() where id=$2", [JSON.stringify(merged), programId]);
      } else {
        const json = ["coreCourses","admissionCriteria"].includes(row.field);
        let value = json ? JSON.parse(row.proposed_value) : row.proposed_value;
        if (row.field === "admissionCriteria" && Array.isArray(value)) value = value.map((item) => ({ ...item, verificationState: "confirmed" }));
        await client.query(`update private.programs set ${column}=$1,updated_at=now() where id=$2`, [json ? JSON.stringify(value) : value, programId]);
      }
    }
    await client.query("update private.program_field_changes set status=$1,decided_at=now() where id=$2", [decision, changeId]);
    if (decision === "accepted") {
      const updated = await detailWithClient(client, programId);
      if (updated) {
        const facts = [updated.degreeType, updated.language, updated.duration, updated.ects, updated.deadline, updated.tuition, updated.coreCourses.length, updated.admissionCriteria.length, updated.requirements.length, updated.city || updated.universities[0]?.city];
        await client.query("update private.programs set data_completeness=$1 where id=$2", [Math.round(facts.filter(Boolean).length / facts.length * 100), programId]);
      }
    }
    return detailWithClient(client, programId);
  });
}

export async function recordRefresh(input: { program: Program; provider: string; snapshot: { sourceUrl: string; fetchedAt: string; contentHash: string; excerpts: string[] }; warnings: string[]; automatic: Omit<FieldChange,"id"|"programId"|"status"|"createdAt">[]; review: Omit<FieldChange,"id"|"programId"|"status"|"createdAt">[] }) {
  return withDb(async (client) => {
    const run = (await client.query("insert into private.program_refresh_runs (program_id,provider,status,warnings,completed_at) values ($1,$2,'succeeded',$3,now()) returning id", [input.program.id,input.provider,JSON.stringify(input.warnings)])).rows[0];
    await client.query(`insert into private.program_sources (program_id,source_url,source_kind,title,provider,content_hash,excerpts,verification_state,fetched_at) values ($1,$2,'program',$3,$4,$5,$6,'confirmed',$7) on conflict (program_id,source_url) do update set provider=excluded.provider,content_hash=excluded.content_hash,excerpts=excluded.excerpts,verification_state='confirmed',fetched_at=excluded.fetched_at`, [input.program.id,input.snapshot.sourceUrl,input.program.name,input.provider,input.snapshot.contentHash,JSON.stringify(input.snapshot.excerpts),input.snapshot.fetchedAt]);
    for (const change of input.automatic) await client.query(`insert into private.program_field_changes (program_id,refresh_run_id,field,label,previous_value,proposed_value,source_url,excerpt,confidence,risk,status,decided_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'applied',now())`, [input.program.id,run.id,change.field,change.label,change.previousValue,change.proposedValue,change.sourceUrl,change.excerpt,change.confidence,change.risk]);
    for (const change of input.review) await client.query(`insert into private.program_field_changes (program_id,refresh_run_id,field,label,previous_value,proposed_value,source_url,excerpt,confidence,risk,status) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')`, [input.program.id,run.id,change.field,change.label,change.previousValue,change.proposedValue,change.sourceUrl,change.excerpt,change.confidence,change.risk]);
    await client.query("update private.programs set last_fetched_at=$1,updated_at=now() where id=$2", [input.snapshot.fetchedAt,input.program.id]);
    return detailWithClient(client, input.program.id);
  });
}

export async function recordRefreshFailure(programId: string, message: string) {
  return withDb(async (client) => {
    await client.query("insert into private.program_refresh_runs (program_id,provider,status,warnings,completed_at,error_message) values ($1,'direct','failed','[]',now(),$2)", [programId, message.slice(0, 1000)]);
  });
}

export async function importProgramDetails(details: ProgramDetail[], overwriteIds: string[] = []) {
  const overwrite = new Set(overwriteIds);
  const imported: string[] = [];
  for (const detail of details) {
    const existing = await getProgramDetail(detail.id);
    if (existing && !overwrite.has(detail.id)) continue;
    if (!existing) {
      const universityId = detail.institutionIds[0];
      const category = detail.categories[0];
      if (!universityId || !category) continue;
      await upsertCandidate({ id: detail.id, universityId, name: detail.name, category, sourceUrl: detail.sourceUrl, status: detail.status });
    }
    await updateProgram(detail);
    await withDb(async (client) => {
      for (const universityId of detail.institutionIds) {
        await client.query("insert into private.program_universities (program_id,university_id,is_primary) values ($1,$2,$3) on conflict do nothing", [detail.id, universityId, universityId === detail.institutionIds[0]]);
      }
      for (const source of detail.sources) {
        const provider = ["seed", "firecrawl", "direct"].includes(source.provider) ? source.provider : "direct";
        await client.query(`insert into private.program_sources (program_id,source_url,source_kind,title,provider,content_hash,excerpts,verification_state,fetched_at)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          on conflict (program_id,source_url) do update set title=excluded.title,provider=excluded.provider,content_hash=excluded.content_hash,excerpts=excluded.excerpts,verification_state=excluded.verification_state,fetched_at=excluded.fetched_at`,
          [detail.id, source.sourceUrl, source.sourceKind || "program", source.title, provider, source.contentHash, JSON.stringify(source.excerpts), source.verificationState, source.fetchedAt ?? null]);
      }
      for (const change of detail.pendingChanges) {
        const duplicate = await client.query("select 1 from private.program_field_changes where program_id=$1 and field=$2 and source_url=$3 and proposed_value=$4 and status='pending' limit 1", [detail.id, change.field, change.sourceUrl, change.proposedValue]);
        if (duplicate.rowCount) continue;
        await client.query(`insert into private.program_field_changes (program_id,field,label,previous_value,proposed_value,source_url,excerpt,confidence,risk,status,created_at)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10)`,
          [detail.id, change.field, change.label, change.previousValue, change.proposedValue, change.sourceUrl, change.excerpt, change.confidence, change.risk, change.createdAt]);
      }
    });
    imported.push(detail.id);
  }
  return imported;
}
