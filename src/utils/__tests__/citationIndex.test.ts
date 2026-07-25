/**
 * Tests for citation index loader / query helpers.
 */

import {
  extractActSlugFromUrl,
  getTopCasesForSection,
  summariseSectionCoverage,
} from '../citationIndex';
import type { CitationIndex } from '@/types';

describe('citationIndex', () => {
  describe('extractActSlugFromUrl', () => {
    it('returns the slug for /Act/ URLs', () => {
      expect(extractActSlugFromUrl('https://sso.agc.gov.sg/Act/PC1871?WholeDoc=1')).toBe('PC1871');
    });

    it('returns the slug for /SL/ URLs', () => {
      expect(extractActSlugFromUrl('https://sso.agc.gov.sg/SL/MR-r2?DocDate=20200101')).toBe(
        'MR-r2'
      );
    });

    it('returns null for non-SSO hosts', () => {
      expect(extractActSlugFromUrl('https://example.com/Act/Foo')).toBeNull();
    });

    it('returns null when path does not match expected prefix', () => {
      expect(extractActSlugFromUrl('https://sso.agc.gov.sg/Search?query=x')).toBeNull();
    });

    it('returns null on malformed URL', () => {
      expect(extractActSlugFromUrl('not a url')).toBeNull();
    });
  });

  describe('getTopCasesForSection', () => {
    const index: CitationIndex = {
      actSlug: 'PC1871',
      actName: 'Penal Code',
      builtAt: '2026-06-02T08:05:00.000Z',
      sourceCorpusSize: 1,
      sections: {
        'pr109-he-': [
          {
            citation: '[2026] SGHC 47',
            title: 'A v B',
            year: 2026,
            court: 'SGHC',
            url: '',
            snippet: '',
          },
          {
            citation: '[2025] SGHC 10',
            title: 'C v D',
            year: 2025,
            court: 'SGHC',
            url: '',
            snippet: '',
          },
        ],
      },
    };

    it('returns entries up to the limit', () => {
      expect(getTopCasesForSection(index, 'pr109-he-', 1)).toHaveLength(1);
      expect(getTopCasesForSection(index, 'pr109-he-', 1)[0]?.citation).toBe('[2026] SGHC 47');
    });

    it('returns empty array when section is missing', () => {
      expect(getTopCasesForSection(index, 'pr999-he-')).toEqual([]);
    });

    it('returns empty array when index is null', () => {
      expect(getTopCasesForSection(null, 'pr109-he-')).toEqual([]);
    });

    it('respects negative or zero limit by returning empty', () => {
      expect(getTopCasesForSection(index, 'pr109-he-', 0)).toEqual([]);
    });
  });

  describe('summariseSectionCoverage', () => {
    it('returns a map of section ids to citation counts', () => {
      const index: CitationIndex = {
        actSlug: 'PC1871',
        actName: 'Penal Code',
        builtAt: '',
        sourceCorpusSize: 0,
        sections: {
          'pr109-he-': [{ citation: 'a', title: '', year: 0, court: '', url: '', snippet: '' }],
          'pr415-he-': [
            { citation: 'b', title: '', year: 0, court: '', url: '', snippet: '' },
            { citation: 'c', title: '', year: 0, court: '', url: '', snippet: '' },
          ],
          'pr500-he-': [],
        },
      };
      const summary = summariseSectionCoverage(index);
      expect(summary.get('pr109-he-')).toBe(1);
      expect(summary.get('pr415-he-')).toBe(2);
      expect(summary.has('pr500-he-')).toBe(false);
    });

    it('returns an empty map when index is null', () => {
      expect(summariseSectionCoverage(null).size).toBe(0);
    });
  });
});
