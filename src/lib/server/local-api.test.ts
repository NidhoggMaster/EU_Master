import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { assertLocalMutation } = await import("./local-api");

describe("local mutation origin guard", () => {
  it("accepts same-origin browser requests", () => {
    const request = new Request("http://127.0.0.1:3000/api/profile", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } });
    expect(() => assertLocalMutation(request)).not.toThrow();
  });

  it("accepts server-side commands without an Origin header", () => {
    const request = new Request("http://127.0.0.1:3000/api/profile", { headers: { host: "127.0.0.1:3000" } });
    expect(() => assertLocalMutation(request)).not.toThrow();
  });

  it("rejects cross-site browser mutations", () => {
    const request = new Request("http://127.0.0.1:3000/api/profile", { headers: { host: "127.0.0.1:3000", origin: "https://example.com" } });
    expect(() => assertLocalMutation(request)).toThrow("拒绝跨站修改本地数据");
  });
});
