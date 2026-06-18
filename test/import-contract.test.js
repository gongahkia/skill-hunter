import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadImportModules() {
  const module = { exports: {} };
  const code = [
    loadSrc('imports/run-metadata.js'),
    loadSrc('imports/session.js'),
    loadSrc('imports/normalizer.js'),
    loadSrc('imports/dedupe.js'),
    loadSrc('threads/scanner.js')
  ].join('\n');
  const fn = new Function('module', 'exports', code + '\nreturn { ImportSession: ImportSession, ImportNormalizer: ImportNormalizer, ImportDedupe: ImportDedupe, ThreadScanner: ThreadScanner };');
  return fn(module, module.exports);
}

function parseSyntheticImport(modules, blocks, options = {}) {
  const session = modules.ImportSession.create({
    adapterId: 'synthetic',
    adapterVersion: 'v1',
    sourceKind: 'fixture',
    sourceObjectId: options.sourceObjectId || 'fixture-1',
    sourcePath: options.sourcePath || 'fixtures/synthetic.json',
    packageHash: options.packageHash || 'sha256:fixture',
    importedAt: '2026-06-18T06:00:00.000Z',
    completedAt: options.completedAt || '2026-06-18T06:00:01.000Z',
    durationMs: options.durationMs || 1000,
    signal: options.signal,
    total: blocks.length
  });
  const chatId = 'synthetic:fixture:' + (options.sourceObjectId || 'fixture-1');
  const messages = [];

  try {
    blocks.forEach((block, index) => {
      if (typeof options.onBlock === 'function') options.onBlock(block, index, session);
      session.throwIfCancelled();
      session.recordParsed();
      if (!block || typeof block.text !== 'string') {
        const ref = block && block.id ? block.id : 'index-' + String(index);
        session.recordSkipped();
        session.skipSource(ref);
        session.addError({ code: 'MALFORMED_BLOCK', message: 'Skipped malformed block', sourceRef: ref, recoverable: true });
        return;
      }
      messages.push(modules.ImportNormalizer.createMessage({
        adapterId: 'synthetic',
        adapterVersion: 'v1',
        chatId,
        messageId: chatId + ':block-' + String(index),
        role: 'document',
        content: block.text,
        index,
        sourceKind: 'block',
        sourceObjectId: block.id,
        sourcePath: options.sourcePath || 'fixtures/synthetic.json',
        sourceUrl: block.url,
        importedAt: '2026-06-18T06:00:00.000Z',
        runId: 'import:synthetic:fixture-1:test',
        provenance: { blockType: block.type || 'paragraph' }
      }));
      session.recordImported();
      session.completeSnapshot(chatId);
    });
  } catch (error) {
    if (error.name !== 'AbortError') throw error;
  }

  const chat = modules.ImportNormalizer.createChat({
    adapterId: 'synthetic',
    adapterVersion: 'v1',
    chatId,
    title: 'Synthetic fixture',
    sourceKind: 'fixture',
    sourceObjectId: options.sourceObjectId || 'fixture-1',
    sourcePath: options.sourcePath || 'fixtures/synthetic.json',
    packageHash: options.packageHash || 'sha256:fixture',
    importedAt: '2026-06-18T06:00:00.000Z',
    runId: 'import:synthetic:fixture-1:test',
    messageCount: messages.length
  });
  const threads = messages.flatMap((message) => modules.ThreadScanner.scanMessage(message));
  const run = session.finish();
  return { chat, messages, threads, run };
}

describe('import contract coverage', () => {
  it('parses fixture blocks with provenance and scanner output', () => {
    const modules = loadImportModules();
    const result = parseSyntheticImport(modules, [
      { id: 'b1', type: 'heading', text: 'Launch' },
      { id: 'b2', type: 'paragraph', text: 'TODO: publish store checklist', url: 'https://example.test/doc#b2' }
    ]);

    expect(result.chat.messageCount).toBe(2);
    expect(result.messages[1].metadata.provenance).toMatchObject({
      sourceKind: 'block',
      sourceId: 'b2',
      sourceObject: 'b2',
      sourcePath: 'fixtures/synthetic.json',
      sourceUrl: 'https://example.test/doc#b2',
      blockType: 'paragraph'
    });
    expect(result.threads).toHaveLength(1);
    expect(result.threads[0]).toMatchObject({
      chatId: 'synthetic:fixture:fixture-1',
      messageId: 'synthetic:fixture:fixture-1:block-1',
      tag: 'TODO',
      text: 'publish store checklist',
      source: 'explicit',
      subSource: 'scan'
    });
  });

  it('covers source dedupe skip and update decisions', () => {
    const modules = loadImportModules();
    const first = parseSyntheticImport(modules, [{ id: 'b1', text: 'First import' }], { packageHash: 'sha256:one' });

    expect(modules.ImportDedupe.decide([first.chat], {
      adapterId: 'synthetic',
      sourceKind: 'fixture',
      sourceObjectId: 'fixture-1',
      packageHash: 'sha256:one'
    }).action).toBe('skip');
    expect(modules.ImportDedupe.decide([first.chat], {
      adapterId: 'synthetic',
      sourceKind: 'fixture',
      sourceObjectId: 'fixture-1',
      packageHash: 'sha256:two'
    }).action).toBe('update');
  });

  it('records malformed input as recoverable errors', () => {
    const modules = loadImportModules();
    const result = parseSyntheticImport(modules, [
      { id: 'ok', text: 'Valid block' },
      { id: 'bad' },
      null
    ]);

    expect(result.messages).toHaveLength(1);
    expect(result.run.metadata.status).toBe('error');
    expect(result.run.metadata.itemCounts).toMatchObject({ parsed: 3, imported: 1, skipped: 2, errors: 2 });
    expect(result.run.metadata.partial.skippedSourceIds).toEqual(['bad', 'index-2']);
  });

  it('handles large synthetic imports with stable counts', () => {
    const modules = loadImportModules();
    const blocks = Array.from({ length: 750 }, (_, index) => ({ id: 'b' + String(index), text: 'Block ' + String(index) }));
    const result = parseSyntheticImport(modules, blocks, { durationMs: 5000 });

    expect(result.messages).toHaveLength(750);
    expect(result.run.metadata.itemCounts).toMatchObject({ parsed: 750, imported: 750, skipped: 0, errors: 0 });
    expect(result.run.durationMs).toBe(5000);
  });

  it('records cancellation as recoverable partial import state', () => {
    const modules = loadImportModules();
    const controller = new AbortController();
    const blocks = Array.from({ length: 20 }, (_, index) => ({ id: 'b' + String(index), text: 'Block ' + String(index) }));
    const result = parseSyntheticImport(modules, blocks, {
      signal: controller.signal,
      onBlock: (_block, index) => {
        if (index === 8) controller.abort();
      }
    });

    expect(result.run.metadata.status).toBe('cancelled');
    expect(result.run.metadata.partial.recoverable).toBe(true);
    expect(result.run.metadata.itemCounts.imported).toBeLessThan(20);
  });
});
