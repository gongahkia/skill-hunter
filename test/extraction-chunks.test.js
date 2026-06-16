import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadChunker() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('extraction/chunks.js'));
  fn(module, module.exports);
  return module.exports;
}

function message(index) {
  return {
    messageId: 'm-' + index,
    role: index % 2 ? 'assistant' : 'user',
    content: 'message ' + index,
    index
  };
}

describe('ExtractionChunker', () => {
  it('builds 8-message sliding windows with 2-message overlap', () => {
    const chunker = loadChunker();
    const windows = chunker.buildSlidingWindows(Array.from({ length: 100 }, (_, index) => message(index)));

    expect(windows).toHaveLength(17);
    expect(windows[0].messages.map((row) => row.messageId)).toEqual(['m-0', 'm-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6', 'm-7']);
    expect(windows[1].messages.map((row) => row.messageId)).toEqual(['m-6', 'm-7', 'm-8', 'm-9', 'm-10', 'm-11', 'm-12', 'm-13']);
    expect(windows[16].messages.map((row) => row.messageId)).toEqual(['m-96', 'm-97', 'm-98', 'm-99']);
  });

  it('deduplicates extracted threads by messageId and text', () => {
    const chunker = loadChunker();
    const rows = chunker.dedupeThreads([
      { tag: 'TODO', text: 'Update docs', messageId: 'm-1', confidence: 0.7 },
      { tag: 'TODO', text: ' Update   docs ', messageId: 'm-1', confidence: 0.9 },
      { tag: 'TODO', text: 'Update docs', messageId: 'm-2', confidence: 0.8 },
      { tag: 'FIXME', text: 'Check SQL', messageId: 'm-1', confidence: 0.8 }
    ]);

    expect(rows).toEqual([
      { tag: 'TODO', text: 'Update docs', messageId: 'm-1', confidence: 0.7 },
      { tag: 'TODO', text: 'Update docs', messageId: 'm-2', confidence: 0.8 },
      { tag: 'FIXME', text: 'Check SQL', messageId: 'm-1', confidence: 0.8 }
    ]);
  });

  it('runs a 100-message windowed extraction in under 60s without duplicate threads', async () => {
    const chunker = loadChunker();
    const result = await chunker.runWindowedExtraction(Array.from({ length: 100 }, (_, index) => message(index)), async (messages) => {
      return messages.slice(0, 2).concat(messages.slice(-2)).map((row) => ({
        tag: 'UNRESOLVED',
        text: 'Resolve overlap item',
        messageId: row.messageId,
        confidence: 0.8
      }));
    });
    const keys = new Set(result.threads.map((thread) => thread.messageId + '\0' + thread.text));

    expect(result.windows).toHaveLength(17);
    expect(result.durationMs).toBeLessThan(60000);
    expect(keys.size).toBe(result.threads.length);
    expect(result.rawThreadCount).toBeGreaterThan(result.threads.length);
  });
});
