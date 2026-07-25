/**
 * Tests for storage helper utilities.
 */

import type { LegislationNote } from '@/types';
import {
  buildRevisionUrl,
  createStatuteKeyFromUrl,
  exportLegislationNoteAsMarkdown,
  formatCitation,
  formatDiagnosticsReport,
  readLegislationNote,
  saveLegislationNote,
  copyTextToClipboard,
} from '../storage';

describe('storage utils', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('should derive stable statute keys from URLs', () => {
    const key = createStatuteKeyFromUrl(
      'https://sso.agc.gov.sg/Act/PenalCode?WholeDoc=1&ViewType=Full'
    );
    expect(key).toContain('sso.agc.gov.sg/Act/PenalCode');
    expect(key).toContain('?Full');
  });

  it('should save and read legislation notes via localStorage fallback', async () => {
    const note: LegislationNote = {
      statuteKey: 'sso.agc.gov.sg/Act/Foo',
      statuteTitle: 'Foo Act',
      statuteUrl: 'https://sso.agc.gov.sg/Act/Foo?WholeDoc=1',
      note: 'This section is commonly litigated.',
      updatedAt: '2026-03-30T00:00:00.000Z',
    };

    const saved = await saveLegislationNote(note);
    expect(saved).toBe(true);

    const loaded = await readLegislationNote(note.statuteKey);
    expect(loaded).toEqual(note);
  });

  it('should export notes in markdown format', () => {
    const markdown = exportLegislationNoteAsMarkdown({
      statuteKey: 'k',
      statuteTitle: 'Evidence Act',
      statuteUrl: 'https://sso.agc.gov.sg/Act/EvidenceAct',
      note: 'Check burden of proof provisions.',
      updatedAt: '2026-03-30T00:00:00.000Z',
    });

    expect(markdown).toContain('# Evidence Act');
    expect(markdown).toContain('## Notes');
    expect(markdown).toContain('Check burden of proof provisions.');
  });

  describe('buildRevisionUrl', () => {
    it('should set RevDate and WholeDoc params', () => {
      const result = buildRevisionUrl('https://sso.agc.gov.sg/Act/PC1871?WholeDoc=1', '20200101');
      expect(result).toContain('RevDate=20200101');
      expect(result).toContain('WholeDoc=1');
    });

    it('should add WholeDoc if missing', () => {
      const result = buildRevisionUrl('https://sso.agc.gov.sg/Act/PC1871', '20200101');
      expect(result).toContain('WholeDoc=1');
    });
  });

  describe('formatCitation', () => {
    const title = 'Penal Code 1871';
    const heading = 'Punishment for murder 302';
    const url = 'https://sso.agc.gov.sg/Act/PC1871#pr302-';

    it('should produce default pipe-delimited format', () => {
      const result = formatCitation('default', title, heading, url);
      expect(result).toBe(`${title} | ${heading} | ${url}`);
    });

    it('should produce Bluebook format', () => {
      const result = formatCitation('bluebook', title, heading, url);
      expect(result).toBe('Penal Code 1871, s 302');
    });

    it('should produce OSCOLA format with URL', () => {
      const result = formatCitation('oscola', title, heading, url);
      expect(result).toContain('Penal Code 1871, s 302');
      expect(result).toContain(`<${url}>`);
    });
  });

  describe('formatDiagnosticsReport', () => {
    it('should produce valid JSON with session metadata', () => {
      const entries = [
        {
          sessionId: 'abc',
          timestamp: '2026-03-30T00:00:00.000Z',
          level: 'info' as const,
          context: 'test',
          message: 'Hello',
        },
      ];
      const report = formatDiagnosticsReport(entries, 'abc');
      const parsed = JSON.parse(report) as Record<string, unknown>;
      expect(parsed).toHaveProperty('sessionId', 'abc');
      expect(parsed).toHaveProperty('entryCount', 1);
      expect(parsed).toHaveProperty('entries');
    });

    it('should handle empty entries', () => {
      const report = formatDiagnosticsReport([], 'xyz');
      const parsed = JSON.parse(report) as Record<string, unknown>;
      expect(parsed).toHaveProperty('entryCount', 0);
    });
  });

  it('should copy text using clipboard API when available', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const copied = await copyTextToClipboard('test');
    expect(copied).toBe(true);
    expect(writeText).toHaveBeenCalledWith('test');
  });

  it('should fallback to execCommand when clipboard API fails', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('no clipboard'));
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const execCommand = jest.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });

    const copied = await copyTextToClipboard('fallback');
    expect(copied).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});
