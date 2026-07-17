import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { createBackup, inspectBackup } from "./backup";
import { createMaterial, getMaterials, getPrograms, getUniversities, saveProfile } from "./db";
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

  it("creates a complete readable zip backup", async () => {
    const profile = emptyProfile();
    profile.basic.fullName = "测试用户";
    profile.basic.email = "test@example.com";
    await saveProfile(profile);
    const result = await createBackup();
    const file = new File([result.blob], result.fileName, { type: result.blob.type });
    const inspected = await inspectBackup(file);
    expect(inspected.records.profile?.basic.fullName).toBe("测试用户");
    expect(inspected.summary.files).toBeGreaterThan(0);
  });
});
