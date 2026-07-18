import "server-only";

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { z } from "zod";
import type { BackupRecords, LegacyMigrationPreview } from "@/lib/types";
import { importLocalBackupRecords, readLocalBackupRecords, readLocalMaterialFile } from "./local-store";

const MAGIC = strToU8("EUMA");
const ENCRYPTION_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;

const payloadSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  exportedAt: z.string().datetime(),
  records: z.object({
    profile: z.unknown().optional(), universities: z.array(z.unknown()), programs: z.array(z.unknown()), materials: z.array(z.unknown()),
    materialVersions: z.array(z.unknown()), applications: z.array(z.unknown()), sourceSnapshots: z.array(z.unknown()),
    fieldChanges: z.array(z.unknown()), scoreSnapshots: z.array(z.unknown()).optional(), matchOverrides: z.array(z.unknown()).optional(),
    catalogTableRows: z.array(z.unknown()).optional(),
  }),
  files: z.record(z.string(), z.object({ mimeType: z.string(), checksum: z.string().regex(/^[a-f0-9]{64}$/) })),
});

async function checksum(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function deriveKey(password: string, salt: Uint8Array) {
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(bytes: Uint8Array, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, bytes as BufferSource));
  const output = new Uint8Array(33 + ciphertext.length);
  output.set(MAGIC); output[4] = ENCRYPTION_VERSION; output.set(salt, 5); output.set(iv, 21); output.set(ciphertext, 33);
  return output;
}

async function decrypt(bytes: Uint8Array, password: string) {
  if (bytes[4] !== ENCRYPTION_VERSION) throw new Error("不支持这个加密备份版本。");
  try {
    const key = await deriveKey(password, bytes.slice(5, 21));
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(21, 33) as BufferSource }, key, bytes.slice(33) as BufferSource));
  } catch {
    throw new Error("备份密码不正确，或文件已经损坏。");
  }
}

function isEncrypted(bytes: Uint8Array) {
  return MAGIC.every((value, index) => bytes[index] === value);
}

export async function createLocalBackup(password?: string) {
  const { records, versions } = await readLocalBackupRecords();
  const archive: Record<string, Uint8Array> = {};
  const files: Record<string, { mimeType: string; checksum: string }> = {};
  for (const version of versions) {
    const stored = await readLocalMaterialFile(version.id);
    if (!stored) throw new Error(`材料版本 ${version.fileName} 缺少文件内容。`);
    const bytes = new Uint8Array(stored.bytes);
    archive[`files/${version.id}`] = bytes;
    files[version.id] = { mimeType: version.mimeType, checksum: await checksum(bytes) };
  }
  archive["backup.json"] = strToU8(JSON.stringify({ schemaVersion: 3, exportedAt: new Date().toISOString(), records, files }));
  const zipped = zipSync(archive, { level: 6 });
  return password ? encrypt(zipped, password) : zipped;
}

export async function inspectLocalBackup(input: Uint8Array, password?: string) {
  const encrypted = isEncrypted(input);
  let bytes = input;
  if (encrypted) {
    if (!password) throw new Error("这是加密备份，请先输入密码。");
    bytes = await decrypt(input, password);
  }
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(bytes);
  } catch {
    throw new Error("无法读取备份压缩包。");
  }
  if (!archive["backup.json"]) throw new Error("备份中缺少数据清单。");
  let parsed: z.infer<typeof payloadSchema>;
  try {
    parsed = payloadSchema.parse(JSON.parse(strFromU8(archive["backup.json"])));
  } catch {
    throw new Error("备份数据清单无效或已损坏。");
  }
  const records = parsed.records as BackupRecords;
  const versions = [];
  for (const metadata of records.materialVersions) {
    const fileBytes = archive[`files/${metadata.id}`];
    const expected = parsed.files[metadata.id];
    if (!fileBytes || !expected) throw new Error(`材料版本 ${metadata.fileName} 缺少文件内容。`);
    if ((await checksum(fileBytes)) !== expected.checksum) throw new Error(`材料版本 ${metadata.fileName} 校验失败。`);
    versions.push({ ...metadata, mimeType: expected.mimeType, bytes: fileBytes });
  }
  const summary: LegacyMigrationPreview = {
    profile: records.profile ? 1 : 0,
    programs: records.programs.length,
    materials: records.materials.length,
    materialVersions: versions.length,
    applications: records.applications.length,
    sourceSnapshots: records.sourceSnapshots.length,
    fieldChanges: records.fieldChanges.length,
  };
  return { encrypted, exportedAt: parsed.exportedAt, schemaVersion: parsed.schemaVersion, records, versions, summary };
}

export async function restoreLocalBackup(input: Uint8Array, password: string | undefined, replace: boolean) {
  const inspected = await inspectLocalBackup(input, password);
  const imported = await importLocalBackupRecords(inspected.records, inspected.versions, replace && inspected.schemaVersion >= 2);
  return { imported, summary: inspected.summary };
}
