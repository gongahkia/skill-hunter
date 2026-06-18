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
});
