import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadDedupe() {
  const module = { exports: {} };
  const code = [
    loadSrc('imports/run-metadata.js'),
    loadSrc('imports/dedupe.js')
  ].join('\n');
  const fn = new Function('module', 'exports', code);
  fn(module, module.exports);
  return module.exports;
}

describe('ImportDedupe', () => {
  it('skips re-imports with the same source identity and content hash', () => {
    const dedupe = loadDedupe();
    const existing = [{
      platform: 'google-docs',
      metadata: {
        import: {
          source: { kind: 'file', object: 'doc-1', path: 'Takeout/doc.html' },
          packageHash: 'sha256:one'
        }
      }
    }];

    expect(dedupe.decide(existing, {
      adapterId: 'google-docs',
      sourceKind: 'file',
      sourceObjectId: 'doc-1',
      sourcePath: 'Takeout/doc.html',
      packageHash: 'sha256:one'
    })).toMatchObject({
      action: 'skip',
      contentHash: 'sha256:one'
    });
  });

  it('updates re-imports with the same source identity and changed content hash', () => {
    const dedupe = loadDedupe();
    const existing = [{
      platform: 'notion',
      metadata: {
        provenance: { sourceKind: 'page', sourceObject: 'page-1', sourceUrl: 'https://notion.so/page-1' },
        import: { packageHash: 'sha256:old' }
      }
    }];

    const decision = dedupe.decide(existing, {
      adapterId: 'notion',
      sourceKind: 'page',
      sourceObjectId: 'page-1',
      sourceUrl: 'https://notion.so/page-1',
      packageHash: 'sha256:new'
    });

    expect(decision.action).toBe('update');
    expect(decision.existing).toBe(existing[0]);
    expect(decision.contentHash).toBe('sha256:new');
  });

  it('creates rows when no matching source identity exists', () => {
    const dedupe = loadDedupe();

    expect(dedupe.decide([], {
      adapterId: 'keep',
      sourcePath: 'Takeout/Keep/note.json',
      packageHash: 'sha256:note'
    })).toMatchObject({
      action: 'create',
      contentHash: 'sha256:note'
    });
  });

  it('requires adapter and source identity', () => {
    const dedupe = loadDedupe();

    expect(() => dedupe.sourceKey({ sourcePath: 'x' })).toThrow('adapterId is required');
    expect(() => dedupe.sourceKey({ adapterId: 'email' })).toThrow('source identity is required');
  });
});
