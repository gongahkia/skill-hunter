import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadFixture, loadSrc } from './helpers.js';

function loadImporter() {
  const dom = new JSDOM('');
  const module = { exports: {} };
  const code = [
    loadSrc('imports/run-metadata.js'),
    loadSrc('imports/session.js'),
    loadSrc('imports/normalizer.js'),
    loadSrc('threads/scanner.js'),
    loadSrc('imports/google-docs.js')
  ].join('\n');
  const fn = new Function('module', 'exports', 'DOMParser', code);
  fn(module, module.exports, dom.window.DOMParser);
  return module.exports;
}

function loadBundle() {
  const dom = new JSDOM('');
  const module = { exports: {} };
  const code = [
    loadSrc('imports/run-metadata.js'),
    loadSrc('imports/session.js'),
    loadSrc('imports/normalizer.js'),
    loadSrc('imports/dedupe.js'),
    loadSrc('threads/scanner.js'),
    loadSrc('imports/google-docs.js')
  ].join('\n');
  const fn = new Function('module', 'exports', 'DOMParser', code + '\nreturn { importer: GoogleDocsImporter, dedupe: ImportDedupe };');
  return fn(module, module.exports, dom.window.DOMParser);
}

function fixture(name) {
  return loadFixture('fixtures/imports/google-docs/' + name);
}

