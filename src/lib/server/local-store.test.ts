import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seededPrograms } from "../catalog-data";
import { decodeProfile, decodeProgram, encodeProfile, encodeProgram } from "./local-csv-codec";

vi.mock("server-only", () => ({}));

const store = await import("./local-store");
const backup = await import("./local-backup");
let directory = "";

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "eu-master-local-"));
  process.env.EU_MASTER_DATA_DIR = directory;
  globalThis.euMasterLocalStoreInit = undefined;
  globalThis.euMasterLocalStoreQueue = undefined;
});

afterEach(async () => {
  delete process.env.EU_MASTER_DATA_DIR;
  globalThis.euMasterLocalStoreInit = undefined;
  globalThis.euMasterLocalStoreQueue = undefined;
  await rm(directory, { recursive: true, force: true });
});

describe("local CSV codecs", () => {
  it("round-trips quotes, newlines, Unicode and JSON columns", () => {
    const profile = {
      id: "current" as const,
      basic: { fullName: "吕, \"测试\"\n第二行", email: "test@example.com", nationality: "中国", currentCity: "上海" },
      education: [], courses: [], tests: [], experiences: [], skills: [],
      preferences: { countries: ["荷兰"], fields: ["人工智能"], intake: "2027 September", budget: "€30,000", cityPreference: "", employmentPreference: "" },
      updatedAt: "2026-07-18T00:00:00.000Z",
    };
    const csv = stringify([encodeProfile(profile)], { header: true });
    const [row] = parse(csv, { columns: true });
    expect(decodeProfile(row)).toEqual(profile);
  });

  it("round-trips nested program arrays", () => {
    const program = { ...seededPrograms[0], coreCourses: [{ name: "Data, AI", tags: ["ML", "统计"] }] };
    expect(decodeProgram(encodeProgram(program))).toEqual(program);
  });
});

describe("local CSV store", () => {
  it("initializes private directories and atomically writes CSV files", async () => {
    await store.ensureLocalStore();
    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(join(directory, "programs.csv"))).mode & 0o777).toBe(0o600);
    await store.setCatalogMode("supabase");
    expect(await store.getCatalogMode()).toBe("supabase");
    expect((await readdir(directory)).some((name) => name.endsWith(".tmp"))).toBe(false);
    expect(await readFile(join(directory, "meta.csv"), "utf8")).toContain("catalogMode,supabase");
  });

  it("rejects path traversal and absolute material paths", () => {
    expect(() => store.safeLocalPath("../profile.csv")).toThrow("路径无效");
    expect(() => store.safeLocalPath("/tmp/file")).toThrow("路径无效");
  });

  it("reports the exact damaged CSV row", async () => {
    await store.ensureLocalStore();
    await writeFile(join(directory, "programs.csv"), "id,name\ninvalid,\"unterminated", { mode: 0o600 });
    await expect(store.listLocalPrograms()).rejects.toThrow("programs.csv 无法解析");
  });

  it("rejects valid CSV rows with damaged JSON columns", async () => {
    await store.ensureLocalStore();
    const row = encodeProgram(seededPrograms[0]);
    row.categories = "[broken";
    await writeFile(join(directory, "programs.csv"), stringify([row], { header: true }), { mode: 0o600 });
    await expect(store.listLocalPrograms()).rejects.toThrow("programs.csv 第 2 行无效");
  });

  it("keeps local catalog data when restoring a legacy schema-1 backup", async () => {
    await store.ensureLocalStore();
    const payload = {
      schemaVersion: 1,
      exportedAt: "2026-07-18T00:00:00.000Z",
      records: { universities: [], programs: [], materials: [], materialVersions: [], applications: [], sourceSnapshots: [], fieldChanges: [] },
      files: {},
    };
    const bytes = zipSync({ "backup.json": strToU8(JSON.stringify(payload)) });
    await backup.restoreLocalBackup(bytes, undefined, true);
    expect(await store.listLocalPrograms()).toHaveLength(13);
    expect(await store.listLocalUniversities()).toHaveLength(14);
  });
});
