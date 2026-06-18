import { describe, expect, it } from 'vitest';
import { loadFixture } from './helpers.js';

function fixture(path) {
  return loadFixture('fixtures/imports/discord/' + path);
}

function json(path) {
  return JSON.parse(fixture(path));
}

describe('Discord import fixtures', () => {
  it('cover package metadata and channel index entries', () => {
    const manifest = json('manifest.json');
    const pkg = json('package.json');
    const index = json('messages/index.json');

    expect(manifest.coverage).toEqual(expect.arrayContaining(['dm', 'group-dm', 'server-channel', 'package-metadata']));
    expect(pkg.account).toMatchObject({ id: '9001', username: 'fixture_user' });
    expect(index.channels.map((channel) => channel.type)).toEqual(['dm', 'group_dm', 'guild_text']);
    expect(index.channels.find((channel) => channel.id === '300')).toMatchObject({ guild_id: '700', name: 'release' });
  });

  it('cover DM, group DM, server messages, attachments, and deleted users', () => {
    const dm = json('messages/c100/messages.json');
    const group = json('messages/c200/messages.json');
    const server = json('messages/c300/messages.json');

    expect(json('messages/c100/channel.json')).toMatchObject({ id: '100', type: 'dm' });
    expect(json('messages/c200/channel.json')).toMatchObject({ id: '200', type: 'group_dm', name: 'Launch Group' });
    expect(json('messages/c300/channel.json')).toMatchObject({ id: '300', type: 'guild_text', guild_id: '700' });
    expect(dm[0]).toMatchObject({ id: 'm100-1', content: 'TODO: send DM summary' });
    expect(group[0].attachments[0]).toMatchObject({
      filename: 'plan.png',
      url: 'https://cdn.discordapp.com/attachments/200/att-1/plan.png'
    });
    expect(server[0]).toMatchObject({
      id: 'm300-1',
      content: 'REF: deleted user context',
      author: { id: '9004', username: 'Deleted User', deleted: true }
    });
  });

  it('cover current and recent server metadata', () => {
    expect(json('servers/current.json')[0]).toMatchObject({ id: '700', name: 'Current Fixture Server' });
    expect(json('servers/recent.json')[0]).toMatchObject({ id: '701', name: 'Recent Fixture Server' });
  });

  it('include malformed JSON for parser failure coverage', () => {
    expect(() => JSON.parse(fixture('malformed/messages.json'))).toThrow();
  });
});
