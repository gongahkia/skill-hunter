(() => {
  let simplifiedState = false;
  let backupBodyHtml = '';
  let backupTitle = '';

  let panelMounted = false;
  let lastCaseData = null;
  let lastFactsText = '';
  let lastDiagramGraph = null;

  function secNumberCheck(text) {
    return /^\d/.test(text);
  }

  function sanitise(paragraph) {
    return (paragraph || '').replace(/^\s*\d+\s*/gm, '');
  }

  function extractCaseData() {
    const page = {
      caseTitle: '',
      caseNumber: '',
      caseDate: '',
      caseTribunalCourt: '',
      caseCoram: '',
      caseCounsel: '',
      caseParties: '',
      caseLegalIssues: [],
      caseBody: {}
    };

    const titleEl = document.querySelector('.caseTitle');
    page.caseTitle = titleEl?.textContent?.trim() || document.title || '';

    const infoTable = document.querySelector('#info-table');
    if (infoTable && infoTable.rows) {
      for (let i = 0; i < infoTable.rows.length; i++) {
        const cells = infoTable.rows[i].cells;
        const cellText = cells?.[2]?.innerText?.trim() || '';
        if (!cellText) continue;
        if (i === 0) page.caseNumber = cellText;
        else if (i === 1) page.caseDate = cellText;
        else if (i === 2) page.caseTribunalCourt = cellText;
        else if (i === 3) page.caseCoram = cellText;
        else if (i === 4) page.caseCounsel = cellText;
        else if (i === 5) page.caseParties = cellText;
      }
    }

    const legalIssues = document.querySelector('div.txt-body');
    if (legalIssues) {
      legalIssues.childNodes.forEach((childNode) => {
        if (childNode.nodeType === 1) {
          const text = childNode.textContent?.trim() || '';
          if (text) page.caseLegalIssues.push(text);
        }
      });
    }

    const paragraphs = document.querySelectorAll('p');
    let secName = '';
    let buffer = [];

    paragraphs.forEach((p) => {
      const text = p.textContent?.trim() || '';
      if (p.classList.contains('Judg-Heading-1')) {
        if (!secName) {
          secName = text;
        } else {
          page.caseBody[secName] = buffer;
          secName = text;
          buffer = [];
        }
      } else if (p.classList.contains('Judg-1')) {
        if (secNumberCheck(text)) buffer.push(text);
      }
    });

    if (secName) page.caseBody[secName] = buffer;

    // lightweight derived facts: pick a likely facts section if present
    const factsText = (() => {
      const keys = Object.keys(page.caseBody);
      const factsKey = keys.find((k) => /\bfacts\b|\bbackground\b|\bmaterial facts\b/i.test(k));
      const chosen = factsKey ? page.caseBody[factsKey] : [];
      return chosen.slice(0, 40).map((t) => sanitise(t)).join('\n');
    })();

    return { ...page, factsText };
  }

  async function getSettings() {
    const defaults = { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: '' };
    const saved = await chrome.storage.sync.get(defaults);
    return {
      provider: saved.provider || defaults.provider,
      model: saved.model || defaults.model,
      apiKey: saved.apiKey || defaults.apiKey
    };
  }

  async function saveSettings(settings) {
    const provider = String(settings?.provider || 'gemini');
    const model = String(settings?.model || 'gemini-2.0-flash').trim() || 'gemini-2.0-flash';
    const apiKey = String(settings?.apiKey || '').trim();
    await chrome.storage.sync.set({ provider, model, apiKey });
  }

  async function bg(message) {
    return await chrome.runtime.sendMessage(message);
  }

  function setPanelStatus(text) {
    const el = document.getElementById('jm-status');
    if (el) el.textContent = text || '';
  }

  function setPanelTitle(text) {
    const el = document.getElementById('jm-case-title');
    if (el) el.textContent = text || 'Judgeman';
  }

  function setFactsOutput(text) {
    lastFactsText = text || '';
    const el = document.getElementById('jm-facts-out');
    if (el) el.textContent = lastFactsText;
  }

  function setDiagramJson(graph) {
    lastDiagramGraph = graph || null;
    const el = document.getElementById('jm-diagram-json');
    if (el) el.textContent = graph ? JSON.stringify(graph, null, 2) : '';
  }

  function renderDiagram(graph) {
    const host = document.getElementById('jm-diagram-wrap');
    if (!host) return;

    host.innerHTML = '';
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return;
    }

    const width = 320;
    const height = 220;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    const defs = document.createElementNS(svgNS, 'defs');
    defs.innerHTML = `
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L10,3 L0,6 Z" fill="currentColor" />
      </marker>
    `;
    svg.appendChild(defs);

    const nodes = graph.nodes.slice(0, 10);
    const edges = graph.edges.slice(0, 14);

    const positions = new Map();
    const colX = [80, 240];
    const rowYStart = 36;
    const rowGap = 34;

    nodes.forEach((n, idx) => {
      const col = idx < 6 ? 0 : 1;
      const row = col === 0 ? idx : idx - 6;
      positions.set(n.id, {
        x: colX[col],
        y: rowYStart + row * rowGap
      });
    });

    edges.forEach((e) => {
      const from = positions.get(e.from);
      const to = positions.get(e.to);
      if (!from || !to) return;

      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', String(from.x));
      line.setAttribute('y1', String(from.y));
      line.setAttribute('x2', String(to.x));
      line.setAttribute('y2', String(to.y));
      line.setAttribute('stroke', 'currentColor');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('marker-end', 'url(#arrow)');
      line.setAttribute('opacity', '0.9');
      svg.appendChild(line);

      if (e.label) {
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        const t = document.createElementNS(svgNS, 'text');
        t.setAttribute('x', String(mx));
        t.setAttribute('y', String(my - 4));
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-size', '10');
        t.setAttribute('opacity', '0.85');
        t.textContent = e.label;
        svg.appendChild(t);
      }
    });

    nodes.forEach((n) => {
      const p = positions.get(n.id);
      if (!p) return;

      const g = document.createElementNS(svgNS, 'g');

      const r = document.createElementNS(svgNS, 'rect');
      r.setAttribute('x', String(p.x - 58));
      r.setAttribute('y', String(p.y - 14));
      r.setAttribute('width', '116');
      r.setAttribute('height', '28');
      r.setAttribute('rx', '10');
      r.setAttribute('fill', 'rgba(255,255,255,0.06)');
      r.setAttribute('stroke', 'rgba(255,255,255,0.18)');

      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', String(p.x));
      t.setAttribute('y', String(p.y + 4));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '11');
      t.setAttribute('font-weight', '600');
      t.textContent = n.label || n.id;

      g.appendChild(r);
      g.appendChild(t);
      svg.appendChild(g);
    });

    host.appendChild(svg);
  }

  function ensurePanel() {
    if (panelMounted) return;
    panelMounted = true;

    const panel = document.createElement('div');
    panel.id = 'judgeman-panel';
    panel.innerHTML = `
      <div class="jm-shell">
        <div class="jm-header">
          <div class="jm-header-left">
            <div class="jm-title">Judgeman</div>
            <div class="jm-subtitle" id="jm-case-title">Loading…</div>
          </div>
          <div class="jm-actions">
            <button id="jm-hide" class="jm-btn jm-btn-quiet jm-min" type="button" title="Hide panel">Hide</button>
          </div>
        </div>

        <div class="jm-body">
          <div class="jm-card">
            <div class="jm-row">
              <button id="jm-toggle" class="jm-btn jm-btn-primary" type="button">Toggle readable view</button>
              <button id="jm-refresh" class="jm-btn" type="button">Refresh</button>
            </div>
            <div class="jm-status" id="jm-status">Ready.</div>
          </div>

          <div class="jm-card">
            <div class="jm-card-title">Case facts rundown (BYOK)</div>
            <div class="jm-muted">Uses your API key saved below.</div>
            <div class="jm-row">
              <button id="jm-facts" class="jm-btn" type="button">Generate rundown</button>
              <button id="jm-copy-facts" class="jm-btn jm-btn-quiet" type="button">Copy</button>
            </div>
            <div class="jm-output" id="jm-facts-out" aria-label="Facts rundown"></div>
          </div>

          <div class="jm-card">
            <div class="jm-card-title">Instant diagram</div>
            <div class="jm-muted">Builds a quick relationship graph from the case.</div>
            <div class="jm-row">
              <button id="jm-diagram" class="jm-btn" type="button">Generate diagram</button>
              <button id="jm-copy-diagram" class="jm-btn jm-btn-quiet" type="button">Copy JSON</button>
            </div>
            <div class="jm-diagram" id="jm-diagram-wrap" aria-label="Diagram"></div>
            <div class="jm-output" id="jm-diagram-json" aria-label="Diagram JSON"></div>
          </div>

          <div class="jm-card">
            <div class="jm-card-title">BYOK settings</div>
            <label>Provider
              <select id="jm-provider">
                <option value="gemini">Gemini</option>
              </select>
            </label>
            <label>Model
              <input id="jm-model" type="text" placeholder="gemini-2.0-flash" />
            </label>
            <label>API key
              <input id="jm-apiKey" type="password" placeholder="Paste API key" />
            </label>
            <div class="jm-row">
              <button id="jm-save" class="jm-btn" type="button">Save</button>
              <button id="jm-clear" class="jm-btn jm-btn-quiet" type="button">Clear</button>
            </div>
          </div>

          <div class="jm-card">
            <div class="jm-card-title">Export</div>
            <div class="jm-row">
              <button id="jm-copy-case" class="jm-btn jm-btn-quiet" type="button">Copy case JSON</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Mount outside body so it survives readable-view DOM replacement.
    document.documentElement.appendChild(panel);

    const hideBtn = document.getElementById('jm-hide');
    const showBtn = document.getElementById('jm-show');
    hideBtn?.addEventListener('click', async () => {
      panel.classList.add('jm-hidden');
      // Provide a tiny floating restore button
      const mini = document.createElement('button');
      mini.id = 'jm-mini-show';
      mini.textContent = 'Judgeman';
      mini.style.position = 'fixed';
      mini.style.top = '12px';
      mini.style.left = '12px';
      mini.style.zIndex = '2147483647';
      mini.style.borderRadius = '999px';
      mini.style.border = '1px solid rgba(255,255,255,0.14)';
      mini.style.background = 'rgba(10,12,15,0.88)';
      mini.style.color = '#e7edf6';
      mini.style.padding = '8px 10px';
      mini.style.cursor = 'pointer';
      mini.addEventListener('click', () => {
        panel.classList.remove('jm-hidden');
        mini.remove();
      });
      document.documentElement.appendChild(mini);
    });

    // Wire actions
    document.getElementById('jm-toggle')?.addEventListener('click', () => {
      try {
        toggle();
        setPanelStatus('Ready.');
      } catch (e) {
        setPanelStatus(`Error: ${String(e?.message || e)}`);
      }
    });

    document.getElementById('jm-refresh')?.addEventListener('click', async () => {
      try {
        await refreshCaseData();
      } catch (e) {
        setPanelStatus(`Error: ${String(e?.message || e)}`);
      }
    });

    document.getElementById('jm-facts')?.addEventListener('click', async () => {
      try {
        setPanelStatus('Generating facts rundown…');
        setFactsOutput('');
        await withCaseData(async (caseData) => {
          const r = await bg({ type: 'AI_FACTS_RUNDOWN', caseData });
          if (!r?.ok) throw new Error(r?.error || 'AI facts failed.');
          setFactsOutput(r.text);
        });
        setPanelStatus('Facts ready.');
      } catch (e) {
        setPanelStatus(`Error: ${String(e?.message || e)}`);
      }
    });

    document.getElementById('jm-copy-facts')?.addEventListener('click', async () => {
      try {
        if (!lastFactsText.trim()) {
          setPanelStatus('No facts to copy yet.');
          return;
        }
        await navigator.clipboard.writeText(lastFactsText);
        setPanelStatus('Facts copied.');
      } catch (e) {
        setPanelStatus(`Error: ${String(e?.message || e)}`);
      }
    });

    document.getElementById('jm-diagram')?.addEventListener('click', async () => {
      try {
        setPanelStatus('Generating diagram…');
        setDiagramJson(null);
        renderDiagram(null);
        await withCaseData(async (caseData) => {
          const r = await bg({ type: 'AI_DIAGRAM', caseData });
          if (!r?.ok) throw new Error(r?.error || 'AI diagram failed.');
          setDiagramJson(r.graph);
          renderDiagram(r.graph);
        });
        setPanelStatus('Diagram ready.');
      } catch (e) {
        setPanelStatus(`Error: ${String(e?.message || e)}`);
      }
    });

    document.getElementById('jm-copy-diagram')?.addEventListener('click', async () => {
      try {
        if (!lastDiagramGraph) {
          setPanelStatus('No diagram to copy yet.');
          return;
        }
        await navigator.clipboard.writeText(JSON.stringify(lastDiagramGraph, null, 2));
        setPanelStatus('Diagram JSON copied.');
      } catch (e) {
        setPanelStatus(`Error: ${String(e?.message || e)}`);
      }
    });

    document.getElementById('jm-copy-case')?.addEventListener('click', async () => {
      try {
        await withCaseData(async (caseData) => {
          await navigator.clipboard.writeText(JSON.stringify(caseData, null, 2));
        });
        setPanelStatus('Case JSON copied.');
      } catch (e) {
        setPanelStatus(`Error: ${String(e?.message || e)}`);
      }
    });

    document.getElementById('jm-save')?.addEventListener('click', async () => {
      try {
        const provider = document.getElementById('jm-provider')?.value || 'gemini';
        const model = document.getElementById('jm-model')?.value || 'gemini-2.0-flash';
        const apiKey = document.getElementById('jm-apiKey')?.value || '';
        await saveSettings({ provider, model, apiKey });
        setPanelStatus('Settings saved.');
      } catch (e) {
        setPanelStatus(`Error: ${String(e?.message || e)}`);
      }
    });

    document.getElementById('jm-clear')?.addEventListener('click', async () => {
      try {
        await saveSettings({ apiKey: '' });
        const apiKeyInput = document.getElementById('jm-apiKey');
        if (apiKeyInput) apiKeyInput.value = '';
        setPanelStatus('API key cleared.');
      } catch (e) {
        setPanelStatus(`Error: ${String(e?.message || e)}`);
      }
    });

    // Load current settings into inputs
    void (async () => {
      try {
        const s = await getSettings();
        const providerEl = document.getElementById('jm-provider');
        const modelEl = document.getElementById('jm-model');
        const apiKeyEl = document.getElementById('jm-apiKey');
        if (providerEl) providerEl.value = s.provider;
        if (modelEl) modelEl.value = s.model;
        if (apiKeyEl) apiKeyEl.value = s.apiKey;
      } catch {
        // ignore
      }
    })();
  }

  async function refreshCaseData() {
    setPanelStatus('Scanning page…');
    lastCaseData = extractCaseData();
    const title = lastCaseData?.caseTitle || document.title || 'Judgeman';
    setPanelTitle(title);

    // Heuristic: if we couldn't find typical judgment markers, show a gentle status.
    const looksLikeJudgment = Boolean(document.querySelector('.caseTitle') || document.querySelector('#info-table'));
    setPanelStatus(looksLikeJudgment ? 'Ready.' : 'Ready (non-judgment page).');
  }

  async function withCaseData(fn) {
    if (!lastCaseData) {
      await refreshCaseData();
    }
    return await fn(lastCaseData);
  }

  function buildReadableHtml(page) {
    const css = `
      :root {
        --bg: #0b0d10;
        --panel: #11151a;
        --text: #e7edf6;
        --muted: #a8b3c2;
        --border: rgba(255,255,255,0.08);
        --primary: #4caf50;
        --primary2: #316935;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        padding: 0;
        background: var(--bg);
        color: var(--text);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      }

      header {
        position: sticky;
        top: 0;
        z-index: 10;
        background: linear-gradient(180deg, #121822, #0b0d10);
        border-bottom: 1px solid var(--border);
        padding: 14px 16px;
      }

      .title {
        font-weight: 750;
        letter-spacing: 0.2px;
      }

      .sub {
        margin-top: 6px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.3;
      }

      main {
        max-width: 900px;
        margin: 16px auto;
        padding: 0 12px 20px;
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .card {
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.03);
        border-radius: 14px;
        padding: 12px;
      }

      .kv {
        display: grid;
        grid-template-columns: 140px 1fr;
        gap: 8px;
        padding: 6px 0;
        border-bottom: 1px dashed rgba(255,255,255,0.08);
      }
      .kv:last-child { border-bottom: 0; }

      .k { color: var(--muted); font-size: 12px; }
      .v { font-size: 13px; }

      details {
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        overflow: hidden;
        background: rgba(0,0,0,0.25);
        margin-top: 10px;
      }

      summary {
        cursor: pointer;
        padding: 10px 12px;
        font-weight: 650;
        outline: none;
        list-style: none;
      }
      summary::-webkit-details-marker { display: none; }

      .sec {
        padding: 0 12px 12px;
        color: var(--text);
        font-size: 13px;
        line-height: 1.45;
      }

      .pill {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.04);
        color: var(--muted);
        font-size: 12px;
        margin-right: 6px;
      }

      .credit {
        position: fixed;
        bottom: 10px;
        right: 10px;
        font-size: 12px;
        color: var(--muted);
      }

      a { color: #cfe4ff; }

      #restoreBtn {
        margin-top: 10px;
        border: 1px solid rgba(0,0,0,0.25);
        background: var(--primary);
        color: #0b0d10;
        border-radius: 10px;
        padding: 8px 10px;
        cursor: pointer;
        font-weight: 650;
      }
      #restoreBtn:hover { background: var(--primary2); color: #fff; }
    `;

    const issuesHtml = page.caseLegalIssues.map((t) => `<li>${escapeHtml(t)}</li>`).join('');

    let secNum = 0;
    const sectionsHtml = Object.keys(page.caseBody).map((sectionTitle) => {
      const paragraphs = page.caseBody[sectionTitle] || [];
      const content = paragraphs
        .map((p) => {
          secNum += 1;
          return `<p>${secNum}.&emsp;${escapeHtml(sanitise(p))}</p>`;
        })
        .join('');
      return `
        <details>
          <summary>${escapeHtml(sectionTitle)}</summary>
          <div class="sec">${content}</div>
        </details>
      `;
    }).join('');

    return `
      <style>${css}</style>
      <header>
        <div class="title">${escapeHtml(page.caseTitle)}</div>
        <div class="sub">
          <span class="pill">Judgeman v4</span>
          <span class="pill">Toggleable</span>
          <span class="pill">Facts + Diagram (BYOK)</span>
        </div>
        <button id="restoreBtn" type="button">Restore original page</button>
      </header>

      <main>
        <div class="grid">
          <div class="card">
            <div class="kv"><div class="k">Case number</div><div class="v">${escapeHtml(page.caseNumber)}</div></div>
            <div class="kv"><div class="k">Date</div><div class="v">${escapeHtml(page.caseDate)}</div></div>
            <div class="kv"><div class="k">Tribunal / Court</div><div class="v">${escapeHtml(page.caseTribunalCourt)}</div></div>
            <div class="kv"><div class="k">Coram</div><div class="v">${escapeHtml(page.caseCoram)}</div></div>
            <div class="kv"><div class="k">Counsel</div><div class="v">${escapeHtml(page.caseCounsel)}</div></div>
            <div class="kv"><div class="k">Parties</div><div class="v">${escapeHtml(page.caseParties)}</div></div>
          </div>

          <div class="card">
            <div class="k">Legal issues</div>
            <ul>${issuesHtml}</ul>
          </div>

          ${sectionsHtml}
        </div>
      </main>

      <div class="credit">Judgeman v4 | <a href="https://github.com/gongahkia/judgeman" target="_blank" rel="noreferrer">Source</a></div>
    `;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function simplifyContent() {
    const page = extractCaseData();
    backupBodyHtml = document.body.innerHTML;
    backupTitle = document.title;

    document.title = 'Judgeman';
    document.body.innerHTML = buildReadableHtml(page);

    const btn = document.getElementById('restoreBtn');
    if (btn) {
      btn.addEventListener('click', () => restoreContent());
    }
  }

  function restoreContent() {
    document.body.innerHTML = backupBodyHtml || '';
    if (backupTitle) document.title = backupTitle;
  }

  function toggle() {
    if (simplifiedState) {
      restoreContent();
      simplifiedState = false;
    } else {
      simplifyContent();
      simplifiedState = true;
    }
  }

  // Auto-inject panel on all elitigation pages
  ensurePanel();
  void refreshCaseData();

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    try {
      if (request?.type === 'TOGGLE_SIMPLIFIED') {
        toggle();
        sendResponse({ ok: true, simplified: simplifiedState });
        return;
      }

      if (request?.type === 'EXTRACT_CASE_DATA') {
        const data = extractCaseData();
        sendResponse({ ok: true, data });
        return;
      }

      sendResponse({ ok: false, error: 'Unknown request.' });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  });
})();
