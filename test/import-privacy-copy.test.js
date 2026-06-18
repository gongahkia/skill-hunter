import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadCopy() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('imports/privacy-copy.js'));
  fn(module, module.exports);
  return module.exports;
}

describe('ImportPrivacyCopy', () => {
  it('returns default local-first warnings', () => {
    const copy = loadCopy();

    expect(copy.forAdapter('unknown')).toEqual({
      archiveWarning: "Imported archives can contain other people's messages and sensitive account data.",
      localOnly: 'Imported content stays local unless you export, back up, or sync the vault.',
      tokenWarning: 'Do not store OAuth tokens or API keys in vault exports.',
      reviewWarning: 'Review source files before importing shared workspaces, mailboxes, or chat exports.'
    });
  });

  it('returns adapter-specific archive warnings without mutating defaults', () => {
    const copy = loadCopy();
    const slack = copy.forAdapter('Slack');

    expect(slack.archiveWarning).toContain("other people's messages");
    expect(slack.archiveWarning).toContain('file references');
    expect(slack.localOnly).toBe(copy.defaults.localOnly);
    slack.localOnly = 'changed';
    expect(copy.forAdapter('slack').localOnly).toBe(copy.defaults.localOnly);
  });

  it('returns render-ready warning arrays', () => {
    const copy = loadCopy();

    expect(copy.warnings('email')).toEqual([
      'Imported email can include senders, recipients, private threads, labels, headers, and attachments.',
      'Imported content stays local unless you export, back up, or sync the vault.',
      'Do not store OAuth tokens or API keys in vault exports.',
      'Review source files before importing shared workspaces, mailboxes, or chat exports.'
    ]);
  });
});
