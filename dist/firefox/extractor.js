(function attachExtractor(root, factory) {
  const api = factory(root);
  root.JudgemanExtractor = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function extractorFactory(root) {
  function safeRequire(modulePath) {
    if (typeof require !== "function") return null;
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      return require(modulePath);
    } catch (_error) {
      return null;
    }
  }

  const caseToolkit = root.JudgemanCaseToolkit || safeRequire("./caseToolkit.js");
  const loggerApi = root.JudgemanLogger || safeRequire("./logger.js");
  const logger = loggerApi?.createLogger
    ? loggerApi.createLogger({ namespace: "Extractor" })
    : {
        info() {},
        warn() {},
        error() {}
      };

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
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getInfoTableValue(infoTable, rowIndex) {
    const row = infoTable?.rows?.[rowIndex];
    return row?.cells?.[2]?.innerText?.trim() || row?.cells?.[2]?.textContent?.trim() || "";
  }

  function createEmptyCaseData(documentRef) {
    return {
      isJudgment: false,
      caseTitle: documentRef?.title || "",
      caseNumber: "",
      caseDate: "",
      caseTribunalCourt: "",
      caseCoram: "",
      caseCounsel: "",
      caseParties: "",
      caseLegalIssues: [],
      caseBody: {},
      caseAnalysis: null,
      extractionErrors: []
    };
  }

  function recordExtractionError(page, label, error) {
    const message = String(error?.message || error || "Unknown extraction error.");
    page.extractionErrors.push(`${label}: ${message}`);
    logger.error("extract_case_data_failed", error, { label });
  }

  function extractCaseData(doc) {
    const documentRef = doc || root.document;
    const page = createEmptyCaseData(documentRef);

    try {
      const titleEl = documentRef?.querySelector?.(".caseTitle");
      page.caseTitle = titleEl?.textContent?.trim() || documentRef?.title || "";

      const infoTable = documentRef?.querySelector?.("#info-table");
      if (infoTable) {
        page.caseNumber = getInfoTableValue(infoTable, 0);
        page.caseDate = getInfoTableValue(infoTable, 1);
        page.caseTribunalCourt = getInfoTableValue(infoTable, 2);
        page.caseCoram = getInfoTableValue(infoTable, 3);
        page.caseCounsel = getInfoTableValue(infoTable, 4);
        page.caseParties = getInfoTableValue(infoTable, 5);
      }

      const legalIssues = documentRef?.querySelector?.("div.txt-body");
      if (legalIssues) {
        legalIssues.childNodes.forEach((childNode) => {
          if (childNode.nodeType !== 1) return;
          const text = childNode.textContent?.trim() || "";
          if (text) {
            page.caseLegalIssues.push(text);
          }
        });
      }

      const paragraphs = documentRef?.querySelectorAll?.("p") || [];
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
    } catch (error) {
      recordExtractionError(page, "core_extraction", error);
    }

    try {
      if (caseToolkit?.analyseCase) {
        page.caseAnalysis = caseToolkit.analyseCase(page);
      }
    } catch (error) {
      recordExtractionError(page, "analysis_generation", error);
    }

    if (page.extractionErrors.length > 0) {
      logger.warn("extract_case_data_completed_with_warnings", {
        errors: page.extractionErrors
      });
    } else {
      logger.info("extract_case_data_completed", {
        isJudgment: page.isJudgment,
        sections: Object.keys(page.caseBody).length,
        issues: page.caseLegalIssues.length
      });
    }

    return page;
  }

  return {
    escapeHtml,
    extractCaseData,
    sanitiseParagraph,
    secNumberCheck
  };
});
