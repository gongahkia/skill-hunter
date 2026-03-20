(function attachExtractor(root, factory) {
  const api = factory();
  root.JudgemanExtractor = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function extractorFactory() {
  function secNumberCheck(text) {
    return /^\d/.test(String(text || ""));
  }

  function sanitiseParagraph(paragraph) {
    return String(paragraph || "").replace(/^\s*\d+\s*/gm, "").trim();
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getInfoTableValue(infoTable, rowIndex) {
    const row = infoTable?.rows?.[rowIndex];
    return row?.cells?.[2]?.innerText?.trim() || row?.cells?.[2]?.textContent?.trim() || "";
  }

  function extractCaseData(doc) {
    const documentRef = doc || root.document;
    const page = {
      isJudgment: false,
      caseTitle: "",
      caseNumber: "",
      caseDate: "",
      caseTribunalCourt: "",
      caseCoram: "",
      caseCounsel: "",
      caseParties: "",
      caseLegalIssues: [],
      caseBody: {}
    };

    const titleEl = documentRef.querySelector(".caseTitle");
    page.caseTitle = titleEl?.textContent?.trim() || documentRef.title || "";

    const infoTable = documentRef.querySelector("#info-table");
    if (infoTable) {
      page.caseNumber = getInfoTableValue(infoTable, 0);
      page.caseDate = getInfoTableValue(infoTable, 1);
      page.caseTribunalCourt = getInfoTableValue(infoTable, 2);
      page.caseCoram = getInfoTableValue(infoTable, 3);
      page.caseCounsel = getInfoTableValue(infoTable, 4);
      page.caseParties = getInfoTableValue(infoTable, 5);
    }

    const legalIssues = documentRef.querySelector("div.txt-body");
    if (legalIssues) {
      legalIssues.childNodes.forEach((childNode) => {
        if (childNode.nodeType !== 1) return;
        const text = childNode.textContent?.trim() || "";
        if (text) {
          page.caseLegalIssues.push(text);
        }
      });
    }

    const paragraphs = documentRef.querySelectorAll("p");
    let sectionName = "";
    let buffer = [];

    paragraphs.forEach((paragraph) => {
      const text = paragraph.textContent?.trim() || "";
      if (paragraph.classList.contains("Judg-Heading-1")) {
        if (sectionName) {
          page.caseBody[sectionName] = buffer;
        }
        sectionName = text;
        buffer = [];
        return;
      }

      if (paragraph.classList.contains("Judg-1") && secNumberCheck(text)) {
        buffer.push(text);
      }
    });

    if (sectionName) {
      page.caseBody[sectionName] = buffer;
    }

    page.isJudgment = Boolean(
      titleEl ||
      infoTable ||
      page.caseLegalIssues.length ||
      Object.keys(page.caseBody).length
    );

    return page;
  }

  return {
    escapeHtml,
    extractCaseData,
    sanitiseParagraph,
    secNumberCheck
  };
});
