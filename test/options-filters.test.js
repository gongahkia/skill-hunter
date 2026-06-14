import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadFilters() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('options/filters.js'));
  fn(module, module.exports);
  return module.exports;
}

function chats() {
  return [
    {
      chatId: 'chat-1',
      platform: 'chatgpt',
      title: 'Pinned tagged',
      lastUpdatedAt: '2026-06-14T06:00:00.000Z',
      tags: ['TODO', 'REF'],
      pinned: true
    },
    {
      chatId: 'chat-2',
      platform: 'claude',
      title: 'Older tagged',
      lastUpdatedAt: '2026-06-01T06:00:00.000Z',
      tags: ['TODO'],
      pinned: false
    },
    {
      chatId: 'chat-3',
      platform: 'gemini',
      title: 'Fresh untagged',
      lastUpdatedAt: '2026-06-14T07:00:00.000Z',
      tags: [],
      pinned: false
    }
  ];
}

describe('OptionsFilters', () => {
  it('combines platform, tag, and pinned filters', () => {
    const OptionsFilters = loadFilters();
    const result = OptionsFilters.apply(chats(), {
      platforms: ['chatgpt', 'claude'],
      tags: ['TODO'],
      pinnedOnly: true,
      datePreset: 'all'
    });

    expect(result.map((chat) => chat.chatId)).toEqual(['chat-1']);
  });

  it('filters by date presets and custom ranges', () => {
    const OptionsFilters = loadFilters();
    const now = new Date('2026-06-14T12:00:00.000Z').getTime();

    expect(OptionsFilters.apply(chats(), { datePreset: 'today' }, now).map((chat) => chat.chatId)).toEqual(['chat-1', 'chat-3']);
    expect(OptionsFilters.apply(chats(), {
      datePreset: 'custom',
      dateStart: '2026-06-01',
      dateEnd: '2026-06-02'
    }, now).map((chat) => chat.chatId)).toEqual(['chat-2']);
  });

  it('returns all chats when filters are empty', () => {
    const OptionsFilters = loadFilters();
    expect(OptionsFilters.apply(chats(), { datePreset: 'all' })).toHaveLength(3);
  });
});
