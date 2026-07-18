import type { Program, University } from "./types";

export interface LivingCostEstimate {
  city: string;
  monthlyMinEur: number;
  monthlyMaxEur: number;
  sourceUrl: string;
  sourceLabel: string;
  asOf: string;
  origin: "official" | "estimated";
  notes: string;
}

const estimates: LivingCostEstimate[] = [
  {
    city: "Amsterdam",
    monthlyMinEur: 975,
    monthlyMaxEur: 1500,
    sourceUrl: "https://www.uva.nl/en/education/practical-information/living-in-amsterdam/living-expenses/living-expenses-uva.html",
    sourceLabel: "UvA Living expenses and money matters",
    asOf: "2026-07-19",
    origin: "official",
    notes: "UvA 明确区间，包含住宿、不含学费；住房紧张时应按上限准备。",
  },
  {
    city: "Rotterdam",
    monthlyMinEur: 1000,
    monthlyMaxEur: 1800,
    sourceUrl: "https://www.eur.nl/en/education/practical-matters/orientation-arrival/costs-living",
    sourceLabel: "Erasmus University Rotterdam Costs of living",
    asOf: "2026-07-19",
    origin: "official",
    notes: "EUR 明确区间，包含住宿、日常、保险和材料，不含学费及意外支出。",
  },
  {
    city: "Leiden",
    monthlyMinEur: 1150,
    monthlyMaxEur: 1500,
    sourceUrl: "https://www.universiteitleiden.nl/binaries/content/assets/studentenwerving/scm/international/visa-residence-permit/visa_residence_permit_application_instructions_exchange_study_abroad_students.pdf",
    sourceLabel: "Leiden University proof of sufficient funds",
    asOf: "2026-07-19",
    origin: "estimated",
    notes: "官网 2025 签证资金最低额为每月 €1,150；上限加入住房和价格上涨缓冲。",
  },
  {
    city: "Groningen",
    monthlyMinEur: 1300,
    monthlyMaxEur: 1600,
    sourceUrl: "https://www.rug.nl/education/bachelor/international-students/study-choice-and-information/information-parents/practical-information?lang=en",
    sourceLabel: "University of Groningen practical information",
    asOf: "2026-07-19",
    origin: "official",
    notes: "采用 RUG 面向家长的完整月预算，避免使用未计意外支出的较低交换生估算。",
  },
  {
    city: "Utrecht",
    monthlyMinEur: 1000,
    monthlyMaxEur: 1400,
    sourceUrl: "https://www.uu.nl/en/education/welcome-to-utrecht/prepare-your-stay/cost-of-living",
    sourceLabel: "Utrecht University Cost of living",
    asOf: "2026-07-19",
    origin: "official",
    notes: "UU 明确区间，不含学费；住宿上沿可达每月 €1,100。",
  },
  {
    city: "Maastricht",
    monthlyMinEur: 1250,
    monthlyMaxEur: 1550,
    sourceUrl: "https://www.maastrichtuniversity.nl/studeren/toelating-inschrijving/visa-legal-residence",
    sourceLabel: "Maastricht University Visa / legal residence",
    asOf: "2026-07-19",
    origin: "estimated",
    notes: "下限为 UM 2026 签证资金标准；上限按 UM 2026/27 奖学金完整月预算 €1,550。",
  },
  {
    city: "Nijmegen",
    monthlyMinEur: 1370,
    monthlyMaxEur: 1450,
    sourceUrl: "https://www.ru.nl/en/education/studying-at-radboud-university/finances/costs-and-expenses",
    sourceLabel: "Radboud University Student budget and expenses",
    asOf: "2026-07-19",
    origin: "estimated",
    notes: "按 Radboud 2026/27 非欧盟学生表格剔除学费后汇总，并对家具化住宿留缓冲。",
  },
  {
    city: "Tilburg",
    monthlyMinEur: 1000,
    monthlyMaxEur: 1200,
    sourceUrl: "https://www.tilburguniversity.edu/education/masters-programs/tuition-fees-scholarships#:~:text=Estimated%20monthly%20costs,200%C2%A0per%20year",
    sourceLabel: "Tilburg University tuition fees and living costs",
    asOf: "2026-07-19",
    origin: "official",
    notes: "Tilburg University 明确月度估算，不含学费。",
  },
  {
    city: "Enschede",
    monthlyMinEur: 1300,
    monthlyMaxEur: 1311,
    sourceUrl: "https://www.utwente.nl/en/education/master/costs-of-studying/",
    sourceLabel: "University of Twente How much does studying cost?",
    asOf: "2026-07-19",
    origin: "official",
    notes: "UT 按 Nibud 给出约 €1,300、逐项合计 €1,311；不含学费。",
  },
  {
    city: "Wageningen",
    monthlyMinEur: 1150,
    monthlyMaxEur: 1300,
    sourceUrl: "https://www.wur.nl/en/education/master/study-expenses-masters",
    sourceLabel: "WUR Study expenses master's",
    asOf: "2026-07-19",
    origin: "estimated",
    notes: "WUR 两年生活费总额折算为每月 €1,150；上限加入保险及价格缓冲。",
  },
  {
    city: "Delft",
    monthlyMinEur: 1200,
    monthlyMaxEur: 1500,
    sourceUrl: "https://www.tudelft.nl/en/education/practical-matters/tuition-fee-finances",
    sourceLabel: "TU Delft Tuition fee and finances",
    asOf: "2026-07-19",
    origin: "estimated",
    notes: "结合 TU Delft 公开费用口径及当前荷兰学生月预算，按住房紧张情形保守留档。",
  },
  {
    city: "Eindhoven",
    monthlyMinEur: 1200,
    monthlyMaxEur: 1500,
    sourceUrl: "https://www.tue.nl/en/education/become-a-tue-student/tuition-fees-and-other-study-costs",
    sourceLabel: "TU/e Tuition fees and other study costs",
    asOf: "2026-07-19",
    origin: "estimated",
    notes: "按 Eindhoven 当前住房与荷兰学生完整预算保守留档，不采用仅覆盖基本开支的低值。",
  },
  {
    city: "'s-Hertogenbosch",
    monthlyMinEur: 1100,
    monthlyMaxEur: 1400,
    sourceUrl: "https://www.jads.nl/campus/",
    sourceLabel: "JADS campus in 's-Hertogenbosch",
    asOf: "2026-07-19",
    origin: "estimated",
    notes: "JADS 异地校区覆盖；采用 Brabant 学生预算并为私人住房留出缓冲。",
  },
  {
    city: "Heerlen",
    monthlyMinEur: 1200,
    monthlyMaxEur: 1400,
    sourceUrl: "https://www.ou.nl/en/web/open-universiteit/contact",
    sourceLabel: "Open Universiteit Heerlen campus",
    asOf: "2026-07-19",
    origin: "estimated",
    notes: "OU 以远程学习为主；仅在确需居住 Heerlen 时采用该保守预算。",
  },
];

