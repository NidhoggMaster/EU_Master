import { describe, expect, it } from "vitest";
import { stableStringify } from "./stable-json";

describe("stableStringify", () => {
  it("ignores object key order at every depth", () => {
    const left = { id: "program", facts: [{ score: 6.5, test: "IELTS" }], links: { tuition: "/fees", programme: "/master" } };
    const right = { links: { programme: "/master", tuition: "/fees" }, facts: [{ test: "IELTS", score: 6.5 }], id: "program" };

    expect(stableStringify(left)).toBe(stableStringify(right));
  });

  it("keeps array order significant and matches JSON undefined semantics", () => {
    expect(stableStringify({ values: ["a", "b"], missing: undefined })).not.toBe(stableStringify({ values: ["b", "a"] }));
    expect(stableStringify({ id: "program", missing: undefined })).toBe(stableStringify({ id: "program" }));
  });
});
