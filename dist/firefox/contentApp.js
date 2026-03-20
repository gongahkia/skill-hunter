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
      const copyBtn = createElement("button", {
        id: "jm-copy-case",
        className: "jm-btn jm-btn-quiet",
        text: "Copy case JSON",
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
                copyBtn
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

      toggleBtn.addEventListener("click", async () => {
        try {
          await toggleReadableView();
          setStatus(state.readerVisible ? "Readable view enabled." : "Readable view disabled.");
        } catch (error) {
          setStatus(`Error: ${String(error?.message || error)}`);
        }
      });

      refreshBtn.addEventListener("click", async () => {
        try {
          await refreshCaseData();
        } catch (error) {
          setStatus(`Error: ${String(error?.message || error)}`);
        }
      });

      copyBtn.addEventListener("click", async () => {
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

      const readerClose = createElement("button", {
        id: "jm-reader-close",
        className: "jm-btn jm-btn-primary",
        text: "Close reader",
        attrs: { type: "button" }
      });
      const readerCopy = createElement("button", {
        id: "jm-reader-copy",
        className: "jm-btn jm-btn-quiet",
        text: "Copy case JSON",
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
                readerCopy,
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

      readerCopy.addEventListener("click", async () => {
        try {
          await copyCaseJson();
          setStatus("Case JSON copied.");
        } catch (error) {
          setStatus(`Error: ${String(error?.message || error)}`);
        }
      });
    }

    function buildMetadataGrid(page) {
      const rows = [
        ["Case number", page.caseNumber],
        ["Date", page.caseDate],
        ["Tribunal / Court", page.caseTribunalCourt],
        ["Coram", page.caseCoram],
        ["Counsel", page.caseCounsel],
        ["Parties", page.caseParties]
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

    function buildCard(title, bodyNode) {
      return createElement("section", { className: "jm-card" }, [
        createElement("div", { className: "jm-card-title", text: title }),
        bodyNode
      ]);
    }

    function renderNoJudgment(readerMain) {
      const message = createElement("p", { className: "jm-empty" }, [
        "Judgeman only activates on ELIT judgment pages under ",
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
      readerMain.appendChild(buildCard("Judgment sections", buildSectionsContent(page)));
    }

    async function refreshCaseData() {
      setStatus("Scanning page...");
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
