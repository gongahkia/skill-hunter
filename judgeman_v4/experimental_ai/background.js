const DEFAULTS = {
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  apiKey: ''
};

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return {
    provider: stored.provider || DEFAULTS.provider,
    model: stored.model || DEFAULTS.model,
    apiKey: stored.apiKey || DEFAULTS.apiKey
  };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found.');
  return tab;
}

async function sendToTab(tabId, message) {
  return await chrome.tabs.sendMessage(tabId, message);
}

function extractModelName(model) {
  // options UI stores plain model name e.g. "gemini-2.0-flash".
  // REST needs models/<name>
  const trimmed = String(model || '').trim();
  if (!trimmed) return 'models/gemini-2.0-flash';
  return trimmed.startsWith('models/') ? trimmed : `models/${trimmed}`;
}

function buildFactsPrompt(caseData) {
  const title = caseData?.caseTitle || '';
  const meta = {
    caseNumber: caseData?.caseNumber || '',
    caseDate: caseData?.caseDate || '',
    tribunalCourt: caseData?.caseTribunalCourt || '',
    coram: caseData?.caseCoram || '',
    parties: caseData?.caseParties || ''
  };

  const factsText = caseData?.factsText || '';
  const legalIssues = Array.isArray(caseData?.caseLegalIssues) ? caseData.caseLegalIssues : [];

  return [
    'You are a legal assistant. Produce a crisp case facts rundown.',
    'Constraints:',
    '- Output plain text with short bullets.',
    '- Do NOT fabricate facts. If missing, say "Not stated".',
    '- Keep it under 180 words.',
    '',
    `Title: ${title}`,
    `Metadata: ${JSON.stringify(meta)}`,
    `Legal issues: ${legalIssues.join(' | ')}`,
    '',
    'Extracted facts (may be partial):',
    factsText
  ].join('\n');
}

function buildDiagramPrompt(caseData) {
  const title = caseData?.caseTitle || '';
  const factsText = caseData?.factsText || '';
  const legalIssues = Array.isArray(caseData?.caseLegalIssues) ? caseData.caseLegalIssues : [];

  // Return strict JSON only (no backticks) so we can parse reliably.
  return [
    'You are a legal analyst. Create a simple directed graph representing the case.',
    'Return ONLY valid JSON, nothing else.',
    'Schema:',
    '{"nodes":[{"id":"string","label":"string","type":"party|court|event|issue|outcome"}],"edges":[{"from":"string","to":"string","label":"string"}]}',
    'Rules:',
    '- Keep nodes <= 10 and edges <= 14.',
    '- Use stable ids like n1, n2...',
    '- Do NOT fabricate facts; if unknown, omit.',
    '',
    `Title: ${title}`,
    `Legal issues: ${legalIssues.join(' | ')}`,
    '',
    'Extracted facts (may be partial):',
    factsText
  ].join('\n');
}

async function geminiGenerateText({ apiKey, model, prompt }) {
  if (!apiKey) throw new Error('Missing API key. Set it in Options.');

  const modelPath = extractModelName(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512
      }
    })
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload?.error?.message || `Gemini error (${res.status})`;
    throw new Error(msg);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
  return text.trim();
}

function tryParseJsonStrict(text) {
  // Expect strict JSON, but sometimes models add leading/trailing whitespace.
  const trimmed = String(text || '').trim();
  return JSON.parse(trimmed);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === 'GET_ACTIVE_TAB_URL') {
      const tab = await getActiveTab();
      sendResponse({ ok: true, url: tab.url || '' });
      return;
    }

    if (message?.type === 'TOGGLE_SIMPLIFIED_ACTIVE_TAB') {
      const tab = await getActiveTab();
      const res = await sendToTab(tab.id, { type: 'TOGGLE_SIMPLIFIED' });
      sendResponse({ ok: true, result: res });
      return;
    }

    if (message?.type === 'EXTRACT_CASE_DATA_ACTIVE_TAB') {
      const tab = await getActiveTab();
      const res = await sendToTab(tab.id, { type: 'EXTRACT_CASE_DATA' });
      sendResponse({ ok: true, result: res });
      return;
    }

    if (message?.type === 'AI_FACTS_RUNDOWN') {
      const settings = await getSettings();
      if (settings.provider !== 'gemini') throw new Error('Only Gemini provider is supported right now.');

      const prompt = buildFactsPrompt(message.caseData || {});
      const text = await geminiGenerateText({
        apiKey: settings.apiKey,
        model: settings.model,
        prompt
      });
      sendResponse({ ok: true, text });
      return;
    }

    if (message?.type === 'AI_DIAGRAM') {
      const settings = await getSettings();
      if (settings.provider !== 'gemini') throw new Error('Only Gemini provider is supported right now.');

      const prompt = buildDiagramPrompt(message.caseData || {});
      const text = await geminiGenerateText({
        apiKey: settings.apiKey,
        model: settings.model,
        prompt
      });

      const graph = tryParseJsonStrict(text);
      sendResponse({ ok: true, graph });
      return;
    }

    sendResponse({ ok: false, error: 'Unknown message.' });
  })().catch((e) => {
    sendResponse({ ok: false, error: String(e?.message || e) });
  });

  // keep message channel open for async
  return true;
});
