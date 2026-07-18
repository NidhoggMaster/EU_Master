import type { Program, ProgramCategory, University } from "./types";
import { rankingsForProgram, universityRankingsFor } from "./qs-ranking-data";

const now = "2026-07-19T00:00:00.000Z";
const now = "2026-07-17T00:00:00.000Z";
const TILBURG_LIVING_COST_URL = "https://www.tilburguniversity.edu/education/masters-programs/tuition-fees-scholarships#:~:text=Estimated%20monthly%20costs,200%C2%A0per%20year";

export const universities: University[] = [
  { id: "uva", name: "University of Amsterdam", shortName: "UvA", city: "Amsterdam", country: "NL", homepageUrl: "https://www.uva.nl/en", catalogUrl: "https://www.uva.nl/en/education/master-s/master-s-programmes/masters-programmes.html", allowedHosts: ["uva.nl", "www.uva.nl"] },
  { id: "vu", name: "Vrije Universiteit Amsterdam", shortName: "VU", city: "Amsterdam", country: "NL", homepageUrl: "https://vu.nl/en", catalogUrl: "https://vu.nl/en/education/master", allowedHosts: ["vu.nl", "www.vu.nl"] },
  { id: "tudelft", name: "Delft University of Technology", shortName: "TU Delft", city: "Delft", country: "NL", homepageUrl: "https://www.tudelft.nl/en", catalogUrl: "https://www.tudelft.nl/en/education/programmes/masters", allowedHosts: ["tudelft.nl", "www.tudelft.nl"] },
  { id: "tue", name: "Eindhoven University of Technology", shortName: "TU/e", city: "Eindhoven", country: "NL", homepageUrl: "https://www.tue.nl/en", catalogUrl: "https://www.tue.nl/en/education/graduate-school/master-programs", allowedHosts: ["tue.nl", "www.tue.nl"] },
  { id: "utwente", name: "University of Twente", shortName: "UT", city: "Enschede", country: "NL", homepageUrl: "https://www.utwente.nl/en", catalogUrl: "https://www.utwente.nl/en/education/master/programmes/", allowedHosts: ["utwente.nl", "www.utwente.nl"] },
  { id: "uu", name: "Utrecht University", shortName: "UU", city: "Utrecht", country: "NL", homepageUrl: "https://www.uu.nl/en", catalogUrl: "https://www.uu.nl/en/masters", allowedHosts: ["uu.nl", "www.uu.nl"] },
  { id: "rug", name: "University of Groningen", shortName: "RUG", city: "Groningen", country: "NL", homepageUrl: "https://www.rug.nl", catalogUrl: "https://www.rug.nl/masters/", allowedHosts: ["rug.nl", "www.rug.nl"] },
  { id: "leiden", name: "Leiden University", shortName: "Leiden", city: "Leiden", country: "NL", homepageUrl: "https://www.universiteitleiden.nl/en", catalogUrl: "https://www.universiteitleiden.nl/en/education/study-programmes/master", allowedHosts: ["universiteitleiden.nl", "www.universiteitleiden.nl"] },
  { id: "maastricht", name: "Maastricht University", shortName: "UM", city: "Maastricht", country: "NL", homepageUrl: "https://www.maastrichtuniversity.nl", catalogUrl: "https://www.maastrichtuniversity.nl/education/master", allowedHosts: ["maastrichtuniversity.nl", "www.maastrichtuniversity.nl"] },
  { id: "radboud", name: "Radboud University", shortName: "RU", city: "Nijmegen", country: "NL", homepageUrl: "https://www.ru.nl/en", catalogUrl: "https://www.ru.nl/en/education/masters", allowedHosts: ["ru.nl", "www.ru.nl"] },
  { id: "tilburg", name: "Tilburg University", shortName: "Tilburg", city: "Tilburg", country: "NL", homepageUrl: "https://www.tilburguniversity.edu", catalogUrl: "https://www.tilburguniversity.edu/education/masters-programs", allowedHosts: ["tilburguniversity.edu", "www.tilburguniversity.edu"] },
  { id: "eur", name: "Erasmus University Rotterdam", shortName: "EUR", city: "Rotterdam", country: "NL", homepageUrl: "https://www.eur.nl/en", catalogUrl: "https://www.eur.nl/en/education/master-programmes", allowedHosts: ["eur.nl", "www.eur.nl"] },
  { id: "wur", name: "Wageningen University & Research", shortName: "WUR", city: "Wageningen", country: "NL", homepageUrl: "https://www.wur.nl/en.htm", catalogUrl: "https://www.wur.nl/en/education-programmes/master.htm", allowedHosts: ["wur.nl", "www.wur.nl"] },
  { id: "ou", name: "Open University of the Netherlands", shortName: "OU", city: "Heerlen", country: "NL", homepageUrl: "https://www.ou.nl/en", catalogUrl: "https://www.ou.nl/en/web/english/education", allowedHosts: ["ou.nl", "www.ou.nl"] },
];

