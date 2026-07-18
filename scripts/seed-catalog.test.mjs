import { describe, expect, it, vi } from "vitest";
import { runCatalogSeed, silentLogger } from "./seed-catalog.mjs";

const health = (ready = true, firecrawl = false) => new Response(JSON.stringify({
  status: ready ? "ready" : "error",
  storage: { catalogMode: "local", local: { ready }, firecrawl: { configured: firecrawl } },
}), { status: 200, headers: { "content-type": "application/json" } });

const programs = (lastFetchedAt = undefined) => new Response(JSON.stringify([
  { id: "one", name: "One", institutionIds: ["u1"], seeded: true, status: "active", lastFetchedAt },
  { id: "two", name: "Two", institutionIds: ["u2"], seeded: true, status: "active" },
]), { status: 200, headers: { "content-type": "application/json" } });

const refreshed = (provider = "firecrawl") => new Response(JSON.stringify({ provider, automaticUpdates: [{ id: "change" }] }), {
  status: 200,
  headers: { "content-type": "application/json" },
});
const recorded = () => new Response(JSON.stringify({ recorded: true }), { status: 200, headers: { "content-type": "application/json" } });

describe("catalog seed runner", () => {
  it("stops before listing programs when local storage is not ready", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(health(false));
    await expect(runCatalogSeed({ fetchImpl, expectedPrograms: 2, logger: silentLogger() })).rejects.toThrow("本地 CSV");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("skips previously fetched programs and summarizes providers", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(health(true))
      .mockResolvedValueOnce(programs(new Date().toISOString()))
      .mockResolvedValueOnce(recorded())
      .mockResolvedValueOnce(refreshed("direct"));
    const summary = await runCatalogSeed({ fetchImpl, expectedPrograms: 2, delayMs: 0, retryDelays: [], logger: silentLogger() });
    expect(summary.skipped).toEqual(["one"]);
    expect(summary.succeeded).toEqual(["two"]);
    expect(summary.providers).toEqual({ firecrawl: 0, direct: 1 });
    expect(summary.automaticUpdates).toBe(1);
  });

  it("retries transient server failures and then succeeds", async () => {
    const waitImpl = vi.fn();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(health(true))
      .mockResolvedValueOnce(programs(new Date().toISOString()))
      .mockResolvedValueOnce(recorded())
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "temporary" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "temporary" }), { status: 500 }))
      .mockResolvedValueOnce(refreshed());
    const summary = await runCatalogSeed({ fetchImpl, expectedPrograms: 2, delayMs: 0, retryDelays: [1, 2], waitImpl, logger: silentLogger() });
    expect(summary.succeeded).toEqual(["two"]);
    expect(waitImpl).toHaveBeenNthCalledWith(1, 1);
    expect(waitImpl).toHaveBeenNthCalledWith(2, 2);
  });

  it("does not retry rate limits and reports a failed result", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(health(true))
      .mockResolvedValueOnce(programs(new Date().toISOString()))
      .mockResolvedValueOnce(recorded())
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "rate limited" }), { status: 429 }));
    const summary = await runCatalogSeed({ fetchImpl, expectedPrograms: 2, delayMs: 0, retryDelays: [1, 2], waitImpl: vi.fn(), logger: silentLogger() });
    expect(summary.failed).toEqual([{ id: "two", status: 429, error: "rate limited" }]);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });
});
