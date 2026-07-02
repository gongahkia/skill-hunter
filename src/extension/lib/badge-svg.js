import { COGNITIVE_INDEX_LABEL } from '../../shared/core/atrophy.js';

function escapeSvgText(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function renderBadgeSvg({
    cognitiveIndex = 0,
    longestRun = 0,
    generatedAt = new Date().toISOString(),
} = {}) {
    const safeScore = Math.round(clamp(Number(cognitiveIndex || 0), 0, 100));
    const safeRun = Math.max(0, Math.trunc(Number(longestRun || 0)));
    const generatedDate = escapeSvgText(String(generatedAt).slice(0, 10));

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" role="img" aria-label="Dorso Cognitive Index badge">
  <defs>
    <linearGradient id="dorso-badge-bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#eef5ff"/>
    </linearGradient>
  </defs>
  <rect width="800" height="400" rx="0" fill="url(#dorso-badge-bg)"/>
  <rect x="32" y="32" width="736" height="336" rx="16" fill="#ffffff" stroke="#dbe4f0" stroke-width="2"/>
  <text x="64" y="92" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="30" font-weight="600" fill="#030712">Dorso</text>
  <text x="64" y="132" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="17" fill="#4b5563">local deliberate-practice badge</text>
  <text x="64" y="222" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="82" font-weight="700" fill="#2563eb">${safeScore}</text>
  <text x="64" y="260" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="22" fill="#111827">${escapeSvgText(COGNITIVE_INDEX_LABEL)}</text>
  <rect x="430" y="88" width="240" height="86" rx="16" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="456" y="123" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="16" fill="#4b5563">longest run</text>
  <text x="456" y="158" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="34" font-weight="600" fill="#111827">${safeRun}</text>
  <rect x="430" y="204" width="240" height="86" rx="16" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="456" y="239" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="16" fill="#4b5563">generated</text>
  <text x="456" y="274" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="24" font-weight="500" fill="#111827">${generatedDate}</text>
  <text x="64" y="332" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="18" fill="#4b5563">lower score means more atrophied / no account required</text>
</svg>`;
}