for (const university of universities) {
  Object.assign(university, {
    campusName: university.shortName,
    campusArea: "",
    locationNotes: "",
    livingCostMonthlyMinEur: null,
    livingCostMonthlyMaxEur: null,
    rankings: universityRankingsFor(university.id),
  });
}

Object.assign(universities.find((university) => university.id === "tilburg")!, {
  livingCostMonthlyMinEur: 1000,
  livingCostMonthlyMaxEur: 1200,
  livingCostSourceUrl: TILBURG_LIVING_COST_URL,
  factsFetchedAt: "2026-07-19T00:00:00.000Z",
});

function program(
  id: string,
  institutionIds: string[],
  name: string,
  categories: ProgramCategory[],
  sourceUrl: string,
): Program {
  const rankings = rankingsForProgram({ id, institutionIds });
  return {
    id,
    institutionIds,
    name,
    categories,
    sourceUrl,
    faculty: "",
    degreeType: "",
    language: "",
    duration: "",
    ects: "",
    mode: "",
    intakes: [],
    deadline: "",
    tuition: "",
    tuitionEur: null,
    tuitionAcademicYear: "",
    applicationFee: "",
    applicationFeeEur: null,
    applicationPlatform: "",
    premaster: "",
    quota: "",
    campusName: "",
    city: "",
    campusArea: "",
    locationNotes: "",
    coreCourses: [],
    admissionCriteria: [],
    requirements: [],
    dataCompleteness: 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
    seeded: true,
    overview: null,
    rankings,
    careerOutcomes: [],
    applicationDates: [],
    testRequirements: [],
    chinaEligibility: null,
    premasterInfo: null,
    applicationLinks: {
      programUrl: sourceUrl,
      curriculumUrl: "",
      eligibilityUrl: "",
      materialsUrl: "",
      careersUrl: "",
      premasterUrl: "",
      studielinkUrl: "https://www.studielink.nl/",
    },
    admissionProbabilityPrior: null,
    fieldLocks: rankings.length ? ["rankings"] : [],
  };
}

export const seededPrograms: Program[] = [
  program("tilburg-im-strategy", ["tilburg"], "Information Management: Strategy and Governance", ["business", "information"], "https://www.tilburguniversity.edu/education/masters-programs/information-management-strategy-and-governance"),
  program("tilburg-im-intelligence", ["tilburg"], "Information Management: Intelligence and Innovation", ["business", "information"], "https://www.tilburguniversity.edu/education/masters-programs/information-management-intelligence-and-innovation"),
  program("vu-dbi", ["vu"], "Digital Business and Innovation", ["business", "information"], "https://vu.nl/en/education/master/digital-business-and-innovation"),
  program("maastricht-biss", ["maastricht"], "Business Intelligence and Smart Services", ["business", "data"], "https://www.maastrichtuniversity.nl/education/master/programmes/business-intelligence-and-smart-services"),
  program("utwente-bit", ["utwente"], "Business Information Technology", ["business", "information", "computer"], "https://www.utwente.nl/en/education/master/programmes/business-information-technology/"),
  program("radboud-is", ["radboud"], "Information Sciences", ["information", "computer"], "https://www.ru.nl/en/education/masters/information-sciences"),
  program("vu-is", ["vu"], "Information Sciences", ["information", "computer"], "https://vu.nl/en/education/master/information-sciences"),
  program("tilburg-dss-business", ["tilburg"], "Data Science and Society — Business Track", ["business", "data"], "https://www.tilburguniversity.edu/education/masters-programs/data-science-and-society"),
  program("uva-is", ["uva"], "Information Studies — Information Systems", ["information", "computer"], "https://www.uva.nl/en/programmes/masters/information-studies-information-systems/information-systems.html"),
  program("uva-ds", ["uva"], "Information Studies — Data Science", ["data", "computer"], "https://www.uva.nl/en/programmes/masters/information-studies-data-science/data-science.html"),
  program("uu-bi", ["uu"], "Business Informatics", ["business", "information", "computer"], "https://www.uu.nl/en/masters/business-informatics"),
  program("jads-dsbe", ["tilburg", "tue"], "Data Science in Business and Entrepreneurship", ["business", "data", "computer"], "https://www.tilburguniversity.edu/education/masters-programs/data-science-business-entrepreneurship"),
  program("maastricht-dbe", ["maastricht"], "Digital Business and Economics", ["business", "information"], "https://www.maastrichtuniversity.nl/education/master/programmes/digital-business-and-economics"),
];

export const categoryKeywords: Record<ProgramCategory, string[]> = {
  business: ["business", "management", "economics", "entrepreneurship", "innovation"],
  information: ["information", "information systems", "informatics", "digital"],
  computer: ["computer science", "computing", "software", "ict", "information technology"],
  data: ["data science", "analytics", "business intelligence", "machine learning", "data"],
};

export function getUniversity(id: string) {
  return universities.find((item) => item.id === id);
}

export function getSeededProgram(id: string) {
  return seededPrograms.find((item) => item.id === id);
}
