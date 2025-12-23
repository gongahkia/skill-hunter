const $ = (sel) => document.querySelector(sel);

let lastCaseData = null;
let lastFactsText = '';
let lastDiagramGraph = null;

function setStatus(text) {
  const el = $('#status');
  if (el) el.textContent = text;
}

function setCaseTitle(text) {
  const el = $('#caseTitle');
  if (el) el.textContent = text || 'ELIT judgment helper';
}

function setFactsOutput(text) {
  lastFactsText = text || '';
  const el = $('#factsOut');
  if (el) el.textContent = lastFactsText;
}

function setDiagramJson(graph) {
  lastDiagramGraph = graph || null;
  const el = $('#diagramJson');
  if (el) el.textContent = graph ? JSON.stringify(graph, null, 2) : '';
}

function renderDiagram(graph) {
  const host = $('#diagramWrap');
  if (!host) return;

  host.innerHTML = '';
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    host.textContent = '';
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

async function bg(message) {
  return await chrome.runtime.sendMessage(message);
}

async function refreshCaseData() {
  setStatus('Scanning page…');
  const extracted = await bg({ type: 'EXTRACT_CASE_DATA_ACTIVE_TAB' });
  if (!extracted?.ok) throw new Error(extracted?.error || 'Failed to extract case data.');
  const res = extracted.result;
  if (!res?.ok) throw new Error(res?.error || 'Content script did not return case data.');
  lastCaseData = res.data;
  setCaseTitle(lastCaseData?.caseTitle || 'ELIT judgment helper');
  setStatus('Ready.');
}

async function withCaseData(fn) {
  if (!lastCaseData) {
    await refreshCaseData();
  }
  return await fn(lastCaseData);
}

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = $('#toggleBtn');
  const refreshBtn = $('#refreshBtn');
  const factsBtn = $('#factsBtn');
  const copyFactsBtn = $('#copyFactsBtn');
  const diagramBtn = $('#diagramBtn');
  const copyDiagramBtn = $('#copyDiagramBtn');
  const copyCaseBtn = $('#copyCaseBtn');

  setStatus('Ready.');
  setFactsOutput('');
  setDiagramJson(null);
  renderDiagram(null);

  refreshBtn?.addEventListener('click', async () => {
    try {
      await refreshCaseData();
    } catch (e) {
      setStatus(`Error: ${String(e?.message || e)}`);
    }
  });

  toggleBtn?.addEventListener('click', async () => {
    setStatus('Toggling view…');
    const r = await bg({ type: 'TOGGLE_SIMPLIFIED_ACTIVE_TAB' });
    if (!r?.ok) {
      setStatus(`Error: ${r?.error || 'toggle failed'}`);
      return;
    }
    setStatus('Toggled.');
    window.close();
  });

  factsBtn?.addEventListener('click', async () => {
    try {
      setStatus('Generating facts rundown…');
      setFactsOutput('');

      await withCaseData(async (caseData) => {
        const r = await bg({ type: 'AI_FACTS_RUNDOWN', caseData });
        if (!r?.ok) throw new Error(r?.error || 'AI facts failed.');
        setFactsOutput(r.text);
      });

      setStatus('Facts ready.');
    } catch (e) {
      setStatus(`Error: ${String(e?.message || e)}`);
    }
  });

  copyFactsBtn?.addEventListener('click', async () => {
    try {
      if (!lastFactsText.trim()) {
        setStatus('No facts to copy yet.');
        return;
      }
      await navigator.clipboard.writeText(lastFactsText);
      setStatus('Facts copied.');
    } catch (e) {
      setStatus(`Error: ${String(e?.message || e)}`);
    }
  });

  diagramBtn?.addEventListener('click', async () => {
    try {
      setStatus('Generating diagram…');
      setDiagramJson(null);
      renderDiagram(null);

      await withCaseData(async (caseData) => {
        const r = await bg({ type: 'AI_DIAGRAM', caseData });
        if (!r?.ok) throw new Error(r?.error || 'AI diagram failed.');
        setDiagramJson(r.graph);
        renderDiagram(r.graph);
      });

      setStatus('Diagram ready.');
    } catch (e) {
      setStatus(`Error: ${String(e?.message || e)}`);
    }
  });

  copyDiagramBtn?.addEventListener('click', async () => {
    try {
      if (!lastDiagramGraph) {
        setStatus('No diagram to copy yet.');
        return;
      }
      await navigator.clipboard.writeText(JSON.stringify(lastDiagramGraph, null, 2));
      setStatus('Diagram JSON copied.');
    } catch (e) {
      setStatus(`Error: ${String(e?.message || e)}`);
    }
  });

  copyCaseBtn?.addEventListener('click', async () => {
    try {
      await withCaseData(async (caseData) => {
        await navigator.clipboard.writeText(JSON.stringify(caseData, null, 2));
      });
      setStatus('Case JSON copied.');
    } catch (e) {
      setStatus(`Error: ${String(e?.message || e)}`);
    }
  });

  // Best-effort initial scan.
  try {
    await refreshCaseData();
  } catch (e) {
    setStatus('Open an ELIT judgment page.');
  }
});
