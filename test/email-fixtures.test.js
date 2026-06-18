import { describe, expect, it } from 'vitest';
import { loadFixture } from './helpers.js';

function fixture(path) {
  return loadFixture('fixtures/imports/email/' + path);
}

function messageCount(mbox) {
  return (mbox.match(/^From /gm) || []).length;
}

describe('Email MBOX fixtures', () => {
  it('record required fixture coverage', () => {
    const manifest = JSON.parse(fixture('manifest.json'));

    expect(manifest.coverage).toEqual(expect.arrayContaining([
      'plain-text',
      'html',
      'multipart',
      'attachments',
      'gmail-labels',
      'forwarded-thread',
      'replied-thread',
      'duplicate-message-id',
      'malformed-headers',
      'large-mailbox',
      'from-body-escaping'
    ]));
  });

  it('cover plain text, Gmail labels, replies, HTML, and From-line escaping', () => {
    const mbox = fixture('mixed.mbox');

    expect(messageCount(mbox)).toBe(4);
    expect(mbox).toContain('X-Gmail-Labels: Inbox,Important,Project/Launch');
    expect(mbox).toContain('In-Reply-To: <plain-1@example.test>');
    expect(mbox).toContain('References: <plain-1@example.test>');
    expect(mbox).toContain('Content-Type: multipart/alternative; boundary="alt-boundary"');
    expect(mbox).toContain('<script>alert("x")</script>');
    expect(mbox).toContain('>From escaped body line should stay body text.');
  });

  it('cover attachments, forwarded messages, and duplicate Message-IDs', () => {
    const mbox = fixture('mixed.mbox');

    expect(mbox).toContain('Subject: Fwd: Launch attachment');
    expect(mbox).toContain('Content-Disposition: attachment; filename="launch.pdf"');
    expect(mbox.match(/Message-ID: <plain-1@example\.test>/g)).toHaveLength(2);
  });

  it('cover malformed headers and large mailbox parsing surfaces', () => {
    const malformed = fixture('malformed.mbox');
    const large = fixture('large.mbox');

    expect(malformed).toContain('Message-ID <missing-colon@example.test>');
    expect(malformed).toContain('Date: not-a-date');
    expect(messageCount(large)).toBe(12);
    expect(large).toContain('Message-ID: <large-012@example.test>');
  });
});
