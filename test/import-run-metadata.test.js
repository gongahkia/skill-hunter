import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadMetadata() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('imports/run-metadata.js'));
  fn(module, module.exports);
  return module.exports;
}

describe('ImportRunMetadata', () => {
  it('creates extractionRuns-compatible import metadata rows', () => {
    const metadata = loadMetadata();
    const run = metadata.createRun({
      adapterId: 'google-docs',
      adapterVersion: 'v1',
      chatId: 'google-docs:file:doc-1',
      source: {
        kind: 'file',
        objectId: 'doc-1',
        path: 'Takeout/Drive/doc.html',
        url: 'https://docs.google.com/document/d/doc-1'
      },
      packageHash: 'sha256:abc123',
      importedAt: '2026-06-18T01:00:00.000Z',
      completedAt: '2026-06-18T01:00:05.000Z',
      durationMs: 5000,
      threadCount: 3,
      itemCounts: { parsed: 10, imported: 8, skipped: 1, updated: 1 },
      warnings: [{ code: 'UNSUPPORTED_IMAGE', message: 'Skipped image', sourceRef: 'img-1' }],
      errors: [{ code: 'MALFORMED_BLOCK', message: 'Skipped malformed block', sourceRef: 'block-9', recoverable: true }]
    });

    expect(run).toMatchObject({
      chatId: 'google-docs:file:doc-1',
      modelName: 'import',
      modelVersion: 'google-docs:v1',
      completedAt: '2026-06-18T01:00:05.000Z',
      threadCount: 3,
      durationMs: 5000
    });
    expect(run.runId).toMatch(/^import:google-docs:doc-1:/);
    expect(run.metadata).toMatchObject({
      adapterId: 'google-docs',
      adapterVersion: 'v1',
      packageHash: 'sha256:abc123',
      importedAt: '2026-06-18T01:00:00.000Z',
      source: {
        kind: 'file',
        object: 'doc-1',
        path: 'Takeout/Drive/doc.html',
        url: 'https://docs.google.com/document/d/doc-1'
      },
      itemCounts: {
        parsed: 10,
        imported: 8,
        skipped: 1,
        updated: 1,
        warnings: 1,
        errors: 1
      },
      status: 'error'
    });
    expect(run.metadata.warnings[0]).toEqual({
      code: 'UNSUPPORTED_IMAGE',
      message: 'Skipped image',
      sourceRef: 'img-1',
      recoverable: true
    });
    expect(run.metadata.errors[0]).toEqual({
      code: 'MALFORMED_BLOCK',
      message: 'Skipped malformed block',
      sourceRef: 'block-9',
      recoverable: true
    });
  });

  it('normalizes terse issue values and validates adapter identity', () => {
    const metadata = loadMetadata();

    expect(() => metadata.createRun({ sourcePath: 'archive.zip' })).toThrow('adapterId is required');

    const run = metadata.createRun({
      adapterId: 'keep',
      sourcePath: 'Takeout/Keep',
      warnings: ['Missing note color'],
      errors: ['Unreadable attachment']
    });

    expect(run.metadata.source).toEqual({ path: 'Takeout/Keep' });
    expect(run.metadata.warnings).toEqual([
      { code: 'IMPORT_WARNING', message: 'Missing note color', sourceRef: '', recoverable: true }
    ]);
    expect(run.metadata.errors).toEqual([
      { code: 'IMPORT_ERROR', message: 'Unreadable attachment', sourceRef: '', recoverable: false }
    ]);
    expect(run.metadata.itemCounts.warnings).toBe(1);
    expect(run.metadata.itemCounts.errors).toBe(1);
  });

  it('creates reusable snapshot metadata for imported chats and messages', () => {
    const metadata = loadMetadata();
    const row = metadata.createSnapshotMetadata({
      adapterId: 'notion',
      adapterVersion: 'v1',
      runId: 'import:notion:page-1:abc',
      sourceObjectId: 'page-1',
      packageHash: 'sha256:def456',
      importedAt: '2026-06-18T02:00:00.000Z',
      durationMs: 40,
      provenance: { blockId: 'block-1', url: 'https://notion.so/page-1' },
      warnings: ['Unsupported embed']
    });

    expect(row).toEqual({
      adapter: { id: 'notion', version: 'v1' },
      import: {
        runId: 'import:notion:page-1:abc',
        source: { object: 'page-1' },
        packageHash: 'sha256:def456',
        importedAt: '2026-06-18T02:00:00.000Z',
        itemCounts: { parsed: 0, imported: 0, skipped: 0, updated: 0, warnings: 1, errors: 0 },
        durationMs: 40,
        warningCount: 1,
        errorCount: 0
      },
      provenance: { blockId: 'block-1', url: 'https://notion.so/page-1' }
    });
  });
});
