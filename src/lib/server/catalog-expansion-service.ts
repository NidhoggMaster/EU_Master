import "server-only";

import { catalogExpansionPrograms } from "@/lib/catalog-expansion-data";
import { getSeededProgram, universities as seededUniversities } from "@/lib/catalog-data";
import type { Program, ProgramDetail } from "@/lib/types";
import {
  confirmProgramSeedSource,
  getProgramDetail,
  updateProgram,
  updateUniversityFacts,
  upsertCandidate,
} from "./catalog-repository";
import {
  getLocalProgramDetail,
  updateLocalProgram,
  updateLocalUniversity,
  upsertLocalCandidate,
} from "./local-store";

function plainProgram(detail: ProgramDetail): Program {
  const program = { ...detail } as Partial<ProgramDetail>;
  delete program.universities;
  delete program.sources;
  delete program.pendingChanges;
  return program as Program;
}

function mergeOfficialSeed(existing: ProgramDetail, seed: Program): Program {
  const current = plainProgram(existing);
  const merged = {
    ...current,
    ...seed,
    createdAt: current.createdAt || seed.createdAt,
    updatedAt: new Date().toISOString(),
    seeded: true,
    fieldLocks: [...new Set([...current.fieldLocks, ...seed.fieldLocks])],
    admissionProbabilityPrior: current.admissionProbabilityPrior ?? seed.admissionProbabilityPrior,
  } satisfies Program;
  for (const field of current.fieldLocks) {
    if (field in current) {
      (merged as unknown as Record<string, unknown>)[field] = (current as unknown as Record<string, unknown>)[field];
    }
  }
  return merged;
}

async function ensureLocalProgram(seed: Program) {
  let detail = await getLocalProgramDetail(seed.id);
  for (const universityId of seed.institutionIds) {
    detail = await upsertLocalCandidate({
      id: seed.id,
      universityId,
      name: seed.name,
      category: seed.categories[0],
      sourceUrl: seed.sourceUrl,
      status: "active",
    });
  }
  if (!detail) throw new Error(`无法在本地创建项目：${seed.id}`);
  await updateLocalProgram(mergeOfficialSeed(detail, seed));
}

async function ensureRemoteProgram(seed: Program) {
  let detail = await getProgramDetail(seed.id);
  for (const universityId of seed.institutionIds) {
    detail = await upsertCandidate({
      id: seed.id,
      universityId,
      name: seed.name,
      category: seed.categories[0],
      sourceUrl: seed.sourceUrl,
      status: "active",
    });
  }
  if (!detail) throw new Error(`无法在 Supabase 创建项目：${seed.id}`);
  await updateProgram(mergeOfficialSeed(detail, seed));
  await confirmProgramSeedSource(seed.id, seed.sourceUrl, seed.name, seed.overview?.fetchedAt ?? seed.updatedAt);
}

export async function applyCatalogExpansion() {
  const seeds = catalogExpansionPrograms.map((item) => getSeededProgram(item.id)).filter(Boolean) as Program[];
  if (seeds.length !== catalogExpansionPrograms.length) throw new Error("项目扩展基线不完整。请先检查 catalog-data。 ");

  for (const university of seededUniversities) await updateLocalUniversity(university);
  for (const seed of seeds) await ensureLocalProgram(seed);

  for (const university of seededUniversities) await updateUniversityFacts(university);
  for (const seed of seeds) await ensureRemoteProgram(seed);

  return {
    local: { universities: seededUniversities.length, programs: seeds.length },
    supabase: { universities: seededUniversities.length, programs: seeds.length },
    totalSeededPrograms: 28,
  };
}
