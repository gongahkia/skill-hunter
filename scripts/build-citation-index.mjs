#!/usr/bin/env node
// ABOUTME: Offline pre-compute. Walks a case corpus and emits per-Act citation index JSONs
//          bundled with the extension. Issue #3.

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Known SG statutes → SSO Act slugs. Add more here as corpus coverage grows.
// Order matters: longer names first to avoid prefix-collision matches.
export const SG_ACT_MAP = [
  { slug: 'PDPA2012', name: 'Personal Data Protection Act', aliases: ['Personal Data Protection Act 2012', 'PDPA'] },
  { slug: 'MDA1973', name: 'Misuse of Drugs Act', aliases: ['Misuse of Drugs Act 1973', 'MDA'] },
  { slug: 'CPC2010', name: 'Criminal Procedure Code', aliases: ['Criminal Procedure Code 2010', 'CPC'] },
  { slug: 'SFA2001', name: 'Securities and Futures Act', aliases: ['Securities and Futures Act 2001', 'SFA'] },
  { slug: 'CoA1967', name: 'Companies Act', aliases: ['Companies Act 1967'] },
  { slug: 'EmA1968', name: 'Employment Act', aliases: ['Employment Act 1968'] },
  { slug: 'RTA1961', name: 'Road Traffic Act', aliases: ['Road Traffic Act 1961'] },
  { slug: 'ITA1947', name: 'Income Tax Act', aliases: ['Income Tax Act 1947'] },
  { slug: 'PC1871', name: 'Penal Code', aliases: ['Penal Code 1871'] },
];

/**
 * Build a single combined regex that captures (sectionNumber, actLabel) for any known Act.
 * Pattern: section N(...) of (the)? <ActName>
 */
