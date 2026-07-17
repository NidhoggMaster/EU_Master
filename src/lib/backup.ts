"use client";

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { z } from "zod";
import { readBackupRecords, replaceBackupRecords } from "./db";
import type { BackupRecords, MaterialVersion } from "./types";

const MAGIC = strToU8("EUMA");
const ENCRYPTION_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;

const backupPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  records: z.object({
    profile: z.unknown().optional(),
    universities: z.array(z.unknown()),
    programs: z.array(z.unknown()),
    materials: z.array(z.unknown()),
    materialVersions: z.array(z.unknown()),
    applications: z.array(z.unknown()),
    sourceSnapshots: z.array(z.unknown()),
    fieldChanges: z.array(z.unknown()),
  }),
  files: z.record(z.string(), z.object({ mimeType: z.string(), checksum: z.string() })),
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
  const result = new Uint8Array(MAGIC.length + 1 + salt.length + iv.length + ciphertext.length);
  result.set(MAGIC, 0);
  result[MAGIC.length] = ENCRYPTION_VERSION;
  result.set(salt, MAGIC.length + 1);
  result.set(iv, MAGIC.length + 1 + salt.length);
  result.set(ciphertext, MAGIC.length + 1 + salt.length + iv.length);
  return result;
}

async function decrypt(bytes: Uint8Array, password: string) {
  const version = bytes[MAGIC.length];
  if (version !== ENCRYPTION_VERSION) throw new Error("不支持这个加密备份版本。");
  const salt = bytes.slice(5, 21);
  const iv = bytes.slice(21, 33);
  const ciphertext = bytes.slice(33);
  try {
    const key = await deriveKey(password, salt);
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ciphertext as BufferSource));
  } catch {
    throw new Error("备份密码不正确，或文件已经损坏。");
  }
}

function isEncrypted(bytes: Uint8Array) {
  return MAGIC.every((value, index) => bytes[index] === value);
}

export async function createBackup(password?: string) {
  const { records, versions } = await readBackupRecords();
  const archive: Record<string, Uint8Array> = {};
  const files: Record<string, { mimeType: string; checksum: string }> = {};
  for (const version of versions) {
    const path = `files/${version.id}`;
    const bytes = new Uint8Array(await version.blob.arrayBuffer());
    archive[path] = bytes;
    files[version.id] = { mimeType: version.mimeType, checksum: await checksum(bytes) };
  }
  const payload = {
    schemaVersion: 1 as const,
    exportedAt: new Date().toISOString(),
    records,
    files,
  };
  archive["backup.json"] = strToU8(JSON.stringify(payload));
  const zipped = zipSync(archive, { level: 6 });
  const output = password ? await encrypt(zipped, password) : zipped;
  const extension = password ? "eumaster" : "zip";
  return {
    blob: new Blob([output as BlobPart], { type: password ? "application/octet-stream" : "application/zip" }),
    fileName: `eu-master-backup-${new Date().toISOString().slice(0, 10)}.${extension}`,
  };
}

export async function inspectBackup(file: File, password?: string) {
  if (file.size > 500 * 1024 * 1024) throw new Error("备份文件不能超过 500 MB。");
  let bytes = new Uint8Array(await file.arrayBuffer());
  const encrypted = isEncrypted(bytes);
  if (encrypted) {
    if (!password) throw new Error("这是加密备份，请先输入密码。");
    bytes = await decrypt(bytes, password);
  }
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(bytes);
  } catch {
    throw new Error("无法读取备份压缩包。");
  }
  if (!archive["backup.json"]) throw new Error("备份中缺少数据清单。");
  const parsed = backupPayloadSchema.parse(JSON.parse(strFromU8(archive["backup.json"])));
  const records = parsed.records as BackupRecords;
  const versions: MaterialVersion[] = [];
  for (const metadata of records.materialVersions) {
    const bytesForFile = archive[`files/${metadata.id}`];
    const expected = parsed.files[metadata.id];
    if (!bytesForFile || !expected) throw new Error(`材料版本 ${metadata.fileName} 缺少文件内容。`);
    if ((await checksum(bytesForFile)) !== expected.checksum) throw new Error(`材料版本 ${metadata.fileName} 校验失败。`);
    versions.push({ ...metadata, blob: new Blob([bytesForFile as BlobPart], { type: expected.mimeType }) });
  }
  return {
    encrypted,
    exportedAt: parsed.exportedAt,
    records,
    versions,
    summary: {
      programs: records.programs.length,
      materials: records.materials.length,
      applications: records.applications.length,
      files: versions.length,
    },
  };
}

export async function restoreBackup(records: BackupRecords, versions: MaterialVersion[]) {
  await replaceBackupRecords(records, versions);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
