import { describe, expect, it } from "vitest";
import { findSupportingUrls, parseProgramHtml } from "./catalog-server";
import { getUniversity } from "./catalog-data";
import type { Program } from "./types";

const admissionUrl = "https://www.uu.nl/en/masters/business-informatics/application-and-admission/degree-from-a-non-dutch-university";
const languageUrl = "https://www.uu.nl/en/masters/general-information/application-and-admission/english-language-requirements/emi-experienced";
const languageScoresUrl = "https://www.uu.nl/en/masters/general-information/application-and-admission/english-language-requirements/emi-experienced#:~:text=the%20possible%20exemptions.-,EMI%2Dexperienced%20test%20scores,169,-We%20are%20aware";

describe("catalog official page parsing", () => {
  it("prefers Utrecht non-Dutch admission and EMI language deep links", () => {
    const university = getUniversity("uu");
    if (!university) throw new Error("missing UU seed");
    const urls = findSupportingUrls(`
      <main>
        <a href="/en/masters/business-informatics/application-and-admission">Application and admission</a>
        <a href="/en/masters/business-informatics/application-and-admission/degree-from-a-non-dutch-university">Degree from a non-Dutch university</a>
        <a href="/en/masters/general-information/application-and-admission/english-language-requirements/emi-experienced">EMI-experienced page</a>
      </main>
    `, "https://www.uu.nl/en/masters/business-informatics", university);
    expect(urls[0]).toBe(admissionUrl);
    expect(urls).toContain(languageUrl);
  });

  it("prefers international foldout and programme-specific language pages", () => {
    const university = getUniversity("uva");
    if (!university) throw new Error("missing UvA seed");
    const internationalUrl = "https://www.uva.nl/shared-content/programmas/en/masters/information-studies-data-science/application-and-admission/international-prior-education/international-prior-education-foldout-menu.html";
    const englishUrl = "https://www.uva.nl/shared-content/programmas/en/masters/information-studies-data-science/application-and-admission/international-prior-education/english-language-requirements.html";
    const urls = findSupportingUrls(`
      <main>
        <a href="/en/programmes/masters/information-studies-data-science/application-and-admission/application-and-admission.html">Application and admission</a>
        <a href="${internationalUrl}">International prior education foldout menu</a>
        <a href="${englishUrl}">English language requirements and minimum test scores</a>
      </main>
    `, "https://www.uva.nl/en/programmes/masters/information-studies-data-science/data-science.html", university);
    expect(urls[0]).toBe(internationalUrl);
    expect(urls).toContain(englishUrl);
  });

  it("prefers international admission and keeps application documents separate", () => {
    const university = getUniversity("vu");
    if (!university) throw new Error("missing VU seed");
    const admissionsUrl = "https://vu.nl/en/education/master/information-sciences/admissions";
    const documentsUrl = "https://vu.nl/en/education/more-about/application-documents-master";
    const urls = findSupportingUrls(`
      <main>
        <details><summary>International diploma</summary><a href="${admissionsUrl}">International admission requirements</a></details>
        <a href="${documentsUrl}">Application documents Master's programme</a>
      </main>
    `, "https://vu.nl/en/education/master/information-sciences", university);
    expect(urls[0]).toBe(admissionsUrl);
    expect(urls).toContain(documentsUrl);
  });

  it("extracts Utrecht Business Informatics admission requirements, dates and materials", async () => {
    const result = await parseProgramHtml(`
      <main>
        <h1>Degree from a non-Dutch university</h1>
        <p>Business Informatics</p>
        <p>A sufficient Bachelor's degree. Our International Students Admission's office will verify whether a non-Dutch degree is equivalent to a Bachelor's degree at a Dutch research university. Bachelor's programmes that most likely meet the requirements are: Information Science; Artificial Intelligence (AI); Computer Science and Information Technology; and Engineering disciplines.</p>
        <p>For students with a bachelor degree from a university of applied sciences, an average score of at least 7.5 is required for their professional bachelor programme. Moreover, a score of at least 8.0 is required for their graduation project. For students with a bachelor from a research university, it is recommended to have a GPA of 7.0 or higher.</p>
        <p>Solid knowledge of and solid skills in core Information Science competencies, including formal training in: information system design, including analysis, data and process modelling, evaluation, and development methods (10 EC); programming (7.5 EC); and research methods and statistics (7.5 EC).</p>
        <p>Formal training, specifically for the Master's Business Informatics programme, in: organization science, including structure, strategy, and culture; and mathematical logic.</p>
        <p>The required English level for admission to this Master's programme is EMI-experienced. Visit our <a href="${languageUrl}">EMI-experienced page</a>.</p>
        <p>Programme starts in September Applications open 1 October Application deadline for scholarship recipients 1 February Application deadline for Non-EU passport holders 1 April Application deadline for EU passport holders 1 June Programme starts in February Applications open 1 July Application deadline for Non-EU passport holders 1 September Application deadline for EU passport holders 15 October.</p>
        <p>The following documents must be uploaded before the application deadline: A scan of your diploma or <a href="/masters/file/2273">Proof of anticipated degree</a>. A scan of your transcript. <a href="/masters/file/16227">Motivation statement</a>. <a href="/masters/file/16221">Curriculum vitae / resume</a>. <a href="/sites/default/files/course_descriptions-mbi_update.docx">Detailed course descriptions</a>. <a href="/sites/default/files/referees-letter-of-recommendation-UU.pdf">Contact details of one referee</a>. A scan of your official English language test report or certificate. Passport copy.</p>
        <p><a href="https://www.studielink.nl/">Apply via Studielink</a></p>
      </main>
    `, admissionUrl, "uu");

    const criteria = JSON.parse(result.reviewItems.find((item) => item.field === "admissionCriteria" && item.confidence === 0.9)?.proposedValue ?? "[]") as Program["admissionCriteria"];
    const dates = JSON.parse(result.reviewItems.find((item) => item.field === "applicationDates")?.proposedValue ?? "[]") as Program["applicationDates"];
    const requirements = JSON.parse(result.reviewItems.find((item) => item.field === "requirements" && item.confidence === 0.9)?.proposedValue ?? "[]") as Program["requirements"];
    const links = JSON.parse(result.reviewItems.find((item) => item.field === "applicationLinks")?.proposedValue ?? "{}") as Program["applicationLinks"];

    expect(criteria.map((item) => item.id)).toContain("uu-bi-prereq-information-system-design");
    expect(criteria.find((item) => item.id === "uu-bi-prereq-information-system-design")?.creditsEcts).toBe(10);
    expect(dates.find((item) => item.id === "uu-bi-sep-non-eu-deadline")?.date).toBe("1 April");
    expect(requirements.map((item) => item.materialType)).toEqual(["degree_certificate", "transcript", "motivation_letter", "cv", "course_description", "recommendation_letter", "english_test", "passport"]);
    expect(links.eligibilityUrl).toBe(admissionUrl);
    expect(links.studielinkUrl).toBe("https://www.studielink.nl/");
  });

  it("extracts EMI-experienced IELTS total and sub-scores from tables", async () => {
    const result = await parseProgramHtml(`
      <main>
        <h1>EMI-experienced</h1>
        <table>
          <tr><th></th><th>Overall band score</th><th>Speaking</th><th>Listening</th><th>Reading</th><th>Writing</th></tr>
          <tr><td>IELTS Academic*†</td><td>6.5</td><td>6.0</td><td>6.0</td><td>6.0</td><td>6.0</td></tr>
          <tr><td>TOEFL iBT Old scores</td><td>93</td><td>20</td><td>20</td><td>20</td><td>20</td></tr>
        </table>
        <p>IELTS Online and IELTS One Skill Retake are not accepted.</p>
      </main>
    `, languageUrl, "uu");
    const tests = JSON.parse(result.reviewItems.find((item) => item.field === "testRequirements")?.proposedValue ?? "[]") as Program["testRequirements"];
    expect(tests[0]).toMatchObject({ test: "IELTS", minimumTotal: 6.5, minimumSpeaking: 6, minimumListening: 6, minimumReading: 6, minimumWriting: 6 });
    expect(tests[0].sourceUrl).toBe(languageScoresUrl);
  });
});
