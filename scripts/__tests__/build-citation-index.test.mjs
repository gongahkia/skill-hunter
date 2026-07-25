// Smoke tests for the citation-index builder. Run with `node --test`.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  buildIndexes,
  compileCitationRegex,
  extractCourt,
  extractEntriesFromCase,
  extractYear,
  labelToSlug,
  SG_ACT_MAP,
  buildSnippet,
} from '../build-citation-index.mjs';

test('labelToSlug maps known names and aliases', () => {
  assert.equal(labelToSlug('Penal Code', SG_ACT_MAP), 'PC1871');
  assert.equal(labelToSlug('Penal Code 1871', SG_ACT_MAP), 'PC1871');
  assert.equal(labelToSlug('Misuse of Drugs Act', SG_ACT_MAP), 'MDA1973');
  assert.equal(labelToSlug('Unknown Act', SG_ACT_MAP), null);
});

test('extractCourt pulls SG court code from citation', () => {
  assert.equal(extractCourt('[2026] SGHC 47'), 'SGHC');
  assert.equal(extractCourt('[2024] SGCA 12'), 'SGCA');
  assert.equal(extractCourt(''), '');
});

test('extractYear prefers sort_year then decision_date then citation', () => {
  assert.equal(extractYear({ sort_year: 2026 }), 2026);
  assert.equal(extractYear({ decision_date: '2025-01-01' }), 2025);
  assert.equal(extractYear({ citation: '[2024] SGHC 5' }), 2024);
  assert.equal(extractYear({}), 0);
});

test('buildSnippet returns surrounding words with ellipsis', () => {
  const body = 'alpha beta gamma delta epsilon zeta eta theta';
  const matchIndex = body.indexOf('delta');
  const matchLength = 'delta'.length;
  const snippet = buildSnippet(body, matchIndex, matchLength, { wordsBefore: 2, wordsAfter: 2 });
  assert.equal(snippet, '…beta gamma delta epsilon zeta…');
});

test('extractEntriesFromCase finds section refs for known Acts', () => {
  const regex = compileCitationRegex(SG_ACT_MAP);
  const caseRecord = {
    body: 'The accused was charged under section 415 of the Penal Code for cheating, and under s 33 of the Misuse of Drugs Act 1973.',
    citation: '[2026] SGHC 47',
    title: 'A v B',
    decision_date: '2026-03-04',
    url: 'https://example.com/c',
  };
  const entries = extractEntriesFromCase(caseRecord, regex, SG_ACT_MAP);
  const slugs = entries.map((e) => e.slug).sort();
  assert.deepEqual(slugs, ['MDA1973', 'PC1871']);
  const pc = entries.find((e) => e.slug === 'PC1871');
  assert.equal(pc.sectionId, 'pr415-he-');
  assert.equal(pc.entry.citation, '[2026] SGHC 47');
  assert.equal(pc.entry.court, 'SGHC');
  assert.equal(pc.entry.year, 2026);
});

test('extractEntriesFromCase strips sub-part suffixes for the section anchor', () => {
  const regex = compileCitationRegex(SG_ACT_MAP);
  const entries = extractEntriesFromCase(
    {
      body: 'under section 5(3)(a) of the Penal Code',
      citation: '[2024] SGCA 1',
      url: 'u',
    },
    regex,
    SG_ACT_MAP
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sectionId, 'pr5-he-');
});

test('buildIndexes aggregates entries and emits sorted newest-first', () => {
  const cases = [
    {
      body: 'section 109 of the Penal Code applies',
      citation: '[2026] SGHC 47',
      title: 'New case',
      decision_date: '2026-03-04',
      url: 'u1',
    },
    {
      body: 'section 109 of the Penal Code referenced again',
      citation: '[2020] SGHC 10',
      title: 'Old case',
      decision_date: '2020-01-01',
      url: 'u2',
    },
  ];
  const indexes = buildIndexes(cases);
  const pc = indexes.get('PC1871');
  assert.ok(pc, 'Penal Code index present');
  const section = pc.sections['pr109-he-'];
  assert.equal(section.length, 2);
  assert.equal(section[0].year, 2026);
  assert.equal(section[1].year, 2020);
});

test('buildIndexes deduplicates citations per section', () => {
  const cases = [
    {
      body: 'section 415 of the Penal Code and again section 415 of the Penal Code',
      citation: '[2026] SGHC 47',
      url: 'u',
    },
  ];
  const indexes = buildIndexes(cases);
  const pc = indexes.get('PC1871');
  assert.equal(pc.sections['pr415-he-'].length, 1);
});
