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
  <rect width="800" height="400" rx="0" fill="#f8f4ec"/>
  <rect x="32" y="32" width="736" height="336" rx="18" fill="#fff8ea" stroke="#dfcab2" stroke-width="2"/>
  <text x="64" y="86" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#191411">${escapeSvgText(dorsoWordmark)}</text>
  <text x="64" y="130" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#9a4516" letter-spacing="2">SOLVE RECEIPT</text>
  <text x="64" y="188" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" fill="#191411">${escapeSvgText(problemTitle)}</text>
  <text x="64" y="226" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#66594d">${escapeSvgText(sourceLabel)} / ${escapeSvgText(formatSolveTime(timeToSolveMs))}</text>
  <rect x="64" y="270" width="180" height="62" rx="12" fill="#f1dfca"/>
  <text x="86" y="295" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#66594d">current run</text>
  <text x="86" y="321" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#191411">${safeRun}</text>
  <rect x="276" y="270" width="220" height="62" rx="12" fill="#f1dfca"/>
  <text x="298" y="295" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#66594d">${escapeSvgText(COGNITIVE_INDEX_LABEL)}</text>
  <text x="298" y="321" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#191411">${safeScore}</text>
  <path d="M590 80h80v80h-80z" fill="#a14419"/>
  <path d="M610 100h40v40h-40z" fill="#fff8ea"/>
  <text x="568" y="332" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#66594d">local-only / no account</text>
</svg>`;
}
