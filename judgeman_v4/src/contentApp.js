(function attachContentApp(root, factory) {
  const api = factory(root);
  root.JudgemanContentApp = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function contentAppFactory(root) {
  function createFallbackLogger() {
    return {
      debug() {},
      info() {},
      warn() {},
      error() {},
      exportText() {
        return "{}\n";
      }
    };
  }

  function safeRequire(modulePath) {
    if (typeof require !== "function") return null;
    try { return require(modulePath); } catch (_e) { return null; }
  }

  function createContentApp({ window, document, browserApi, extractorApi, caseToolkit, loggerApi }) {
    const citationLinker = root.JudgemanCitationLinker || safeRequire("./citationLinker.js");
    const inlineCitations = root.JudgemanInlineCitations || safeRequire("./inlineCitations.js");
    const inlineStatutes = root.JudgemanInlineStatutes || safeRequire("./inlineStatutes.js");
    const fieldOverlayApi = root.JudgemanFieldOverlay || safeRequire("./fieldOverlay.js");
    const annotationsApi = root.JudgemanAnnotations || safeRequire("./annotations.js");
    const runtimeCaseToolkit =
      caseToolkit || root.JudgemanCaseToolkit || {
        analyseCase() {
          return null;
        },
        buildMarkdownBrief() {
          return "# Judgeman\n\nUnable to generate markdown brief.\n";
        },
        sanitiseParagraph(text) {
          return String(text || "");
        }
      };

    const runtimeLogger = loggerApi?.createLogger
      ? loggerApi.createLogger({ namespace: "ContentApp" })
      : root.JudgemanLogger?.createLogger
      ? root.JudgemanLogger.createLogger({ namespace: "ContentApp" })
      : createFallbackLogger();

    const OVERLAY_STORAGE_KEY = "judgeman.fieldOverlay.visible";

    function loadOverlayVisible() {
      try {
        const value = window.localStorage?.getItem(OVERLAY_STORAGE_KEY);
        return value === null || value === undefined ? true : value !== "0";
      } catch (_e) {
        return true;
      }
    }

    function persistOverlayVisible(visible) {
      try {
        window.localStorage?.setItem(OVERLAY_STORAGE_KEY, visible ? "1" : "0");
      } catch (_e) {
        // best-effort persistence; surface no error to the panel
      }
    }

    function slugifyHeading(title) {
      return (
        String(title || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .substring(0, 40) || "section"
      );
    }

    function sectionDomId(title, index) {
      return `jm-section-${index}-${slugifyHeading(title)}`;
    }

    const state = {
      readerMounted: false,
      readerVisible: false,
      listenerRegistered: false,
      globalHandlersRegistered: false,
      lastCaseData: null,
      pageOverflow: "",
      pageTitle: "",
      overlayVisible: loadOverlayVisible()
    };

    function appendChildren(parent, children) {
      for (const child of children) {
        if (child === null || child === undefined) continue;
        if (typeof child === "string") {
          parent.appendChild(document.createTextNode(child));
        } else {
          parent.appendChild(child);
        }
      }
      return parent;
    }

    function createElement(tagName, options = {}, children = []) {
      const element = document.createElement(tagName);
      if (options.id) element.id = options.id;
      if (options.className) element.className = options.className;
      if (options.text !== undefined) element.textContent = options.text;
      if (options.attrs) {
        for (const [name, value] of Object.entries(options.attrs)) {
          if (value !== undefined && value !== null) {
            element.setAttribute(name, String(value));
          }
        }
      }
      return appendChildren(element, children);
    }

    function clearNode(node) {
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    }

    function describeError(error) {
      return String(error?.message || error || "Unknown error");
    }

    function setStatus(text, tone = "info") {
      const statusEl = document.getElementById("jm-status");
      if (!statusEl) return;

      statusEl.textContent = text || "";
      statusEl.classList.remove("jm-status-error", "jm-status-warn", "jm-status-success");

      if (tone === "error") {
        statusEl.classList.add("jm-status-error");
      } else if (tone === "warn") {
        statusEl.classList.add("jm-status-warn");
      } else if (tone === "success") {
        statusEl.classList.add("jm-status-success");
      }
    }

    function setCaseTitle(text) {
      const title = text || "Judgeman";
      const panelTitle = document.getElementById("jm-case-title");
      const popupTitle = document.getElementById("jm-reader-title");
      if (panelTitle) panelTitle.textContent = title;
      if (popupTitle) popupTitle.textContent = title;
    }

    function getReaderRoot() {
      return document.getElementById("judgeman-reader-root");
    }

    async function copyToClipboard(text) {
      if (window.navigator?.clipboard?.writeText) {
        await window.navigator.clipboard.writeText(String(text || ""));
        return;
      }

      const fallbackInput = document.createElement("textarea");
      fallbackInput.value = String(text || "");
      fallbackInput.setAttribute("readonly", "readonly");
      fallbackInput.style.position = "fixed";
      fallbackInput.style.opacity = "0";
      document.documentElement.appendChild(fallbackInput);
      fallbackInput.select();

      const copied = document.execCommand?.("copy");
      fallbackInput.remove();

      if (!copied) {
        throw new Error("Clipboard is unavailable in this browser context.");
      }
    }

    function ensureCaseAnalysis(caseData) {
      if (!caseData) return null;
      if (caseData.caseAnalysis) return caseData.caseAnalysis;

      if (runtimeCaseToolkit?.analyseCase) {
        caseData.caseAnalysis = runtimeCaseToolkit.analyseCase(caseData);
        return caseData.caseAnalysis;
      }

      return null;
    }

    function buildMetadataGrid(page) {
      const rows = [
        ["Case number", page.caseNumber],
        ["Date", page.caseDate],
        ["Tribunal / Court", page.caseTribunalCourt],
        ["Coram", page.caseCoram],
        ["Counsel", page.caseCounsel],
        ["Parties", page.caseParties],
        ["Estimated read time", `${page.caseAnalysis?.metrics?.estimatedReadMinutes || 0} min`],
        ["Parsed sections", String(page.caseAnalysis?.metrics?.sectionCount || 0)],
        ["Parsed paragraphs", String(page.caseAnalysis?.metrics?.paragraphCount || 0)]
      ];
      const grid = createElement("div", { className: "jm-kv-grid" });

      for (const [label, value] of rows) {
        const row = createElement("div", { className: "jm-kv" }, [
          createElement("div", { className: "jm-k", text: label }),
          createElement("div", { className: "jm-v", text: value || "Not stated" })
        ]);
        grid.appendChild(row);
      }

      return grid;
    }

    function buildIssuesContent(page) {
      if (!page.caseLegalIssues.length) {
        return createElement("p", {
          className: "jm-empty",
          text: "No legal issues were detected on this page."
        });
      }

      const list = createElement("ul", { className: "jm-issues" });
      for (const issue of page.caseLegalIssues) {
        list.appendChild(createElement("li", { text: issue }));
      }
      return list;
    }

    function collectInlineMatches(text) { // merges citations (high priority) + statutes
      const matches = [];
      if (inlineCitations?.findMatches) {
        for (const m of inlineCitations.findMatches(text)) {
          matches.push({ ...m, kind: "citation" });
        }
      }
      if (inlineStatutes?.findStatuteMatches) {
        for (const m of inlineStatutes.findStatuteMatches(text)) {
          matches.push({ ...m, kind: m.kind || "statute" });
        }
      }
      matches.sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        return (b.end - b.start) - (a.end - a.start); // longer first on tie
      });
      const filtered = [];
      let cursor = 0;
      for (const match of matches) {
        if (match.start < cursor) continue;
        filtered.push(match);
        cursor = match.end;
      }
      return filtered;
    }

    function buildLinkNode(match) {
      if (match.kind === "citation") {
        const anchor = document.createElement("a");
        anchor.className = "jm-cite-link";
        anchor.textContent = match.citation;
        anchor.setAttribute("href", inlineCitations.buildElitUrl(match.citation));
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
        anchor.setAttribute("title", match.citation);
        return anchor;
      }
      if (match.resolved && match.url) {
        const anchor = document.createElement("a");
        anchor.className = "jm-statute-link jm-statute-resolved";
        anchor.textContent = match.label;
        anchor.setAttribute("href", match.url);
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
        anchor.setAttribute("title", `SSO: ${match.actName}`);
        return anchor;
      }
      const span = document.createElement("span");
      span.className = "jm-statute-link jm-statute-unresolved";
      span.textContent = match.label;
      span.setAttribute("title", `Unresolved act: ${match.actName || "unknown"}`);
      return span;
    }

    function appendParagraphContent(paragraphEl, text) {
      const matches = collectInlineMatches(text);
      if (matches.length === 0) {
        paragraphEl.appendChild(document.createTextNode(text));
        return;
      }
      const input = String(text || "");
      let cursor = 0;
      for (const match of matches) {
        if (match.start > cursor) {
          paragraphEl.appendChild(document.createTextNode(input.slice(cursor, match.start)));
        }
        paragraphEl.appendChild(buildLinkNode(match));
        cursor = match.end;
      }
      if (cursor < input.length) {
        paragraphEl.appendChild(document.createTextNode(input.slice(cursor)));
      }
    }

    function buildSectionsContent(page) {
      let paragraphNumber = 0;
      let sectionIndex = 0;
      const fragment = document.createDocumentFragment();

      for (const [title, paragraphs] of Object.entries(page.caseBody)) {
        const details = createElement("details", {
          className: "jm-section",
          id: sectionDomId(title, sectionIndex)
        });
        details.open = true;
        details.appendChild(createElement("summary", { text: title }));

        const body = createElement("div", { className: "jm-section-body" });
        for (const paragraph of paragraphs) {
          paragraphNumber += 1;
          const content = extractorApi.sanitiseParagraph(paragraph);
          const p = createElement("p", {}, [
            createElement("span", {
              className: "jm-paragraph-number",
              text: `${paragraphNumber}.`
            }),
            " "
          ]);
          appendParagraphContent(p, content);
          body.appendChild(p);
        }

        details.appendChild(body);
        fragment.appendChild(details);
        sectionIndex += 1;
      }

      return fragment;
    }

    function findSectionIndex(page, title) {
      const titles = Object.keys(page?.caseBody || {});
      return titles.indexOf(title);
    }

    function scrollToSection(title, page) {
      const idx = findSectionIndex(page, title);
      if (idx < 0) return;
      const id = sectionDomId(title, idx);
      const el = document.getElementById(id);
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        if (el.tagName === "DETAILS") el.open = true;
        el.classList.add("jm-section-flash");
        window.setTimeout(() => el.classList.remove("jm-section-flash"), 1200);
      } catch (_e) {
        el.scrollIntoView();
      }
    }

    function buildOverlayKvRow(label, value) {
      return createElement("div", { className: "jm-overlay-row" }, [
        createElement("div", { className: "jm-overlay-label", text: label }),
        createElement("div", { className: "jm-overlay-value", text: value || "Not stated" })
      ]);
    }

    function buildOverlayListRow(label, items) {
      const row = createElement("div", { className: "jm-overlay-row" });
      row.appendChild(createElement("div", { className: "jm-overlay-label", text: label }));
      const list = createElement("ul", { className: "jm-overlay-list" });
      if (!items || items.length === 0) {
        list.appendChild(createElement("li", { className: "jm-empty", text: "Not stated" }));
      } else {
        for (const item of items) {
          list.appendChild(createElement("li", { text: typeof item === "string" ? item : `${item.role}: ${item.name}` }));
        }
      }
      row.appendChild(list);
      return row;
    }

    function buildOverlaySectionsRow(label, sectionTitles, page) {
      const row = createElement("div", { className: "jm-overlay-row" });
      row.appendChild(createElement("div", { className: "jm-overlay-label", text: label }));
      if (!sectionTitles || sectionTitles.length === 0) {
        row.appendChild(createElement("p", { className: "jm-empty", text: "No matching section." }));
        return row;
      }
      const list = createElement("div", { className: "jm-overlay-section-links" });
      for (const title of sectionTitles) {
        const btn = createElement("button", {
          className: "jm-overlay-link",
          text: title,
          attrs: { type: "button" }
        });
        btn.addEventListener("click", () => scrollToSection(title, page));
        list.appendChild(btn);
      }
      row.appendChild(list);
      return row;
    }

    function buildFieldOverlayHeader() {
      const collapseBtn = createElement("button", {
        id: "jm-overlay-collapse",
        className: "jm-overlay-collapse-btn",
        text: "−", // minus sign
        attrs: { type: "button", "aria-label": "Hide case fields panel" }
      });
      collapseBtn.addEventListener("click", () => {
        if (state.overlayVisible) toggleOverlay();
      });
      const header = createElement("div", { className: "jm-card-title jm-overlay-card-title" }, [
        createElement("span", { text: "Case fields (BLUF)" }),
        collapseBtn
      ]);
      return header;
    }

    function buildFieldOverlayContent(page) {
      if (!fieldOverlayApi?.buildFieldOverlay) {
        return createElement("p", { className: "jm-empty", text: "Field overlay module unavailable." });
      }
      const fields = fieldOverlayApi.buildFieldOverlay(page);
      const wrapper = createElement("div", { className: "jm-overlay-body" });

      wrapper.appendChild(buildOverlayKvRow("Court", fields.court));
      wrapper.appendChild(buildOverlayKvRow("Case number", fields.caseNumber));
      wrapper.appendChild(buildOverlayKvRow("Judgment date", fields.judgmentDate));
      if (fields.hearingDate) {
        wrapper.appendChild(buildOverlayKvRow("Hearing date", fields.hearingDate));
      }
      wrapper.appendChild(buildOverlayListRow("Parties", fields.parties));
      wrapper.appendChild(buildOverlayListRow("Coram", fields.judges));
      wrapper.appendChild(buildOverlayListRow("Counsel", fields.counsel));
      wrapper.appendChild(buildOverlayKvRow("Outcome signal", fields.outcomeSignal));

      wrapper.appendChild(buildOverlaySectionsRow("Holding (jump)", fields.holding.sections, page));
      if (fields.holding.excerpts.length) {
        const excerpts = createElement("ul", { className: "jm-overlay-excerpts" });
        for (const line of fields.holding.excerpts) {
          excerpts.appendChild(createElement("li", { text: line }));
        }
        wrapper.appendChild(excerpts);
      }

      wrapper.appendChild(buildOverlaySectionsRow("Ratio (jump)", fields.ratio.sections, page));
      if (fields.ratio.excerpts.length) {
        const excerpts = createElement("ul", { className: "jm-overlay-excerpts" });
        for (const line of fields.ratio.excerpts) {
          excerpts.appendChild(createElement("li", { text: line }));
        }
        wrapper.appendChild(excerpts);
      }

      wrapper.appendChild(buildOverlayListRow(
        `Citations used (${fields.citationsUsed.length})`,
        fields.citationsUsed.slice(0, 5)
      ));
      wrapper.appendChild(buildOverlayListRow(
        `Statutes cited (${fields.statutesCited.length})`,
        fields.statutesCited.slice(0, 5)
      ));

      return wrapper;
    }

    function applyOverlayClass() {
      const root = getReaderRoot();
      if (!root) return;
      root.classList.toggle("jm-overlay-visible", state.overlayVisible);
      root.classList.toggle("jm-overlay-collapsed", !state.overlayVisible);
    }

    function toggleOverlay() {
      state.overlayVisible = !state.overlayVisible;
      persistOverlayVisible(state.overlayVisible);
      applyOverlayClass();
    }

    function buildBulletList(items, emptyMessage) {
      if (!Array.isArray(items) || items.length === 0) {
        return createElement("p", { className: "jm-empty", text: emptyMessage });
      }

      const list = createElement("ul", { className: "jm-issues" });
      for (const item of items) {
        list.appendChild(createElement("li", { text: item }));
      }
      return list;
    }

    function buildBriefContent(page) {
      const brief = page.caseAnalysis?.brief;
      if (!brief) {
        return createElement("p", {
          className: "jm-empty",
          text: "Case brief signals are unavailable for this page."
        });
      }

      const wrapper = createElement("div");
      wrapper.appendChild(
        createElement("div", { className: "jm-brief-outcome" }, [
          createElement("span", { className: "jm-k", text: "Outcome signal" }),
          createElement("strong", { text: brief.outcome || "Not detected" })
        ])
      );

      const sections = [
        ["Facts", brief.facts, "No facts extracted."],
        ["Procedural history", brief.proceduralHistory, "No procedural history extracted."],
        ["Issues", brief.issues, "No issues extracted."],
        ["Holding", brief.holding, "No holding extracted."],
        ["Rationale", brief.rationale, "No rationale extracted."]
      ];

      for (const [title, list, emptyMessage] of sections) {
        wrapper.appendChild(createElement("h3", { className: "jm-subheading", text: title }));
        wrapper.appendChild(buildBulletList(list, emptyMessage));
      }

      return wrapper;
    }

    function buildLinkedCitationList(citations) {
      if (!Array.isArray(citations) || citations.length === 0) {
        return createElement("p", { className: "jm-empty", text: "No neutral citations were pattern-matched." });
      }
      const links = citationLinker ? citationLinker.buildLinks(citations) : null;
      if (!links || links.length === 0) return buildBulletList(citations, "");
      const list = createElement("ul", { className: "jm-issues" });
      for (const link of links) {
        const li = createElement("li");
        const a = createElement("a", {
          text: link.citation,
          attrs: { href: link.url, target: "_blank", rel: "noopener noreferrer" }
        });
        li.appendChild(a);
        li.appendChild(document.createTextNode(` (${link.source})`));
        list.appendChild(li);
      }
      return list;
    }

    function buildAuthoritiesContent(page) {
      const analysis = page.caseAnalysis;
      const wrapper = createElement("div");

      wrapper.appendChild(createElement("h3", { className: "jm-subheading", text: "Neutral citations" }));
      wrapper.appendChild(buildLinkedCitationList(analysis?.citations));

      wrapper.appendChild(createElement("h3", { className: "jm-subheading", text: "Statutory references" }));
      wrapper.appendChild(
        buildBulletList(
          analysis?.statutoryReferences,
          "No statutory references were pattern-matched."
        )
      );

      wrapper.appendChild(createElement("h3", { className: "jm-subheading", text: "Data quality warnings" }));
      wrapper.appendChild(
        buildBulletList(analysis?.dataQualityWarnings, "No data quality warnings detected.")
      );

      return wrapper;
    }

    function buildChecklistContent(page) {
      return buildBulletList(
        page.caseAnalysis?.researchChecklist,
        "No checklist generated for this page."
      );
    }

    function buildCard(title, bodyNode) {
      return createElement("section", { className: "jm-card" }, [
        createElement("div", { className: "jm-card-title", text: title }),
        bodyNode
      ]);
    }

    function buildAnnotationsContent(page) {
      if (!annotationsApi) {
        return createElement("p", { className: "jm-empty", text: "Annotations module unavailable." });
      }
      const caseNum = page.caseNumber || "unknown";
      const wrapper = createElement("div", { className: "jm-annotations" });
      const inputRow = createElement("div", { className: "jm-annotation-input" });
      const textarea = createElement("textarea", {
        attrs: { placeholder: "Add a note for this case...", rows: "2" }
      });
      const addBtn = createElement("button", {
        className: "jm-btn jm-btn-quiet", text: "Add note", attrs: { type: "button" }
      });
      const exportBtn = createElement("button", {
        className: "jm-btn jm-btn-quiet", text: "Export annotations", attrs: { type: "button" }
      });
      inputRow.appendChild(textarea);
      inputRow.appendChild(addBtn);
      inputRow.appendChild(exportBtn);
      wrapper.appendChild(inputRow);
      const listEl = createElement("ul", { className: "jm-annotation-list" });
      wrapper.appendChild(listEl);
      function renderList() {
        clearNode(listEl);
        const notes = annotationsApi.load(caseNum);
        if (notes.length === 0) {
          listEl.appendChild(createElement("li", { className: "jm-empty", text: "No annotations yet." }));
          return;
        }
        for (const note of notes) {
          const li = createElement("li", { className: "jm-annotation-item" });
          li.appendChild(createElement("span", { text: note.text }));
          li.appendChild(createElement("small", { text: ` (${note.createdAt})` }));
          const delBtn = createElement("button", {
            className: "jm-btn jm-btn-quiet", text: "x",
            attrs: { type: "button", "aria-label": "Delete annotation" }
          });
          delBtn.addEventListener("click", () => { annotationsApi.remove(caseNum, note.id); renderList(); });
          li.appendChild(delBtn);
          listEl.appendChild(li);
        }
      }
      addBtn.addEventListener("click", () => {
        const text = textarea.value.trim();
        if (!text) return;
        annotationsApi.add(caseNum, text);
        textarea.value = "";
        renderList();
      });
      exportBtn.addEventListener("click", () => {
        const bundle = annotationsApi.exportBundle(caseNum, page);
        void copyToClipboard(JSON.stringify(bundle, null, 2)).then(() => {
          setStatus("Annotations exported to clipboard.", "success");
        });
      });
      renderList();
      return wrapper;
    }

    function renderNoJudgment(readerMain) {
      const message = createElement("p", { className: "jm-empty" }, [
        "Judgeman activates on ELIT judgment pages under ",
        createElement("code", { text: "/gd/" }),
        " and ",
        createElement("code", { text: "/gdviewer/" }),
        "."
      ]);

      readerMain.appendChild(
        createElement("section", { className: "jm-card" }, [
          createElement("h2", {
            className: "jm-card-title",
            text: "No judgment detected"
          }),
          message
        ])
      );
    }

    function renderReader() {
      ensureReaderRoot();

      const readerRoot = getReaderRoot();
      const readerMain = document.getElementById("jm-reader-main");
      const page = state.lastCaseData;

      if (!readerRoot || !readerMain || !page) {
        return;
      }

      clearNode(readerMain);

      if (!page.isJudgment) {
        renderNoJudgment(readerMain);
        return;
      }

      const overlaySidebar = document.getElementById("jm-overlay-sidebar");
      if (overlaySidebar) {
        clearNode(overlaySidebar);
        const card = createElement("section", { className: "jm-card" }, [
          buildFieldOverlayHeader(),
          buildFieldOverlayContent(page)
        ]);
        overlaySidebar.appendChild(card);
      }

      readerMain.appendChild(buildCard("Case metadata", buildMetadataGrid(page)));
      readerMain.appendChild(buildCard("Legal issues", buildIssuesContent(page)));
      readerMain.appendChild(buildCard("Case brief (student mode)", buildBriefContent(page)));
      readerMain.appendChild(buildCard("Authorities and statutory references", buildAuthoritiesContent(page)));
      readerMain.appendChild(buildCard("Research checklist", buildChecklistContent(page)));
      readerMain.appendChild(buildCard("Annotations", buildAnnotationsContent(page)));
      readerMain.appendChild(buildCard("Judgment sections", buildSectionsContent(page)));

      applyOverlayClass();
    }

    async function refreshCaseData() {
      setStatus("Scanning page...");
      runtimeLogger.info("refresh_case_data_started", { href: window.location?.href || "" });

      state.lastCaseData = extractorApi.extractCaseData(document);
      ensureCaseAnalysis(state.lastCaseData);

      state.pageTitle = state.lastCaseData.caseTitle || document.title || "Judgeman";
      setCaseTitle(state.pageTitle);

      if (state.readerVisible) {
        renderReader();
      }

      if ((state.lastCaseData.extractionErrors || []).length > 0) {
        setStatus("Ready with extraction warnings.", "warn");
      } else {
        setStatus(state.lastCaseData.isJudgment ? "Ready." : "Ready (non-judgment page).", "success");
      }

      runtimeLogger.info("refresh_case_data_completed", {
        isJudgment: state.lastCaseData.isJudgment,
        extractionErrors: state.lastCaseData.extractionErrors?.length || 0
      });

      return state.lastCaseData;
    }

    async function getCaseData() {
      if (!state.lastCaseData) {
        await refreshCaseData();
      }
      return state.lastCaseData;
    }

    async function copyCaseJson() {
      const caseData = await getCaseData();
      await copyToClipboard(JSON.stringify(caseData, null, 2));
      runtimeLogger.info("copy_case_json_completed", {
        caseTitle: caseData.caseTitle || ""
      });
      return caseData;
    }

    async function copyCaseBrief() {
      const caseData = await getCaseData();
      const markdown = runtimeCaseToolkit.buildMarkdownBrief(caseData);
      await copyToClipboard(markdown);
      runtimeLogger.info("copy_case_brief_completed", {
        caseTitle: caseData.caseTitle || ""
      });
      return markdown;
    }

    async function getDiagnosticsText() {
      const caseData = await getCaseData();
      return runtimeLogger.exportText({
        href: window.location?.href || "",
        pageTitle: document.title || "",
        caseTitle: caseData.caseTitle || "",
        extractionErrors: caseData.extractionErrors || []
      });
    }

    async function copyDiagnostics() {
      const diagnostics = await getDiagnosticsText();
      await copyToClipboard(diagnostics);
      runtimeLogger.info("copy_diagnostics_completed");
      return diagnostics;
    }

    async function runAction(actionName, operation, successText) {
      try {
        const result = await operation();
        if (successText) {
          setStatus(successText, "success");
        }
        return result;
      } catch (error) {
        runtimeLogger.error(`${actionName}_failed`, error);
        setStatus(`Error: ${describeError(error)}`, "error");
        return null;
      }
    }

    function makeSvgIcon(paths, opts = {}) {
      const svgNs = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNs, "svg");
      svg.setAttribute("width", String(opts.size || 16));
      svg.setAttribute("height", String(opts.size || 16));
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.setAttribute("aria-hidden", "true");
      for (const d of paths) {
        const path = document.createElementNS(svgNs, "path");
        path.setAttribute("d", d);
        svg.appendChild(path);
      }
      return svg;
    }

    function buildCloseIcon() {
      return makeSvgIcon(["M18 6L6 18", "M6 6l12 12"], { size: 18 });
    }

    function ensureReaderRoot() {
      if (state.readerMounted) return;
      state.readerMounted = true;

      const readerClose = createElement("button", {
        id: "jm-reader-close",
        className: "jm-icon-btn",
        attrs: { type: "button", "aria-label": "Close reader" }
      });
      readerClose.appendChild(buildCloseIcon());

      const readerCopyJson = createElement("button", {
        id: "jm-reader-copy-json",
        className: "jm-btn jm-btn-quiet",
        text: "Copy JSON",
        attrs: { type: "button" }
      });
      const readerCopyBrief = createElement("button", {
        id: "jm-reader-copy-brief",
        className: "jm-btn jm-btn-quiet",
        text: "Copy brief",
        attrs: { type: "button" }
      });
      const readerCopyDiagnostics = createElement("button", {
        id: "jm-reader-copy-diagnostics",
        className: "jm-btn jm-btn-quiet",
        text: "Diagnostics",
        attrs: { type: "button" }
      });
      const readerTitle = createElement("h1", {
        id: "jm-reader-title",
        className: "jm-reader-title",
        text: "Judgment"
      });
      const overlayExpandTab = createElement("button", {
        id: "jm-overlay-expand-tab",
        className: "jm-overlay-expand-tab",
        text: "+",
        attrs: { type: "button", "aria-label": "Show case fields panel" }
      });

      const readerRoot = createElement(
        "div",
        {
          id: "judgeman-reader-root",
          attrs: { "aria-hidden": "true" }
        },
        [
          createElement("div", { className: "jm-reader-shell" }, [
            createElement("header", { className: "jm-reader-header" }, [
              createElement("div", {}, [readerTitle]),
              createElement("div", { className: "jm-reader-actions" }, [
                readerCopyJson,
                readerCopyBrief,
                readerCopyDiagnostics,
                readerClose
              ])
            ]),
            createElement("div", { className: "jm-reader-body" }, [
              createElement("aside", {
                id: "jm-overlay-sidebar",
                className: "jm-overlay-sidebar",
                attrs: { "aria-label": "Case field overlay" }
              }),
              overlayExpandTab,
              createElement("main", {
                id: "jm-reader-main",
                className: "jm-reader-main"
              })
            ])
          ])
        ]
      );

      document.documentElement.appendChild(readerRoot);

      readerClose.addEventListener("click", () => {
        hideReadableView();
      });

      overlayExpandTab.addEventListener("click", () => {
        if (!state.overlayVisible) toggleOverlay();
      });

      readerCopyJson.addEventListener("click", () => {
        void runAction("reader_copy_case_json", copyCaseJson, "Case JSON copied.");
      });

      readerCopyBrief.addEventListener("click", () => {
        void runAction("reader_copy_case_brief", copyCaseBrief, "Case brief copied.");
      });

      readerCopyDiagnostics.addEventListener("click", () => {
        void runAction("reader_copy_diagnostics", copyDiagnostics, "Diagnostics copied.");
      });

      applyOverlayClass();
    }

    async function showReadableView() {
      await refreshCaseData();
      renderReader();

      const readerRoot = getReaderRoot();
      if (!readerRoot) return;

      if (!state.readerVisible) {
        state.pageOverflow = document.documentElement.style.overflow;
      }

      state.readerVisible = true;
      document.documentElement.classList.add("jm-reader-active");
      document.documentElement.style.overflow = "hidden";
      readerRoot.classList.add("jm-reader-visible");
      readerRoot.setAttribute("aria-hidden", "false");
      setStatus("Readable view enabled.", "success");
    }

    function hideReadableView() {
      const readerRoot = getReaderRoot();
      if (!readerRoot) return;

      state.readerVisible = false;
      readerRoot.classList.remove("jm-reader-visible");
      readerRoot.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("jm-reader-active");
      document.documentElement.style.overflow = state.pageOverflow || "";
      setStatus("Readable view disabled.");
      runtimeLogger.info("reader_hidden");
    }

    async function toggleReadableView() {
      if (state.readerVisible) {
        hideReadableView();
        return;
      }

      await showReadableView();
    }

    async function handleMessage(request) {
      if (request?.type === "PING") {
        const caseData = await getCaseData();
        return {
          ok: true,
          data: caseData,
          readerVisible: state.readerVisible
        };
      }

      if (request?.type === "REFRESH_CASE_DATA") {
        const caseData = await refreshCaseData();
        return { ok: true, data: caseData, readerVisible: state.readerVisible };
      }

      if (request?.type === "TOGGLE_SIMPLIFIED") {
        if (state.readerVisible) {
          hideReadableView();
        } else {
          await showReadableView();
        }
        return { ok: true, simplified: state.readerVisible };
      }

      if (request?.type === "EXTRACT_CASE_DATA") {
        const caseData = await getCaseData();
        return { ok: true, data: caseData };
      }

      if (request?.type === "COPY_CASE_BRIEF") {
        const markdown = await copyCaseBrief();
        return { ok: true, data: markdown };
      }

      if (request?.type === "GET_DIAGNOSTICS") {
        const diagnostics = await getDiagnosticsText();
        return { ok: true, data: diagnostics };
      }

      runtimeLogger.warn("unknown_message_type", { type: request?.type || "undefined" });
      return { ok: false, error: `Unknown request type: ${String(request?.type || "undefined")}` };
    }

    function registerMessageListener() {
      if (state.listenerRegistered) return;
      state.listenerRegistered = true;

      browserApi.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        void handleMessage(request)
          .then((payload) => {
            sendResponse(payload);
          })
          .catch((error) => {
            runtimeLogger.error("handle_message_failed", error, {
              requestType: request?.type || "undefined"
            });
            sendResponse({ ok: false, error: describeError(error) });
          });
        return true;
      });
    }

    function registerGlobalErrorHandlers() {
      if (state.globalHandlersRegistered) return;
      state.globalHandlersRegistered = true;

      window.addEventListener("error", (event) => {
        runtimeLogger.error("window_error", event?.error || event?.message || "Unknown error", {
          filename: event?.filename,
          lineno: event?.lineno,
          colno: event?.colno
        });
      });

      window.addEventListener("unhandledrejection", (event) => {
        runtimeLogger.error("window_unhandled_rejection", event?.reason || "Unknown rejection");
      });
    }

    function start() {
      ensureReaderRoot();
      registerMessageListener();
      registerGlobalErrorHandlers();

      void refreshCaseData().catch((error) => {
        runtimeLogger.error("initial_refresh_failed", error);
        setStatus(`Error: ${describeError(error)}`, "error");
      });
    }

    return {
      copyCaseBrief,
      copyCaseJson,
      copyDiagnostics,
      getCaseData,
      hideReadableView,
      refreshCaseData,
      showReadableView,
      start,
      toggleReadableView
    };
  }

  return { createContentApp };
});
