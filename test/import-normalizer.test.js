import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadNormalizer() {
  const module = { exports: {} };
  const code = [
    loadSrc('imports/run-metadata.js'),
    loadSrc('imports/normalizer.js')
  ].join('\n');
  const fn = new Function('module', 'exports', code);
  fn(module, module.exports);
  return module.exports;
}

describe('ImportNormalizer', () => {
  it('creates imported chat rows with source provenance', () => {
    const normalizer = loadNormalizer();
    const chat = normalizer.createChat({
      adapterId: 'notion',
      adapterVersion: 'v1',
      chatId: 'notion:page:page-1',
      title: 'Launch notes',
      sourceKind: 'page',
      sourceObjectId: 'page-1',
      sourcePath: 'workspace/Launch notes',
      sourceUrl: 'https://notion.so/page-1',
      sourceUpdatedAt: '2026-06-18T01:00:00.000Z',
      importedAt: '2026-06-18T02:00:00.000Z',
      runId: 'import:notion:page-1:abc',
      messageCount: 2,
      provenance: { workspace: 'product' }
    });

    expect(chat).toMatchObject({
      chatId: 'notion:page:page-1',
      platform: 'notion',
      title: 'Launch notes',
      url: 'https://notion.so/page-1',
      capturedAt: '2026-06-18T02:00:00.000Z',
      lastUpdatedAt: '2026-06-18T01:00:00.000Z',
      messageCount: 2
    });
    expect(chat.metadata.provenance).toEqual({
      sourceKind: 'page',
      sourceId: 'page-1',
      sourceObject: 'page-1',
      sourcePath: 'workspace/Launch notes',
      sourceUrl: 'https://notion.so/page-1',
      workspace: 'product'
    });
    expect(chat.metadata.import.runId).toBe('import:notion:page-1:abc');
  });

  it('creates imported message rows with source row provenance', () => {
    const normalizer = loadNormalizer();
    const message = normalizer.createMessage({
      adapterId: 'email',
      adapterVersion: 'v1',
      chatId: 'email:thread:abc',
      messageId: 'email:thread:abc:message-1',
      role: 'email',
      content: 'TODO: reply to Alice',
      index: 1,
      sourceKind: 'mbox-message',
      sourceObjectId: '<message-1@example.com>',
      sourcePath: 'Takeout/Mail/mail.mbox',
      sourceUrl: 'mailto:alice@example.com',
      sourceTimestamp: '2026-06-17T22:00:00.000Z',
      authorId: 'alice@example.com',
      authorName: 'Alice',
      importedAt: '2026-06-18T02:30:00.000Z',
      runId: 'import:email:mail:abc',
      provenance: { label: 'Inbox' }
    });

    expect(message).toMatchObject({
      messageId: 'email:thread:abc:message-1',
      id: 'email:thread:abc:message-1',
      chatId: 'email:thread:abc',
      platform: 'email',
      role: 'email',
      content: 'TODO: reply to Alice',
      timestamp: '2026-06-17T22:00:00.000Z',
      index: 1
    });
    expect(message.metadata.provenance).toEqual({
      sourceKind: 'mbox-message',
      sourceId: '<message-1@example.com>',
      sourceObject: '<message-1@example.com>',
      sourcePath: 'Takeout/Mail/mail.mbox',
      sourceUrl: 'mailto:alice@example.com',
      authorId: 'alice@example.com',
      authorName: 'Alice',
      sourceTimestamp: '2026-06-17T22:00:00.000Z',
      label: 'Inbox'
    });
  });

  it('validates imported row identity', () => {
    const normalizer = loadNormalizer();

    expect(() => normalizer.createChat({ chatId: 'x' })).toThrow('adapterId is required');
    expect(() => normalizer.createChat({ adapterId: 'keep' })).toThrow('chatId is required');
    expect(() => normalizer.createMessage({ adapterId: 'keep', messageId: 'm1' })).toThrow('chatId is required');
    expect(() => normalizer.createMessage({ adapterId: 'keep', chatId: 'c1' })).toThrow('messageId is required');
  });
});
