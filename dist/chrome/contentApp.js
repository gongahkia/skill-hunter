(function attachContentApp(root, factory) {
  const api = factory(root);
  root.JudgemanContentApp = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function contentAppFactory(root) {
  function createContentApp({ window, document, browserApi, extractorApi }) {
    const state = {
      panelMounted: false,
      readerMounted: false,
      readerVisible: false,
      lastCaseData: null,
      pageOverflow: "",
      pageTitle: ""
    };

    function setStatus(text) {
      const statusEl = document.getElementById("jm-status");
      if (statusEl) {
        statusEl.textContent = text || "";
      }
    }

    function setCaseTitle(text) {
      const title = text || "Judgeman";
      const panelTitle = document.getElementById("jm-case-title");
      const popupTitle = document.getElementById("jm-reader-title");
      if (panelTitle) panelTitle.textContent = title;
      if (popupTitle) popupTitle.textContent = title;
    }

    function getPanel() {
      return document.getElementById("judgeman-panel");
    }

    function getReaderRoot() {
      return document.getElementById("judgeman-reader-root");
    }

    function ensurePanel() {
      if (state.panelMounted) return;
      state.panelMounted = true;

      const panel = document.createElement("div");
      panel.id = "judgeman-panel";
      panel.className = "jm-shell-collapsed";
      panel.innerHTML = `
        <button id="jm-launcher" class="jm-launcher" type="button" aria-expanded="false">Judgeman</button>
        <section class="jm-shell" aria-label="Judgeman controls">
          <header class="jm-header">
            <div>
              <div class="jm-title">Judgeman</div>
              <div class="jm-subtitle" id="jm-case-title">Loading…</div>
            </div>
            <button id="jm-close" class="jm-icon-btn" type="button" aria-label="Collapse panel">×</button>
          </header>
          <div class="jm-actions">
            <button id="jm-toggle" class="jm-btn jm-btn-primary" type="button">Toggle readable view</button>
            <button id="jm-refresh" class="jm-btn" type="button">Refresh</button>
            <button id="jm-copy-case" class="jm-btn jm-btn-quiet" type="button">Copy case JSON</button>
          </div>
          <p class="jm-status" id="jm-status">Ready.</p>
        </section>
      `;

      document.documentElement.appendChild(panel);

      const launcher = document.getElementById("jm-launcher");
      const closeBtn = document.getElementById("jm-close");
      const toggleBtn = document.getElementById("jm-toggle");
      const refreshBtn = document.getElementById("jm-refresh");
      const copyBtn = document.getElementById("jm-copy-case");

      const setExpanded = (expanded) => {
        panel.classList.toggle("jm-shell-collapsed", !expanded);
        launcher?.setAttribute("aria-expanded", expanded ? "true" : "false");
      };

      launcher?.addEventListener("click", () => {
        setExpanded(panel.classList.contains("jm-shell-collapsed"));
      });

      closeBtn?.addEventListener("click", () => {
        setExpanded(false);
      });

      toggleBtn?.addEventListener("click", async () => {
        try {
          await toggleReadableView();
          setStatus(state.readerVisible ? "Readable view enabled." : "Readable view disabled.");
        } catch (error) {
          setStatus(`Error: ${String(error?.message || error)}`);
        }
      });

      refreshBtn?.addEventListener("click", async () => {
        try {
          await refreshCaseData();
        } catch (error) {
          setStatus(`Error: ${String(error?.message || error)}`);
        }
      });

      copyBtn?.addEventListener("click", async () => {
        try {
          await copyCaseJson();
          setStatus("Case JSON copied.");
        } catch (error) {
          setStatus(`Error: ${String(error?.message || error)}`);
        }
      });
    }

    function ensureReaderRoot() {
      if (state.readerMounted) return;
      state.readerMounted = true;

      const readerRoot = document.createElement("div");
      readerRoot.id = "judgeman-reader-root";
      readerRoot.setAttribute("aria-hidden", "true");
      readerRoot.innerHTML = `
        <div class="jm-reader-shell">
          <header class="jm-reader-header">
            <div>
              <div class="jm-reader-kicker">Judgeman readable view</div>
              <h1 class="jm-reader-title" id="jm-reader-title">Judgment</h1>
            </div>
            <div class="jm-reader-actions">
              <button id="jm-reader-copy" class="jm-btn jm-btn-quiet" type="button">Copy case JSON</button>
              <button id="jm-reader-close" class="jm-btn jm-btn-primary" type="button">Close reader</button>
            </div>
          </header>
          <main class="jm-reader-main" id="jm-reader-main"></main>
        </div>
      `;

      document.documentElement.appendChild(readerRoot);

      document.getElementById("jm-reader-close")?.addEventListener("click", () => {
        hideReadableView();
      });

      document.getElementById("jm-reader-copy")?.addEventListener("click", async () => {
        try {
          await copyCaseJson();
          setStatus("Case JSON copied.");
        } catch (error) {
          setStatus(`Error: ${String(error?.message || error)}`);
        }
      });
    }

    function buildMetadataRows(page) {
      const rows = [
        ["Case number", page.caseNumber],
        ["Date", page.caseDate],
        ["Tribunal / Court", page.caseTribunalCourt],
        ["Coram", page.caseCoram],
        ["Counsel", page.caseCounsel],
        ["Parties", page.caseParties]
      ];

      return rows
        .map(
          ([label, value]) => `
            <div class="jm-kv">
              <div class="jm-k">${extractorApi.escapeHtml(label)}</div>
              <div class="jm-v">${extractorApi.escapeHtml(value || "Not stated")}</div>
            </div>
          `
        )
        .join("");
    }

    function buildIssues(page) {
      if (!page.caseLegalIssues.length) {
        return "<p class=\"jm-empty\">No legal issues were detected on this page.</p>";
      }

      return `
        <ul class="jm-issues">
          ${page.caseLegalIssues
            .map((issue) => `<li>${extractorApi.escapeHtml(issue)}</li>`)
            .join("")}
        </ul>
      `;
    }

    function buildSections(page) {
      let paragraphNumber = 0;
      return Object.entries(page.caseBody)
        .map(([title, paragraphs]) => {
          const body = paragraphs
            .map((paragraph) => {
              paragraphNumber += 1;
              return `
                <p>
                  <span class="jm-paragraph-number">${paragraphNumber}.</span>
                  ${extractorApi.escapeHtml(extractorApi.sanitiseParagraph(paragraph))}
                </p>
              `;
            })
            .join("");

          return `
            <details class="jm-section" open>
              <summary>${extractorApi.escapeHtml(title)}</summary>
              <div class="jm-section-body">${body}</div>
            </details>
          `;
        })
        .join("");
    }

    function renderReader() {
      ensureReaderRoot();

      const readerRoot = getReaderRoot();
      const readerMain = document.getElementById("jm-reader-main");
      const page = state.lastCaseData;

      if (!readerRoot || !readerMain || !page) {
        return;
      }

      if (!page.isJudgment) {
        readerMain.innerHTML = `
          <section class="jm-card">
            <h2 class="jm-card-title">No judgment detected</h2>
            <p class="jm-empty">
              Judgeman only activates on ELIT judgment pages under <code>/gd/</code> and <code>/gdviewer/</code>.
            </p>
          </section>
        `;
        return;
      }

      readerMain.innerHTML = `
        <section class="jm-card">
          <div class="jm-card-title">Case metadata</div>
          <div class="jm-kv-grid">
            ${buildMetadataRows(page)}
          </div>
        </section>
        <section class="jm-card">
          <div class="jm-card-title">Legal issues</div>
          ${buildIssues(page)}
        </section>
        <section class="jm-card">
          <div class="jm-card-title">Judgment sections</div>
          ${buildSections(page)}
        </section>
      `;
    }

    async function refreshCaseData() {
      setStatus("Scanning page…");
      state.lastCaseData = extractorApi.extractCaseData(document);
      state.pageTitle = state.lastCaseData.caseTitle || document.title || "Judgeman";
      setCaseTitle(state.pageTitle);

      if (state.readerVisible) {
        renderReader();
      }

      setStatus(state.lastCaseData.isJudgment ? "Ready." : "Ready (non-judgment page).");
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
      await window.navigator.clipboard.writeText(JSON.stringify(caseData, null, 2));
      return caseData;
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

      return { ok: false, error: "Unknown request." };
    }

    function registerMessageListener() {
      browserApi.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        void handleMessage(request)
          .then((payload) => {
            sendResponse(payload);
          })
          .catch((error) => {
            sendResponse({ ok: false, error: String(error?.message || error) });
          });
        return true;
      });
    }

    function start() {
      ensurePanel();
      ensureReaderRoot();
      void refreshCaseData();
      registerMessageListener();
    }

    return {
      copyCaseJson,
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
