import "server-only";

import type { StorageStatus } from "@/lib/types";
import { getCatalogMode, localDataDirectory, localStoreCounts } from "./local-store";
import { checkSupabaseHealth, isSupabaseConfigured } from "./postgres";

function connectionMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "未知连接错误";
  if (/certificate|self signed|unable to verify/i.test(message)) return "Supabase TLS 证书校验失败，请检查 SUPABASE_CA_CERT_PATH。";
  if (/password authentication|authentication failed/i.test(message)) return "Supabase 用户名或密码无效。";
  if (/timeout|ETIMEDOUT/i.test(message)) return "Supabase 连接超时，请检查网络和 Session Pool 地址。";
  if (/SUPABASE_SESSION|SUPABASE_CA_CERT_PATH|Session Pool|PEM/i.test(message)) return message;
  return `Supabase 连接失败：${message}`;
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const [catalogMode, counts] = await Promise.all([getCatalogMode(), localStoreCounts()]);
  const configured = isSupabaseConfigured();
  let supabase: StorageStatus["supabase"] = {
    configured,
    connected: false,
    restrictedRole: false,
    seededPrograms: 0,
    error: configured ? undefined : "未配置有效的 Supabase Session Pool 和 CA 证书。",
  };
  if (configured) {
    try {
      supabase = { configured: true, ...(await checkSupabaseHealth()) };
    } catch (error) {
      supabase.error = connectionMessage(error);
    }
  }
  return {
    catalogMode,
    local: { ready: true, dataDirectory: localDataDirectory(), ...counts },
    supabase,
    firecrawl: { configured: Boolean(process.env.FIRECRAWL_API_KEY?.trim()) },
  };
}
