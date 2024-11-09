import { loadCitationIndex } from '../citationIndex';
import { renderCitationListItem } from '@/core/citationGraphPanel';

describe('citation asset failure and rendering boundaries', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: { getURL: (name: string) => `chrome-extension://synthetic/${name}` },
      },
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'chrome');
    Reflect.deleteProperty(globalThis, 'fetch');
    jest.useRealTimers();
  });

  it('does not make javascript citation URLs clickable', () => {
    const host = document.createElement('div');
    host.innerHTML = renderCitationListItem({
      citation: 'synthetic',
      title: '<b>Title</b>',
      year: 2026,
      court: 'SGHC',
      url: 'javascript:alert(1)',
      snippet: '<img onerror=alert(1)>',
    });
    expect(host.querySelector('a')).toBeNull();
    expect(host.querySelector('img, b')).toBeNull();
    expect(host.textContent).toContain('<b>Title</b>');
  });

  it.each([404, 429, 500])('degrades safely on asset HTTP %i', async (status) => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status });
    expect(await loadCitationIndex('PC1871')).toBeNull();
  });

  it.each([
    null,
    [],
    { actSlug: 'PC1871', actName: 'Penal Code', sections: [] },
    { actSlug: 'PC1871', actName: 'Penal Code', sections: { 'pr1-he-': [42] } },
  ])('rejects malformed payload %# before the renderer can throw', async (payload) => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });
    expect(await loadCitationIndex('PC1871')).toBeNull();
  });

  it('degrades safely on offline failure or invalid JSON', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('synthetic offline'));
    expect(await loadCitationIndex('PC1871')).toBeNull();
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError('synthetic invalid JSON')),
    });
    expect(await loadCitationIndex('PC1871')).toBeNull();
  });

  it('bounds stalled asset loads', async () => {
    jest.useFakeTimers();
    globalThis.fetch = jest.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('synthetic timeout')));
        })
    );
    const result = loadCitationIndex('PC1871');
    await jest.advanceTimersByTimeAsync(3500);
    expect(await result).toBeNull();
  });
});
