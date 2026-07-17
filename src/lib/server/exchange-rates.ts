import "server-only";

import type { ExchangeRate } from "@/lib/types";
import { parseEcbEurCny } from "@/lib/exchange-rates";
import { latestExchangeRate, saveExchangeRate } from "./catalog-repository";

const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

function mapRow(row: Record<string, unknown>, stale = false): ExchangeRate {
  return { baseCurrency: "EUR", quoteCurrency: "CNY", effectiveDate: String(row.effective_date), rate: Number(row.rate), sourceUrl: String(row.source_url), fetchedAt: row.fetched_at instanceof Date ? row.fetched_at.toISOString() : String(row.fetched_at), stale };
}

export async function getEurCnyRate(): Promise<ExchangeRate> {
  const cached = await latestExchangeRate();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < 12 * 60 * 60 * 1000) return mapRow(cached);
  try {
    const response = await fetch(ECB_URL, { headers: { accept: "application/xml", "user-agent": "EU-Master-NL/1.0" }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!response.ok) throw new Error(`ECB ${response.status}`);
    const xml = await response.text();
    const { effectiveDate: date, rate } = parseEcbEurCny(xml);
    const fetchedAt = new Date().toISOString();
    await saveExchangeRate({ effectiveDate: date, rate, sourceUrl: ECB_URL, fetchedAt });
    return { baseCurrency: "EUR", quoteCurrency: "CNY", effectiveDate: date, rate, sourceUrl: ECB_URL, fetchedAt, stale: false };
  } catch (error) {
    if (cached) return mapRow(cached, true);
    throw error;
  }
}
