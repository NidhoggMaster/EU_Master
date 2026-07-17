import { describe, expect, it } from "vitest";
import { eurToCny, parseEcbEurCny } from "./exchange-rates";

describe("ECB reference rates", () => {
  it("parses the latest working-day EUR/CNY value", () => {
    expect(parseEcbEurCny(`<Cube time='2026-07-16'><Cube currency='USD' rate='1.1'/><Cube currency='CNY' rate='7.7596'/></Cube>`)).toEqual({ effectiveDate: "2026-07-16", rate: 7.7596 });
  });

  it("rejects malformed feeds and converts precisely", () => {
    expect(() => parseEcbEurCny("<Cube />")).toThrow("CNY");
    expect(eurToCny(12_345.67, 7.7596)).toBe(95_797.46);
  });
});
