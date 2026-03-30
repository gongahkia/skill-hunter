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

    const state = {
      panelMounted: false,
      readerMounted: false,
      readerVisible: false,
      listenerRegistered: false,
      globalHandlersRegistered: false,
      lastCaseData: null,
      pageOverflow: "",
      pageTitle: ""
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

    function buildSectionsContent(page) {
      let paragraphNumber = 0;
      const fragment = document.createDocumentFragment();

      for (const [title, paragraphs] of Object.entries(page.caseBody)) {
        const details = createElement("details", { className: "jm-section" });
        details.open = true;
        details.appendChild(createElement("summary", { text: title }));

        const body = createElement("div", { className: "jm-section-body" });
        for (const paragraph of paragraphs) {
          paragraphNumber += 1;
          const content = extractorApi.sanitiseParagraph(paragraph);
          body.appendChild(
            createElement("p", {}, [
              createElement("span", {
                className: "jm-paragraph-number",
                text: `${paragraphNumber}.`
              }),
              " ",
              content
            ])
          );
        }

        details.appendChild(body);
        fragment.appendChild(details);
      }

      return fragment;
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

      readerMain.appendChild(buildCard("Case metadata", buildMetadataGrid(page)));
      readerMain.appendChild(buildCard("Legal issues", buildIssuesContent(page)));
      readerMain.appendChild(buildCard("Case brief (student mode)", buildBriefContent(page)));
      readerMain.appendChild(buildCard("Authorities and statutory references", buildAuthoritiesContent(page)));
      readerMain.appendChild(buildCard("Research checklist", buildChecklistContent(page)));
      readerMain.appendChild(buildCard("Annotations", buildAnnotationsContent(page)));
      readerMain.appendChild(buildCard("Judgment sections", buildSectionsContent(page)));
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

    function ensurePanel() {
      if (state.panelMounted) return;
      state.panelMounted = true;

      const launcher = createElement("button", {
        id: "jm-launcher",
        className: "jm-launcher",
        text: "Judgeman",
        attrs: {
          type: "button",
          "aria-expanded": "false"
        }
      });
      const title = createElement("div", { className: "jm-title", text: "Judgeman" });
      const subtitle = createElement("div", {
        id: "jm-case-title",
        className: "jm-subtitle",
        text: "Loading..."
      });
      const closeBtn = createElement("button", {
        id: "jm-close",
        className: "jm-icon-btn",
        text: "x",
        attrs: {
          type: "button",
          "aria-label": "Collapse panel"
        }
      });
      const toggleBtn = createElement("button", {
        id: "jm-toggle",
        className: "jm-btn jm-btn-primary",
        text: "Toggle readable view",
        attrs: { type: "button" }
      });
      const refreshBtn = createElement("button", {
        id: "jm-refresh",
        className: "jm-btn",
        text: "Refresh",
        attrs: { type: "button" }
      });
      const copyJsonBtn = createElement("button", {
        id: "jm-copy-case",
        className: "jm-btn jm-btn-quiet",
        text: "Copy case JSON",
        attrs: { type: "button" }
      });
      const copyBriefBtn = createElement("button", {
        id: "jm-copy-brief",
        className: "jm-btn jm-btn-quiet",
        text: "Copy case brief",
        attrs: { type: "button" }
      });
      const copyDiagnosticsBtn = createElement("button", {
        id: "jm-copy-diagnostics",
        className: "jm-btn jm-btn-quiet",
        text: "Copy diagnostics",
        attrs: { type: "button" }
      });
      const status = createElement("p", {
        id: "jm-status",
        className: "jm-status",
        text: "Ready."
      });

      const panel = createElement(
        "div",
        {
          id: "judgeman-panel",
          className: "jm-shell-collapsed"
        },
        [
          launcher,
          createElement(
            "section",
            {
              className: "jm-shell",
              attrs: { "aria-label": "Judgeman controls" }
            },
            [
              createElement("header", { className: "jm-header" }, [
                createElement("div", {}, [title, subtitle]),
                closeBtn
              ]),
              createElement("div", { className: "jm-actions" }, [
                toggleBtn,
                refreshBtn,
                copyJsonBtn,
                copyBriefBtn,
                copyDiagnosticsBtn
              ]),
              status
            ]
          )
        ]
      );

      document.documentElement.appendChild(panel);

      const setExpanded = (expanded) => {
        panel.classList.toggle("jm-shell-collapsed", !expanded);
        launcher.setAttribute("aria-expanded", expanded ? "true" : "false");
      };

      launcher.addEventListener("click", () => {
        setExpanded(panel.classList.contains("jm-shell-collapsed"));
      });

      closeBtn.addEventListener("click", () => {
        setExpanded(false);
      });

      toggleBtn.addEventListener("click", () => {
        void runAction("toggle_reader", toggleReadableView);
      });

      refreshBtn.addEventListener("click", () => {
        void runAction("refresh", refreshCaseData, "Case data refreshed.");
      });

      copyJsonBtn.addEventListener("click", () => {
        void runAction("copy_case_json", copyCaseJson, "Case JSON copied.");
      });

      copyBriefBtn.addEventListener("click", () => {
        void runAction("copy_case_brief", copyCaseBrief, "Case brief copied.");
      });

      copyDiagnosticsBtn.addEventListener("click", () => {
        void runAction("copy_diagnostics", copyDiagnostics, "Diagnostics copied.");
      });
    }

    function ensureReaderRoot() {
      if (state.readerMounted) return;
      state.readerMounted = true;

      const readerClose = createElement("button", {
        id: "jm-reader-close",
        className: "jm-btn jm-btn-primary",
        text: "Close reader",
        attrs: { type: "button" }
      });
      const readerCopyJson = createElement("button", {
        id: "jm-reader-copy-json",
        className: "jm-btn jm-btn-quiet",
        text: "Copy case JSON",
        attrs: { type: "button" }
      });
      const readerCopyBrief = createElement("button", {
        id: "jm-reader-copy-brief",
        className: "jm-btn jm-btn-quiet",
        text: "Copy case brief",
        attrs: { type: "button" }
      });
      const readerCopyDiagnostics = createElement("button", {
        id: "jm-reader-copy-diagnostics",
        className: "jm-btn jm-btn-quiet",
        text: "Copy diagnostics",
        attrs: { type: "button" }
      });
      const readerTitle = createElement("h1", {
        id: "jm-reader-title",
        className: "jm-reader-title",
        text: "Judgment"
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
              createElement("div", {}, [
                createElement("div", {
                  className: "jm-reader-kicker",
                  text: "Judgeman readable view"
                }),
                readerTitle
              ]),
              createElement("div", { className: "jm-reader-actions" }, [
                readerCopyJson,
                readerCopyBrief,
                readerCopyDiagnostics,
                readerClose
              ])
            ]),
            createElement("main", {
              id: "jm-reader-main",
              className: "jm-reader-main"
            })
          ])
        ]
      );

      document.documentElement.appendChild(readerRoot);

      readerClose.addEventListener("click", () => {
        hideReadableView();
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
      ensurePanel();
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
