import type { ApplicantProfile, Application } from "./types";

export function profileCompletion(profile?: ApplicantProfile) {
  if (!profile) return 0;
  const sections = [
    Boolean(profile.basic.fullName && profile.basic.email),
    profile.education.some((item) => item.institution && item.degree),
    profile.courses.some((item) => item.name),
    profile.tests.some((item) => item.type && item.score),
    profile.experiences.some((item) => item.title),
    profile.skills.some(Boolean),
    Boolean(profile.preferences.intake && profile.preferences.fields.length),
  ];
  return Math.round((sections.filter(Boolean).length / sections.length) * 100);
}

export function applicationProgress(application: Application) {
  const required = application.requirements.filter((item) => item.required);
  if (!required.length) return 0;
  return Math.round((required.filter((item) => item.satisfied).length / required.length) * 100);
}

export function emptyProfile(): ApplicantProfile {
  return {
    id: "current",
    basic: { fullName: "", email: "", nationality: "", currentCity: "" },
    education: [],
    courses: [],
    tests: [],
    experiences: [],
    skills: [],
    preferences: {
      countries: ["荷兰"],
      fields: [],
      intake: "2027 秋季",
      budget: "",
      cityPreference: "",
      employmentPreference: "",
    },
    updatedAt: new Date().toISOString(),
  };
}
