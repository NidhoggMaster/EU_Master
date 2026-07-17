import { describe, expect, it } from "vitest";
import { emptyProfile } from "./progress";
import { applicantProfileSchema } from "./profile-schema";

describe("applicant profile validation", () => {
  it("accepts the complete application profile shape", () => {
    const profile = emptyProfile();
    profile.basic.fullName = "Li Ming";
    profile.basic.email = "li@example.com";
    expect(applicantProfileSchema.parse(profile)).toEqual(profile);
  });

  it("rejects invalid emails before a database write", () => {
    const profile = emptyProfile();
    profile.basic.email = "not-an-email";
    expect(applicantProfileSchema.safeParse(profile).success).toBe(false);
  });

  it("limits repeated records to keep API payloads bounded", () => {
    const profile = emptyProfile();
    profile.education = Array.from({ length: 21 }, (_, index) => ({
      id: String(index), institution: "", degree: "", major: "", gpa: "", startYear: "", endYear: "",
    }));
    expect(applicantProfileSchema.safeParse(profile).success).toBe(false);
  });
});
