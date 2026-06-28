const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function escapeSvgText(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

export function getDigestEntries(entries = [], now = Date.now()) {
    return entries.filter((entry) => {
        return Number.isFinite(entry.timestamp) && now - entry.timestamp <= SEVEN_DAYS_MS;
    });
}

export function groupDigestEntries(entries = []) {
    return entries.reduce((groups, entry) => {
        const target = entry.target || 'unknown target';
        groups.set(target, [...(groups.get(target) || []), entry]);
        return groups;
    }, new Map());
}

export function renderDigestMarkdown(entries = []) {
    const groups = groupDigestEntries(entries);
    const lines = ['# Dorso weekly digest', ''];

    for (const [target, targetEntries] of groups.entries()) {
        lines.push(`## ${target}`);
        targetEntries.forEach((entry) => {
            lines.push(`- ${entry.text}`);
        });
        lines.push('');
    }

    if (groups.size === 0) {
        lines.push('No saved prompts in the last 7 days.');
    }

    return lines.join('\n').trimEnd();
}

export function renderDigestSvg({
    entries = [],
    generatedAt = Date.now(),
    dorsoWordmark = 'Dorso',
} = {}) {
    const groups = [...groupDigestEntries(entries).entries()];
    const generatedDate = new Date(generatedAt).toISOString().slice(0, 10);
    const rows = groups.slice(0, 5).map(([target, targetEntries], index) => {
        const y = 188 + (index * 34);
        return `<text x="86" y="${y}" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="20" fill="#030712">${escapeSvgText(target)}: ${targetEntries.length}</text>`;
    }).join('\n  ');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" role="img" aria-label="Dorso weekly digest">
  <defs>
    <linearGradient id="dorso-bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#eef5ff"/>
    </linearGradient>
  </defs>
  <rect width="800" height="400" rx="0" fill="url(#dorso-bg)"/>
  <rect x="32" y="32" width="736" height="336" rx="14" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
  <text x="64" y="86" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="28" font-weight="500" fill="#030712">${escapeSvgText(dorsoWordmark)}</text>
  <text x="64" y="130" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="16" fill="#2563eb" letter-spacing="0">Weekly digest</text>
  <text x="64" y="162" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="18" fill="#4b5563">${escapeSvgText(generatedDate)} / ${entries.length} saved prompt${entries.length === 1 ? '' : 's'}</text>
  ${rows || '<text x="86" y="188" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="20" fill="#030712">No saved prompts in the last 7 days.</text>'}
  <path d="M650 72h64v64h-64z" fill="#2563eb"/>
  <path d="M666 88h32v32h-32z" fill="#f97316"/>
  <text x="568" y="332" font-family="IBM Plex Sans, Arial, Helvetica, sans-serif" font-size="18" fill="#4b5563">local-only digest</text>
</svg>`;
}