function exportFile(name, content, extra = {}) {
  return Object.assign({
    name,
    type: '',
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

describe('GoogleDocsImporter', () => {
  it('imports a selected exported HTML file without OAuth', async () => {
    const importer = loadImporter();
    const { dao, writes } = captureDao();
    const result = await importer.importFile({
      file: exportFile('rich-doc.html', fixture('rich-doc.html'), { webkitRelativePath: 'Takeout/Docs/rich-doc.html' }),
      dao,
      importedAt: '2026-06-18T11:00:00.000Z'
    });

    expect(result.chat).toMatchObject({
      platform: 'google-docs',
      title: 'Docs rich export fixture',
      messageCount: result.messages.length
    });
    expect(result.chat.chatId).toMatch(/^google-docs:file:/);
    expect(result.chat.url).toBe('https://docs.google.com/document/d/doc-rich/edit');
    expect(result.chat.metadata.import.importedAt).toBe('2026-06-18T11:00:00.000Z');
    expect(result.chat.metadata.import.packageHash).toBe(result.run.metadata.packageHash);
    expect(result.chat.metadata.import.source).toMatchObject({
      kind: 'file',
      path: 'Takeout/Docs/rich-doc.html',
      name: 'rich-doc.html',
      url: 'https://docs.google.com/document/d/doc-rich/edit'
    });
    expect(result.chat.metadata.provenance).toMatchObject({
      filePath: 'Takeout/Docs/rich-doc.html',
      fileName: 'rich-doc.html',
      exportedFormat: 'html',
      documentTitle: 'Docs rich export fixture',
      sourceUrl: 'https://docs.google.com/document/d/doc-rich/edit'
    });
    expect(result.messages[0].metadata.import).toMatchObject({
      packageHash: result.chat.metadata.import.packageHash,
      importedAt: '2026-06-18T11:00:00.000Z'
    });
    expect(result.messages[0].metadata.provenance).toMatchObject({
      filePath: 'Takeout/Docs/rich-doc.html',
      fileName: 'rich-doc.html',
      exportedFormat: 'html',
      documentTitle: 'Docs rich export fixture',
      sourceUrl: 'https://docs.google.com/document/d/doc-rich/edit',
      nodePath: 'html:h1:0'
    });
    expect(result.messages.map((message) => message.content)).toEqual(expect.arrayContaining([
      'TODO: review launch copy',
      'Chrome listing',
      'Store | Status\nChrome | Draft\nFirefox | Ready',
      'Image placeholder: [image: architecture diagram]',
      'Comment: tighten privacy copy.'
    ]));
    expect(result.openThreads).toHaveLength(1);
    expect(result.openThreads[0]).toMatchObject({ tag: 'TODO', text: 'review launch copy' });
    expect(writes.chats).toHaveLength(1);
    expect(writes.messages).toHaveLength(result.messages.length);
    expect(writes.threads).toHaveLength(1);
    expect(writes.runs).toHaveLength(1);
  });

  it('imports multiple local files and keeps folder paths', async () => {
    const importer = loadImporter();
    const result = await importer.importFiles({
      files: [
        exportFile('empty-doc.html', fixture('empty-doc.html'), { webkitRelativePath: 'Folder/empty-doc.html' }),
        exportFile('plain.txt', fixture('plain.txt'), { webkitRelativePath: 'Folder/plain.txt' })
      ],
      importedAt: '2026-06-18T11:05:00.000Z'
    });

    expect(result.chats).toHaveLength(2);
    expect(result.chats[0].metadata.provenance).toMatchObject({
      filePath: 'Folder/empty-doc.html',
      exportedFormat: 'html'
    });
    expect(result.messages.map((message) => message.content)).toEqual([
      'Plain Docs export fixture',
      'TODO: parse plain text fallback',
      'This fallback loses headings, tables, comments, and links, but preserves readable text.'
    ]);
  });

  it('runs the deterministic scanner before persisting imported rows', async () => {
    const importer = loadImporter();
    const events = [];
    const scanner = {
      scanMessage(message) {
        events.push('scan:' + message.content);
        if (message.content.indexOf('TODO:') !== 0) return [];
        return [{
          threadId: 'scan:' + message.messageId,
          chatId: message.chatId,
          messageId: message.messageId,
          tag: 'TODO',
          text: message.content.replace(/^TODO:\s*/, ''),
          source: 'explicit',
          subSource: 'scan',
          status: 'open',
          createdAt: message.timestamp
        }];
      }
    };
    const dao = {
      putChat: async () => events.push('putChat'),
      putMessages: async () => events.push('putMessages'),
      putOpenThreads: async () => events.push('putOpenThreads'),
      putExtractionRun: async () => events.push('putExtractionRun')
    };

    const result = await importer.importFile({
      file: exportFile('rich-doc.html', fixture('rich-doc.html')),
      scanner,
      dao,
      importedAt: '2026-06-18T11:08:00.000Z'
    });

    expect(result.openThreads).toHaveLength(1);
    expect(events[0]).toMatch(/^scan:/);
    expect(events.indexOf('putOpenThreads')).toBeGreaterThan(events.findIndex((event) => event.indexOf('scan:TODO:') === 0));
    expect(events).not.toContain('runExtraction');
  });

  it('parses DOCX document XML fallback files', async () => {
    const importer = loadImporter();
    const result = await importer.importFile({
      file: exportFile('docx-document.xml', fixture('docx-document.xml')),
      importedAt: '2026-06-18T11:10:00.000Z'
    });

    expect(result.messages.map((message) => message.content)).toEqual(expect.arrayContaining([
      'DOCX project brief',
      'TODO: parse DOCX fallback',
      'Store | Status\nChrome | Draft',
      '[image]',
      '[footnote reference 1]'
    ]));
    expect(result.run.metadata.itemCounts).toMatchObject({ warnings: 1, errors: 0 });
  });

  it('rejects unsupported local files', async () => {
    const importer = loadImporter();

    await expect(importer.importFile({
      file: exportFile('slides.pdf', '%PDF-1.7')
    })).rejects.toThrow('Unsupported Google Docs export format');
  });

  it('records malformed DOCX XML as a failed import run', async () => {
    const importer = loadImporter();
    const runs = [];

    await expect(importer.importFile({
      file: exportFile('bad.xml', '<w:document><w:body>'),
      dao: { putExtractionRun: async (run) => runs.push(run) },
      importedAt: '2026-06-18T11:15:00.000Z'
    })).rejects.toThrow('Malformed DOCX document XML');

    expect(runs).toHaveLength(1);
    expect(runs[0].metadata.status).toBe('error');
    expect(runs[0].metadata.errors[0]).toMatchObject({ code: 'GOOGLE_DOCS_IMPORT_ERROR', sourceRef: 'bad.xml' });
  });

  it('handles large plain text imports with stable progress counts', async () => {
    const importer = loadImporter();
    const body = Array.from({ length: 750 }, (_, index) => 'Line ' + String(index)).join('\n');
    const result = await importer.importFile({
      file: exportFile('long.txt', body),
      importedAt: '2026-06-18T11:20:00.000Z'
    });

    expect(result.messages).toHaveLength(750);
    expect(result.run.metadata.itemCounts).toMatchObject({ parsed: 750, imported: 750, skipped: 0, errors: 0 });
  });

  it('supports source dedupe decisions for imported Docs files', async () => {
    const { importer, dedupe } = loadBundle();
    const result = await importer.importFile({
      file: exportFile('plain.txt', fixture('plain.txt'), { webkitRelativePath: 'Takeout/Docs/plain.txt' }),
      importedAt: '2026-06-18T11:25:00.000Z'
    });

    expect(dedupe.decide([result.chat], {
      adapterId: 'google-docs',
      sourceKind: 'file',
      sourcePath: 'Takeout/Docs/plain.txt',
      sourceName: 'plain.txt',
      packageHash: result.chat.metadata.import.packageHash
    }).action).toBe('skip');
    expect(dedupe.decide([result.chat], {
      adapterId: 'google-docs',
      sourceKind: 'file',
      sourcePath: 'Takeout/Docs/plain.txt',
      sourceName: 'plain.txt',
      packageHash: 'changed'
    }).action).toBe('update');
  });

  it('records cancellation with a recoverable partial run', async () => {
    const importer = loadImporter();
    const controller = new AbortController();
    const body = Array.from({ length: 50 }, (_, index) => 'Line ' + String(index)).join('\n');
    const result = await importer.importFile({
      file: exportFile('cancel.txt', body),
      signal: controller.signal,
      importedAt: '2026-06-18T11:30:00.000Z',
      onProgress: (event) => {
        if (event.itemCounts.parsed === 10) controller.abort();
      }
    });

    expect(result.cancelled).toBe(true);
    expect(result.messages).toEqual([]);
    expect(result.run.metadata.status).toBe('cancelled');
    expect(result.run.metadata.partial.recoverable).toBe(true);
    expect(result.run.metadata.itemCounts.imported).toBeLessThan(50);
  });
});
