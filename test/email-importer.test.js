import { describe, expect, it } from 'vitest';
import { loadFixture, loadSrc } from './helpers.js';

function loadBundle() {
  const module = { exports: {} };
  const code = [
    loadSrc('imports/run-metadata.js'),
    loadSrc('imports/session.js'),
    loadSrc('imports/normalizer.js'),
    loadSrc('imports/dedupe.js'),
    loadSrc('threads/scanner.js'),
    loadSrc('imports/email.js')
  ].join('\n');
  const fn = new Function('module', 'exports', code + '\nreturn { importer: EmailImporter, dedupe: ImportDedupe };');
  return fn(module, module.exports);
}

function fixture(path) {
  return loadFixture('fixtures/imports/email/' + path);
}

function exportFile(name, content, extra = {}) {
  return Object.assign({
    name,
    text: async () => content
  }, extra);
}

function captureDao() {
  const writes = { chats: [], messages: [], threads: [], runs: [] };
  return {
    writes,
    dao: {
      putChat: async (chat) => writes.chats.push(chat),
      putMessages: async (_chatId, messages) => writes.messages.push(...messages),
      putOpenThreads: async (threads) => writes.threads.push(...threads),
      putExtractionRun: async (run) => writes.runs.push(run)
    }
  };
}

function findMessage(result, text) {
  return result.messages.find((message) => message.content.indexOf(text) !== -1);
}

describe('EmailImporter', () => {
  it('imports local MBOX files with thread grouping, provenance, attachments, and scanner output', async () => {
    const { importer } = loadBundle();
    const { dao, writes } = captureDao();
    const result = await importer.importFiles({
      files: [exportFile('mixed.mbox', fixture('mixed.mbox'), { webkitRelativePath: 'Takeout/Mail/mixed.mbox' })],
      dao,
      importedAt: '2026-06-18T13:00:00.000Z'
    });

    expect(result.chats).toHaveLength(3);
    expect(result.messages).toHaveLength(4);
    expect(result.chats.find((chat) => chat.title === 'Plain launch note')).toMatchObject({
      platform: 'email',
      messageCount: 2
    });
    expect(findMessage(result, 'TODO: send launch note.').content).toContain('From escaped body line should stay body text.');
    expect(findMessage(result, 'TODO: send launch note.').metadata.provenance).toMatchObject({
      messageId: '<plain-1@example.test>',
      from: 'Alice <alice@example.test>',
      to: ['Launch <launch@example.test>'],
      subject: 'Plain launch note',
      labels: ['Inbox', 'Important', 'Project/Launch'],
      mailboxPath: 'Takeout/Mail/mixed.mbox'
    });
    expect(findMessage(result, 'REF: reply source.').metadata.provenance).toMatchObject({
      messageId: '<reply-1@example.test>',
      inReplyTo: '<plain-1@example.test>',
      references: ['<plain-1@example.test>']
    });
    expect(findMessage(result, '[attachment: launch.pdf]').metadata.provenance.attachments[0]).toMatchObject({
      filename: 'launch.pdf',
      contentType: 'application/pdf'
    });
    expect(findMessage(result, 'Duplicate Message-ID fixture.').metadata.provenance.normalizedMessageId).toContain('#duplicate-2');
    expect(result.openThreads.map((thread) => thread.tag)).toEqual(['TODO', 'REF']);
    expect(result.run.metadata.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
      'EMAIL_HTML_SANITIZED',
      'EMAIL_ATTACHMENT_SKIPPED',
      'EMAIL_DUPLICATE_MESSAGE_ID'
    ]));
    expect(result.run.metadata).toMatchObject({
      adapterId: 'email',
      messageCount: 4,
      threadCount: 2
    });
    expect(writes.chats).toHaveLength(3);
    expect(writes.messages).toHaveLength(4);
    expect(writes.threads).toHaveLength(2);
    expect(writes.runs).toHaveLength(1);
  });

  it('sanitizes HTML-only email before storage', async () => {
    const { importer } = loadBundle();
    const htmlOnly = [
      'From sender@example.test Thu Jun 18 13:05:00 2026',
      'Message-ID: <html-only@example.test>',
      'Date: Thu, 18 Jun 2026 13:05:00 +0000',
      'From: Html <html@example.test>',
      'Subject: HTML only',
      'Content-Type: text/html; charset=UTF-8',
      '',
      '<html><body onclick="steal()"><p>TODO: sanitize html</p><a href="javascript:alert(1)">bad link</a><img src="https://tracker.example.test/pixel.png"><script>alert("x")</script></body></html>'
    ].join('\n');
    const result = await importer.importFiles({
      files: [exportFile('html.mbox', htmlOnly)],
      importedAt: '2026-06-18T13:05:00.000Z'
    });

    expect(result.messages[0].content).toContain('TODO: sanitize html');
    expect(result.messages[0].content).toContain('bad link');
    expect(result.messages[0].content).not.toContain('script');
    expect(result.messages[0].content).not.toContain('tracker.example.test');
    expect(result.messages[0].content).not.toContain('javascript:');
    expect(result.openThreads[0]).toMatchObject({ tag: 'TODO', text: 'sanitize html' });
    expect(result.run.metadata.warnings.map((warning) => warning.code)).toContain('EMAIL_HTML_SANITIZED');
  });

  it('imports malformed MBOX entries with recoverable warnings and date fallback', async () => {
    const { importer } = loadBundle();
    const result = await importer.importFiles({
      files: [exportFile('malformed.mbox', fixture('malformed.mbox'))],
      importedAt: '2026-06-18T13:10:00.000Z'
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].timestamp).toBe('2026-06-18T13:10:00.000Z');
    expect(result.messages[0].content).toBe('Malformed header fixture.');
    expect(result.messages[0].metadata.provenance.messageId).toBe('');
    expect(result.run.metadata.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
      'EMAIL_MALFORMED_HEADER',
      'EMAIL_INVALID_DATE'
    ]));
  });

  it('supports source dedupe and large-mailbox cancellation', async () => {
    const { importer, dedupe } = loadBundle();
    const first = await importer.importFiles({
      files: [exportFile('large.mbox', fixture('large.mbox'))],
      importedAt: '2026-06-18T13:15:00.000Z'
    });

    expect(first.messages).toHaveLength(12);
    expect(dedupe.decide([first.chats[0]], {
      adapterId: 'email',
      sourceKind: 'file',
      sourceObjectId: first.chats[0].metadata.import.source.object,
      sourcePath: 'large.mbox',
      packageHash: first.chats[0].metadata.import.packageHash
    }).action).toBe('skip');

    const controller = new AbortController();
    const cancelled = await importer.importFiles({
      files: [exportFile('large.mbox', fixture('large.mbox'))],
      signal: controller.signal,
      importedAt: '2026-06-18T13:20:00.000Z',
      onProgress: (event) => {
        if (event.itemCounts.parsed === 5) controller.abort();
      }
    });

    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.run.metadata.status).toBe('cancelled');
    expect(cancelled.run.metadata.partial.recoverable).toBe(true);
    expect(cancelled.run.metadata.itemCounts.imported).toBeLessThan(12);
  });
});
