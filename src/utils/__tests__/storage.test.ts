/**
 * Tests for storage helper utilities.
 */

import type { LegislationNote } from '@/types';
import {
  createStatuteKeyFromUrl,
  exportLegislationNoteAsMarkdown,
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
    const key = createStatuteKeyFromUrl('https://sso.agc.gov.sg/Act/PenalCode?WholeDoc=1&ViewType=Full');
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

    const execCommand = jest.spyOn(document, 'execCommand').mockReturnValue(true);

    const copied = await copyTextToClipboard('fallback');
    expect(copied).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});
