import { describe, expect, it } from "vitest";
import { applicationProgress, emptyProfile, profileCompletion } from "./progress";
import type { Application } from "./types";

describe("progress helpers", () => {
  it("calculates profile completion by seven structured sections", () => {
    const profile = emptyProfile();
    expect(profileCompletion(profile)).toBe(0);
    profile.basic.fullName = "Li Ming";
    profile.basic.email = "li@example.com";
    profile.preferences.fields = ["Information Systems"];
    expect(profileCompletion(profile)).toBe(29);
  });

  it("calculates application progress from required requirements only", () => {
    const application = {
      requirements: [
        { id: "1", required: true, satisfied: true },
        { id: "2", required: true, satisfied: false },
        { id: "3", required: false, satisfied: false },
      ],
    } as Application;
    expect(applicationProgress(application)).toBe(50);
  });
});
