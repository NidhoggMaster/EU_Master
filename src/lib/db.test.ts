import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { createBackup, inspectBackup } from "./backup";
import { cacheCatalogPrograms, createMaterial, deleteApplication, getApplications, getLocalCatalogRows, getMaterials, getPrograms, getUniversities, saveApplication, saveProfile } from "./db";
import { emptyProfile } from "./progress";

describe("local database and backup", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "crypto", { value: globalThis.crypto, configurable: true });
  });

  it("seeds fourteen universities and thirteen sample programs", async () => {
    expect(await getUniversities()).toHaveLength(14);
    expect(await getPrograms()).toHaveLength(13);
  });

  it("stores file blobs with material metadata", async () => {
    const file = new File(["test transcript"], "transcript.pdf", { type: "application/pdf" });
    await createMaterial("本科成绩单", "transcript", "ready", file);
    const materials = await getMaterials();
    expect(materials.some((item) => item.title === "本科成绩单" && item.status === "ready")).toBe(true);
  });

  it("stores collected programs as normalized local table rows", async () => {
    const [program] = await getPrograms();
    await cacheCatalogPrograms([program], { [program.institutionIds[0]]: "测试大学" });
    const rows = await getLocalCatalogRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: program.id,
      programName: program.name,
      universities: "测试大学",
      sourceUrl: program.sourceUrl,
    });
    expect(rows[0].categories).toContain(program.categories[0]);
  });

  it("deletes an application workspace without deleting the catalogue program", async () => {
    const [program] = await getPrograms();
    const application = { id: crypto.randomUUID(), programId: program.id, programName: program.name, intake: "2027 September", deadline: "", status: "planning" as const, requirements: [], tasks: [], requirementsSourceUpdatedAt: program.updatedAt, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await saveApplication(application);
    await deleteApplication(application.id);
    expect((await getApplications()).some((item) => item.id === application.id)).toBe(false);
    expect((await getPrograms()).some((item) => item.id === program.id)).toBe(true);
  });

  it("creates a complete readable zip backup", async () => {
    const profile = emptyProfile();
    profile.basic.fullName = "测试用户";
    profile.basic.email = "test@example.com";
    await saveProfile(profile);
    const result = await createBackup();
    const file = new File([result.blob], result.fileName, { type: result.blob.type });
    const inspected = await inspectBackup(file);
    expect(inspected.records.profile?.basic.fullName).toBe("测试用户");
    expect(inspected.summary.programs).toBe(1);
    expect(inspected.records.catalogTableRows?.[0].programName).toBeTruthy();
    expect(inspected.summary.files).toBeGreaterThan(0);
  });
});
