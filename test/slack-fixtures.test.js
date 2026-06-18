import { describe, expect, it } from 'vitest';
import { loadFixture } from './helpers.js';

function fixture(path) {
  return loadFixture('fixtures/imports/slack/' + path);
}

function json(path) {
  return JSON.parse(fixture(path));
}

describe('Slack import fixtures', () => {
  it('cover public channel export metadata and user maps', () => {
    const manifest = json('manifest.json');
    const channels = json('channels.json');
    const users = json('users.json');

    expect(manifest.exportScope).toBe('public_channels_only');
    expect(manifest.coverage).toEqual(expect.arrayContaining(['public-channel', 'user-map', 'missing-private-channel-data', 'missing-dm-data']));
    expect(manifest.missing).toEqual(expect.arrayContaining(['groups.json', 'dms.json', 'mpims.json']));
    expect(channels[0]).toMatchObject({ id: 'C123', name: 'general', is_channel: true });
    expect(users.map((user) => user.id)).toEqual(['U123', 'U456', 'B999']);
    expect(users.find((user) => user.id === 'B999')).toMatchObject({ is_bot: true });
  });

  it('cover messages, threads, reactions, and file links', () => {
    const messages = json('general/2026-06-18.json');

    expect(messages).toHaveLength(4);
    expect(messages[0]).toMatchObject({
      type: 'message',
      user: 'U123',
      text: 'TODO: publish launch checklist',
      ts: '1781740800.000100'
    });
    expect(messages[0].reactions[0]).toMatchObject({ name: 'eyes', count: 2, users: ['U123', 'U456'] });
    expect(messages[1]).toMatchObject({ thread_ts: '1781740860.000200', reply_count: 1 });
    expect(messages[2]).toMatchObject({ thread_ts: '1781740860.000200', parent_user_id: 'U456' });
    expect(messages[3]).toMatchObject({ subtype: 'file_share', user: 'B999' });
    expect(messages[3].files[0]).toMatchObject({
      id: 'F123',
      name: 'launch.pdf',
      permalink: 'https://fixture.slack.com/files/U123/F123/launch.pdf'
    });
  });

  it('include malformed JSON for parser failure coverage', () => {
    expect(() => JSON.parse(fixture('malformed/2026-06-18.json'))).toThrow();
  });
});
