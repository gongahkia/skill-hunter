import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadSession() {
  const module = { exports: {} };
  const code = [
    loadSrc('imports/run-metadata.js'),
    loadSrc('imports/session.js')
  ].join('\n');
  const fn = new Function('module', 'exports', code);
  fn(module, module.exports);
  return module.exports;
}

describe('ImportSession', () => {
  it('tracks progress counts and creates a completed import run', () => {
    const ImportSession = loadSession();
    const events = [];
    const session = ImportSession.create({
      adapterId: 'slack',
      adapterVersion: 'v1',
      sourcePath: 'slack-export.zip',
      packageHash: 'sha256:slack',
      importedAt: '2026-06-18T03:00:00.000Z',
      completedAt: '2026-06-18T03:00:10.000Z',
      durationMs: 10000,
      onProgress: (event) => events.push(event)
    });

    session.setPhase('reading');
    session.setTotal(4);
    session.recordParsed(2);
    session.recordImported();
    session.recordUpdated();
    session.addWarning({ code: 'MISSING_USER', message: 'User map entry missing', sourceRef: 'U1' });
    session.completeSnapshot('slack:channel:general');

    const run = session.finish();

    expect(events.map((event) => event.status)).toContain('progress');
    expect(events.map((event) => event.status)).toContain('warning');
    expect(events[events.length - 1]).toMatchObject({ status: 'done', runId: run.runId });
    expect(run.metadata).toMatchObject({
      status: 'done',
      source: { path: 'slack-export.zip' },
      packageHash: 'sha256:slack',
      importedAt: '2026-06-18T03:00:00.000Z',
      durationMs: 10000,
      itemCounts: {
        parsed: 2,
        imported: 1,
        skipped: 0,
        updated: 1,
        warnings: 1,
        errors: 0
      },
      partial: {
        recoverable: true,
        completedSnapshotIds: ['slack:channel:general'],
        skippedSourceIds: []
      }
    });
  });

  it('throws on cancellation and leaves a recoverable partial run', () => {
    const ImportSession = loadSession();
    const controller = new AbortController();
    const events = [];
    const session = ImportSession.create({
      adapterId: 'email',
      adapterVersion: 'v1',
      sourcePath: 'mail.mbox',
      signal: controller.signal,
      importedAt: '2026-06-18T04:00:00.000Z',
      completedAt: '2026-06-18T04:00:02.000Z',
      durationMs: 2000,
      onProgress: (event) => events.push(event)
    });

    session.recordParsed(5);
    session.recordImported(3);
    session.completeSnapshot('email:thread:1');
    session.skipSource('message-4');
    controller.abort();

    expect(() => session.throwIfCancelled()).toThrow('Import cancelled');

    const run = session.finish();
    expect(run.metadata.status).toBe('cancelled');
    expect(run.metadata.partial).toEqual({
      recoverable: true,
      completedSnapshotIds: ['email:thread:1'],
      skippedSourceIds: ['message-4']
    });
    expect(events[events.length - 1]).toMatchObject({ status: 'cancelled', cancelled: true });
  });

  it('records structured recoverable errors', () => {
    const ImportSession = loadSession();
    const session = ImportSession.create({
      adapterId: 'discord',
      adapterVersion: 'v1',
      sourcePath: 'discord.zip',
      importedAt: '2026-06-18T05:00:00.000Z',
      completedAt: '2026-06-18T05:00:01.000Z',
      durationMs: 1000
    });

    session.recordParsed();
    session.recordSkipped();
    session.skipSource('messages/bad.json');
    session.addError({
      code: 'BAD_JSON',
      message: 'Skipped malformed JSON entry',
      sourceRef: 'messages/bad.json',
      recoverable: true
    });

    const run = session.finish();
    expect(run.metadata.status).toBe('error');
    expect(run.metadata.itemCounts).toMatchObject({ parsed: 1, skipped: 1, errors: 1 });
    expect(run.metadata.errors).toEqual([
      {
        code: 'BAD_JSON',
        message: 'Skipped malformed JSON entry',
        sourceRef: 'messages/bad.json',
        recoverable: true
      }
    ]);
    expect(run.metadata.partial.skippedSourceIds).toEqual(['messages/bad.json']);
  });
});
