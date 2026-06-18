import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadPolicy() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('imports/keep-policy.js'));
  fn(module, module.exports);
  return module.exports;
}

describe('Keep live source policy', () => {
  it('rejects Keep URLs and browser/API source hints with Takeout copy', () => {
    const policy = loadPolicy();

    expect(policy.rejectUnsupportedSource('https://keep.google.com/u/0/#NOTE/test')).toMatchObject({
      code: 'KEEP_UNSUPPORTED_LIVE_SOURCE',
      adapterId: 'keep',
      recoverable: true
    });
    expect(policy.rejectUnsupportedSource({ url: 'https://keep.google.com/' }).message).toContain('Google Takeout');
    expect(policy.rejectUnsupportedSource({ kind: 'keep-api' }).message).toContain('Keep URLs and browser pages are not accepted');
    expect(policy.rejectUnsupportedSource({ path: 'Takeout/Keep/note.json' })).toBeNull();
  });

  it('does not ship Keep live auth, host permissions, or scraping UI', () => {
    const manifest = JSON.parse(loadSrc('manifest.json'));
    const optionsHtml = loadSrc('options.html');
    const optionsJs = loadSrc('options.js');
    const haystack = [optionsHtml, optionsJs].join('\n');

    expect(manifest.permissions).not.toContain('identity');
    expect(manifest.host_permissions || []).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/keep\.google\.com|googleapis\.com\/.*keep/i)
    ]));
    expect(haystack).not.toMatch(/Keep API|OAuth|scrape|browser session|keep\.google\.com/i);
    expect(optionsHtml).toContain('Google Takeout exports');
    expect(optionsHtml).toContain('Keep URLs and browser pages are not accepted');
  });

  it('defines Keep attachment behavior without embedding binary payloads', () => {
    const policy = loadPolicy();
    const available = ['Takeout/Keep/note-assets/photo.png', 'Takeout/Keep/audio.m4a', 'Takeout/Keep/drawing.svg'];

    expect(policy.classifyAttachment({
      path: 'Takeout/Keep/note-assets/photo.png',
      mimeType: 'image/png'
    }, { availablePaths: available })).toMatchObject({
      kind: 'image',
      action: 'link',
      placeholder: '[image: Takeout/Keep/note-assets/photo.png]',
      provenance: { linked: true, path: 'Takeout/Keep/note-assets/photo.png', mimeType: 'image/png' },
      warning: null
    });
    expect(policy.classifyAttachment({
      filename: 'audio.m4a',
      contentType: 'audio/mp4'
    }, { availablePaths: available })).toMatchObject({
      kind: 'audio',
      action: 'link',
      placeholder: '[audio: audio.m4a]',
      provenance: { linked: true }
    });
    expect(policy.classifyAttachment({
      filename: 'drawing.svg',
      type: 'drawing'
    }, { availablePaths: available })).toMatchObject({
      kind: 'drawing',
      action: 'link',
      placeholder: '[drawing: drawing.svg]',
      provenance: { linked: true }
    });
  });

  it('emits visible recoverable warnings for missing and unsupported Keep attachments', () => {
    const policy = loadPolicy();

    expect(policy.classifyAttachment({
      filename: 'missing.png',
      mimeType: 'image/png'
    }, { availablePaths: [] })).toMatchObject({
      kind: 'image',
      action: 'placeholder',
      placeholder: '[image: missing.png]',
      provenance: { linked: false },
      warning: {
        code: 'KEEP_ATTACHMENT_MISSING',
        recoverable: true
      }
    });
    expect(policy.classifyAttachment({
      filename: 'archive.bin',
      mimeType: 'application/octet-stream'
    }, { availablePaths: ['archive.bin'] })).toMatchObject({
      kind: 'unsupported',
      action: 'placeholder',
      placeholder: '[attachment: archive.bin]',
      provenance: { linked: false },
      warning: {
        code: 'KEEP_ATTACHMENT_UNSUPPORTED',
        recoverable: true
      }
    });
  });
});
