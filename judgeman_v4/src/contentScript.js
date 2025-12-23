(() => {
  let simplifiedState = false;
  let backupBodyHtml = '';
  let backupTitle = '';

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
