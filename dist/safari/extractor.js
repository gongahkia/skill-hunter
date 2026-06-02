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

  function cleanText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function readMultilineText(el) { // returns string[] split on <br> and block-tag boundaries
    if (!el) return [];
    let html = el.innerHTML || "";
    html = html.replace(/<br\s*\/?>(\s*)/gi, "\n");
    html = html.replace(/<\/(div|p|h\d|li|tr|table|tbody|tr)>/gi, "\n");
    html = html.replace(/<[^>]+>/g, "");
    html = html
      .replace(/&nbsp;/g, " ")
      .replace(/&emsp;/g, " ")
      .replace(/&ensp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    return html.split(/\r?\n+/).map((line) => cleanText(line)).filter(Boolean);
  }

  function extractTextWithoutFootnotes(node) {
    if (!node) return "";
    const doc = node.ownerDocument || null;
    if (!doc) return cleanText(node.textContent || "");
    const clone = node.cloneNode(true);
    const stripSelectors = [
      ".modal",
      ".modal-dialog",
      ".modal-fade",
      "[role='dialog']",
      ".superscript-btn",
      "sup button",
      "sup",
      ".FootnoteRef"
    ];
    for (const selector of stripSelectors) {
      for (const drop of clone.querySelectorAll(selector)) {
        drop.remove();
      }
    }
    return cleanText(clone.textContent || "");
  }

  function getInfoTableValue(infoTable, rowIndex) { // legacy fixture path
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

  function extractLegacyMetadata(documentRef, page) {
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

    return Boolean(titleEl || infoTable);
  }

  function extractLiveMetadata(documentRef, page) { // returns true if a live-ELIT signal was detected
    const caseNameEl = documentRef?.querySelector?.(".HN-CaseName");
    const neutralCitEl = documentRef?.querySelector?.(".HN-NeutralCit");
    const caseNumberEl = documentRef?.querySelector?.(".CaseNumber");
    const judgDateEl = documentRef?.querySelector?.(".Judg-Date-Reserved, .Judg-Date");
    const hnCoramEl = documentRef?.querySelector?.(".HN-Coram");
    const lawyersEl = documentRef?.querySelector?.(".Judg-Lawyers");

    if (!(caseNameEl || hnCoramEl || caseNumberEl)) return false;

    if (caseNameEl) {
      const nameLines = readMultilineText(caseNameEl);
      const nameText = nameLines.filter((line) => !/^\[\d{4}\]/.test(line)).join(" ");
      const citText = cleanText(neutralCitEl?.textContent);
      const cleanedName = cleanText(nameText);
      page.caseTitle = citText ? `${cleanedName} ${citText}`.trim() : cleanedName || cleanText(documentRef?.title || "");
    } else {
      page.caseTitle = cleanText(documentRef?.title || "");
    }

    if (caseNumberEl) {
      page.caseNumber = cleanText(caseNumberEl.textContent);
    }

    if (judgDateEl) {
      const raw = cleanText(judgDateEl.textContent);
      const dateMatch = raw.match(/^([\d]{1,2}\s+[A-Za-z]+\s+\d{4})/);
      page.caseDate = dateMatch ? dateMatch[1] : raw.split(/\s{2,}| /)[0];
    }

    if (hnCoramEl) {
      const coramLines = readMultilineText(hnCoramEl);
      if (coramLines[0]) {
        const courtLine = coramLines[0];
        const courtPart = courtLine.split(/\s+[—–-]\s+/)[0];
        page.caseTribunalCourt = cleanText(courtPart);
        if (!page.caseNumber) {
          const numberPart = courtLine.split(/\s+[—–-]\s+/)[1];
          if (numberPart) page.caseNumber = cleanText(numberPart);
        }
      }
      if (coramLines[1]) {
        page.caseCoram = coramLines[1];
      }
    }

    if (lawyersEl) {
      page.caseCounsel = cleanText(lawyersEl.textContent);
    }

    const bodyContainer = documentRef?.querySelector?.("#divJudgement") || documentRef;
    const partyEls = bodyContainer?.querySelectorAll?.(".txt-body.text-left, div.txt-body[class*=text-left]") || [];
    const parties = [];
    partyEls.forEach((el) => {
      const text = cleanText(el.textContent);
      if (text && !/^(between|and|judgment)$/i.test(text)) {
        parties.push(text);
      }
    });
    if (parties.length) {
      page.caseParties = parties.join("; ");
    }

    return true;
  }

  function extractCatchwords(documentRef, page) {
    const catchwords = documentRef?.querySelectorAll?.(".catchwords") || [];
    if (catchwords.length) {
      catchwords.forEach((el) => {
        const text = cleanText(el.textContent).replace(/^\[|\]$/g, "").trim();
        if (text) page.caseLegalIssues.push(text);
      });
      return true;
    }
    const legalIssues = documentRef?.querySelector?.("div.txt-body");
    if (legalIssues) {
      legalIssues.childNodes.forEach((childNode) => {
        if (childNode.nodeType !== 1) return;
        const text = cleanText(childNode.textContent);
        if (text) page.caseLegalIssues.push(text);
      });
    }
    return false;
  }

  function isHeadingNode(node) {
    return node.classList?.contains("Judg-Heading-1");
  }

  function isBodyNode(node) {
    if (!node.classList) return false;
    return (
      node.classList.contains("Judg-1") ||
      node.classList.contains("Judg-2") ||
      node.classList.contains("Judg-List-1") ||
      node.classList.contains("Judg-Quote-0")
    );
  }

  function extractBody(documentRef, page) {
    const bodyContainer = documentRef?.querySelector?.("#divJudgement") || documentRef;
    const bodyNodes = bodyContainer?.querySelectorAll?.(
      ".Judg-Heading-1, .Judg-1, .Judg-2, .Judg-List-1, .Judg-Quote-0"
    ) || [];

    let sectionName = "Introduction";
    let buffer = [];

    bodyNodes.forEach((node) => {
      if (isHeadingNode(node)) {
        if (buffer.length) {
          page.caseBody[sectionName] = buffer;
        }
        sectionName = cleanText(node.textContent) || "Section";
        buffer = [];
        return;
      }
      if (isBodyNode(node)) {
        const text = extractTextWithoutFootnotes(node);
        if (text) {
          if (node.classList.contains("Judg-1") || node.classList.contains("Judg-2")) {
            if (secNumberCheck(text)) buffer.push(text);
          } else {
            buffer.push(text);
          }
        }
      }
    });

    if (buffer.length) {
      page.caseBody[sectionName] = buffer;
    }
  }

  function extractCaseData(doc) {
    const documentRef = doc || root.document;
    const page = createEmptyCaseData(documentRef);

    try {
      const liveMatched = extractLiveMetadata(documentRef, page);
      const legacyMatched = liveMatched ? false : extractLegacyMetadata(documentRef, page);
      extractCatchwords(documentRef, page);
      extractBody(documentRef, page);

      page.isJudgment = Boolean(
        liveMatched ||
          legacyMatched ||
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