export function compileCitationRegex(actMap) {
  const allLabels = [];
  for (const entry of actMap) {
    allLabels.push(entry.name, ...entry.aliases);
  }
  // Sort by length descending so longer aliases match before shorter ones.
  allLabels.sort((a, b) => b.length - a.length);
  const labelsAlt = allLabels.map((l) => escapeRegex(l)).join('|');
  return new RegExp(
    String.raw`\b(?:sections?|ss?\.?)\s+(\d+[A-Z]?(?:\(\w+\))*)\s+(?:of\s+(?:the\s+)?)?(${labelsAlt})\b`,
    'g'
  );
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Map an Act label string back to its slug. Returns null when unknown.
 */
export function labelToSlug(label, actMap) {
  const normalized = label.replace(/\s+/g, ' ').trim();
  for (const entry of actMap) {
    if (entry.name === normalized) return entry.slug;
    if (entry.aliases.some((a) => a === normalized)) return entry.slug;
  }
  return null;
}

/**
 * Extract court from an SG citation like "[2026] SGHC 47" → "SGHC".
 */
export function extractCourt(citation) {
  if (!citation) return '';
  const match = /\bSG[A-Z]+\b/.exec(citation);
  return match ? match[0] : '';
}

export function extractYear(caseRecord) {
  if (caseRecord.sort_year && Number.isFinite(Number(caseRecord.sort_year))) {
    return Number(caseRecord.sort_year);
  }
  if (caseRecord.decision_date) {
    const m = /^(\d{4})/.exec(String(caseRecord.decision_date));
    if (m) return Number(m[1]);
  }
  if (caseRecord.year && Number.isFinite(Number(caseRecord.year))) {
    return Number(caseRecord.year);
  }
  const citationYear = /\[(\d{4})\]/.exec(caseRecord.citation || '');
  return citationYear ? Number(citationYear[1]) : 0;
}

/**
 * Slice a snippet around a match: up to wordsBefore + wordsAfter words.
 */
export function buildSnippet(body, matchIndex, matchLength, { wordsBefore = 15, wordsAfter = 15 } = {}) {
  if (!body) return '';
  const before = body.slice(0, matchIndex).split(/\s+/).filter(Boolean).slice(-wordsBefore).join(' ');
  const matched = body.slice(matchIndex, matchIndex + matchLength);
  const after = body.slice(matchIndex + matchLength).split(/\s+/).filter(Boolean).slice(0, wordsAfter).join(' ');
  const prefix = before ? `…${before} ` : '';
  const suffix = after ? ` ${after}…` : '';
  return `${prefix}${matched}${suffix}`.replace(/\s+/g, ' ').trim();
}

/**
 * Extract citation entries from a single case body using the prebuilt regex.
 * Returns array of {slug, sectionId, entry}.
 */
export function extractEntriesFromCase(caseRecord, regex, actMap) {
  const body = String(caseRecord.body || '');
  if (!body) return [];

  const out = [];
  const seen = new Set();
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(body)) !== null) {
    const sectionNum = match[1];
    const actLabel = match[2];
    const slug = labelToSlug(actLabel, actMap);
    if (!slug) continue;

    const baseSection = sectionNum.match(/^\d+[A-Z]?/i)?.[0];
    if (!baseSection) continue;
    const sectionId = `pr${baseSection}-he-`;

    // Deduplicate per (case, slug, section).
    const key = `${slug}|${sectionId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      slug,
      sectionId,
      entry: {
        citation: String(caseRecord.citation || '').trim(),
        title: String(caseRecord.title || '').trim(),
        year: extractYear(caseRecord),
        court: extractCourt(caseRecord.citation || '') || String(caseRecord.court || '').trim(),
        url: String(caseRecord.url || '').trim(),
        snippet: buildSnippet(body, match.index, match[0].length),
      },
    });
  }
  return out;
}

/**
 * Aggregate a list of case records into one CitationIndex per Act slug.
 */
export function buildIndexes(cases, actMap = SG_ACT_MAP) {
  const regex = compileCitationRegex(actMap);
  const indexes = new Map();
  for (const slug of new Set(actMap.map((a) => a.slug))) {
    const actName = actMap.find((a) => a.slug === slug)?.name ?? slug;
    indexes.set(slug, {
      actSlug: slug,
      actName,
      builtAt: new Date().toISOString(),
      sourceCorpusSize: cases.length,
      sections: {},
    });
  }

  for (const caseRecord of cases) {
    for (const { slug, sectionId, entry } of extractEntriesFromCase(caseRecord, regex, actMap)) {
      const idx = indexes.get(slug);
      if (!idx) continue;
      const bucket = (idx.sections[sectionId] ||= []);
      // Avoid duplicate citations per section (keep first occurrence).
      if (!bucket.some((existing) => existing.citation === entry.citation)) {
        bucket.push(entry);
      }
    }
  }

  // Sort each section's citations newest-first.
  for (const idx of indexes.values()) {
    for (const sectionId of Object.keys(idx.sections)) {
      idx.sections[sectionId].sort((a, b) => (b.year || 0) - (a.year || 0));
    }
  }

  return indexes;
}

async function readJsonFile(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

async function loadCases(corpusPath) {
  const stats = await stat(corpusPath);
  const cases = [];
  if (stats.isDirectory()) {
    const entries = await readdir(corpusPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!/elasticsearch_in_cases.*\.json$/.test(entry.name)) continue;
      const fullPath = join(corpusPath, entry.name);
      const docs = await readJsonFile(fullPath);
      if (Array.isArray(docs)) cases.push(...docs);
    }
  } else if (corpusPath.endsWith('.jsonl')) {
    const raw = await readFile(corpusPath, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        cases.push(JSON.parse(line));
      } catch {
        // skip malformed lines
      }
    }
  } else {
    const docs = await readJsonFile(corpusPath);
    if (Array.isArray(docs)) cases.push(...docs);
  }
  // De-duplicate by URL or citation.
  const seen = new Set();
  return cases.filter((c) => {
    const key = c.url || c.citation || JSON.stringify(c).slice(0, 200);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function writeIndexes(indexes, outDir) {
  await mkdir(outDir, { recursive: true });
  const manifest = { builtAt: new Date().toISOString(), acts: [] };
  for (const [slug, idx] of indexes.entries()) {
    const sectionCount = Object.keys(idx.sections).length;
    if (sectionCount === 0) continue;
    const filePath = join(outDir, `${slug}.json`);
    await writeFile(filePath, `${JSON.stringify(idx, null, 2)}\n`, 'utf8');
    const totalEntries = Object.values(idx.sections).reduce((s, arr) => s + arr.length, 0);
    manifest.acts.push({ slug, name: idx.actName, sections: sectionCount, citations: totalEntries });
  }
  await writeFile(
    join(outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
  return manifest;
}

async function main() {
  const corpusPath = process.argv[2] || process.env.SKILL_HUNTER_CORPUS;
  const outDir = resolve(ROOT, process.argv[3] || 'src/assets/citations');

  if (!corpusPath) {
    console.error(
      'usage: node scripts/build-citation-index.mjs <corpusPath> [outDir]\n' +
        '       corpusPath may be a directory of elasticsearch_in_cases*.json files, a single .json array, or a .jsonl file.'
    );
    process.exit(2);
  }

  const cases = await loadCases(resolve(corpusPath));
  console.log(`Loaded ${cases.length} cases from ${corpusPath}`);

  const indexes = buildIndexes(cases);
  const manifest = await writeIndexes(indexes, outDir);
  console.log(`Wrote ${manifest.acts.length} Act indexes to ${outDir}`);
  for (const a of manifest.acts) {
    console.log(`  ${a.slug} (${a.name}): ${a.sections} sections, ${a.citations} citations`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