const aliases: Record<string, string> = {
  "den bosch": "'s-hertogenbosch",
  "s-hertogenbosch": "'s-hertogenbosch",
  "’s-hertogenbosch": "'s-hertogenbosch",
  "'s hertogenbosch": "'s-hertogenbosch",
};

const normalizeCity = (value: string) => aliases[value.trim().toLowerCase()] ?? value.trim().toLowerCase();
const estimateMap = new Map(estimates.map((estimate) => [normalizeCity(estimate.city), estimate]));

export const livingCostEstimates = Object.freeze(estimates.map((estimate) => Object.freeze({ ...estimate })));

export function livingCostForCity(city: string | undefined) {
  return city ? estimateMap.get(normalizeCity(city)) : undefined;
}

export function livingCostForProgram(program: Pick<Program, "city">, universities: Array<Pick<University, "city" | "livingCostMonthlyMinEur" | "livingCostMonthlyMaxEur" | "livingCostSourceUrl" | "factsFetchedAt">>) {
  const university = universities[0];
  const city = program.city || university?.city;
  const estimate = livingCostForCity(city);
  if (estimate) return estimate;
  if (university?.livingCostMonthlyMinEur == null) return undefined;
  return {
    city: city || "地点未披露",
    monthlyMinEur: university.livingCostMonthlyMinEur,
    monthlyMaxEur: university.livingCostMonthlyMaxEur ?? university.livingCostMonthlyMinEur,
    sourceUrl: university.livingCostSourceUrl ?? "",
    sourceLabel: "学校生活费资料",
    asOf: university.factsFetchedAt?.slice(0, 10) ?? "",
    origin: "official" as const,
    notes: "学校级生活费回退值。",
  };
}
