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

function formatSolveTime(timeToSolveMs) {
    const totalSeconds = Math.max(0, Math.round(Number(timeToSolveMs || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) {
        return `${seconds}s`;
    }

    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function renderReceiptSvg({
    problemTitle = 'Challenge solved',
    sourceLabel = 'Dorso',
    timeToSolveMs = 0,
    currentRun = 0,
    dorsoWordmark = 'Dorso',
    cognitiveIndex = 0,
} = {}) {
    const safeScore = Math.round(clamp(Number(cognitiveIndex || 0), 0, 100));
    const safeRun = Math.max(0, Math.trunc(Number(currentRun || 0)));

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" role="img" aria-label="Dorso solve receipt">
  <defs>
    <linearGradient id="dorso-bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#eef5ff"/>
    </linearGradient>
  </defs>
  <rect width="800" height="400" rx="0" fill="url(#dorso-bg)"/>
  <rect x="32" y="32" width="736" height="336" rx="14" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
  <text x="64" y="86" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="28" font-weight="500" fill="#030712">${escapeSvgText(dorsoWordmark)}</text>
  <text x="64" y="130" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="16" fill="#2563eb" letter-spacing="0">Solve receipt</text>
  <text x="64" y="188" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="38" font-weight="400" fill="#030712">${escapeSvgText(problemTitle)}</text>
  <text x="64" y="226" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="20" fill="#4b5563">${escapeSvgText(sourceLabel)} / ${escapeSvgText(formatSolveTime(timeToSolveMs))}</text>
  <rect x="64" y="270" width="180" height="62" rx="14" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="86" y="295" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="14" fill="#4b5563">current run</text>
  <text x="86" y="321" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="26" font-weight="400" fill="#030712">${safeRun}</text>
  <rect x="276" y="270" width="220" height="62" rx="14" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="298" y="295" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="14" fill="#4b5563">${escapeSvgText(COGNITIVE_INDEX_LABEL)}</text>
  <text x="298" y="321" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="26" font-weight="400" fill="#030712">${safeScore}</text>
  <path d="M590 80h80v80h-80z" fill="#2563eb"/>
  <path d="M610 100h40v40h-40z" fill="#f97316"/>
  <text x="568" y="332" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="18" fill="#4b5563">local-only / no account</text>
</svg>`;
}
