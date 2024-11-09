import { readLegislationNote, saveLegislationNote } from '../storage';
import type { LegislationNote } from '@/types';

const note: LegislationNote = {
  statuteKey: 'synthetic-key',
  statuteTitle: 'Synthetic Act',
  statuteUrl: 'https://sso.agc.gov.sg/Act/Synthetic',
  note: 'SYNTHETIC PRIVATE NOTE',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('note privacy and integrity', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'chrome');
    window.localStorage.clear();
  });

  it('fails closed without extension storage rather than exposing notes to the page', async () => {
    expect(await saveLegislationNote(note)).toBe(false);
    expect(window.localStorage.length).toBe(0);
  });

  it.each([
    null,
    42,
    'corrupt',
    {},
    { ...note, note: 42 },
    { ...note, statuteKey: 'wrong' },
    { ...note, note: 'x'.repeat(8001) },
    { ...note, updatedAt: 'invalid' },
  ])('rejects a corrupt stored payload %#', async (payload) => {
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          local: {
            get: jest.fn().mockResolvedValue({ 'skill-hunter.note.synthetic-key': payload }),
          },
        },
      },
    });
    expect(await readLegislationNote(note.statuteKey)).toBeNull();
  });

  it('reports quota failure and leaves page storage untouched', async () => {
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          local: {
            set: jest.fn().mockRejectedValue(new Error('synthetic quota exceeded')),
          },
        },
      },
    });
    expect(await saveLegislationNote(note)).toBe(false);
    expect(window.localStorage.length).toBe(0);
  });
});
