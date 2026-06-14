import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadSrc } from './helpers.js';

function loadOptionsModules(dom) {
  const code = [
    'var module = undefined;',
    loadSrc('options/chat-list.js'),
    loadSrc('options/chat-detail.js'),
    'this.result = { OptionsChatList, OptionsChatDetail };'
  ].join('\n');
  const fn = new Function('window', 'document', code);
  const ctx = { result: null };
  fn.call(ctx, dom.window, dom.window.document);
  return ctx.result;
}

function createDom() {
  const dom = new JSDOM(`
    <main>
      <a id="open-original" href="#" aria-disabled="true">Open original</a>
      <div id="chat-detail"></div>
      <span id="chat-list-summary">0 captured</span>
      <strong id="vault-count">0</strong>
      <div id="chat-list"></div>
    </main>
  `, { url: 'https://extension.test/options.html' });
  const listRoot = dom.window.document.getElementById('chat-list');
  Object.defineProperty(listRoot, 'clientHeight', { configurable: true, value: 84 });
  dom.window.requestAnimationFrame = (callback) => dom.window.setTimeout(callback, 0);
  dom.window.cancelAnimationFrame = (id) => dom.window.clearTimeout(id);
  return { dom, listRoot };
}

function chat() {
  return {
    chatId: 'claude:thread-1',
    platform: 'claude',
    title: 'Restore plan',
    url: 'https://claude.ai/chat/thread-1',
    lastUpdatedAt: '2026-01-02T03:04:00.000Z',
    messageCount: 3,
    tags: ['TODO']
  };
}

function messages() {
  return [
    { messageId: 'm1', role: 'user', content: 'How should I restore this?', index: 0, timestamp: '2026-01-02T03:00:00.000Z' },
    { messageId: 'm2', role: 'assistant', content: 'Use the latest vault snapshot.', index: 1, timestamp: '2026-01-02T03:01:00.000Z' },
    { messageId: 'm3', role: 'system', content: 'Keep source links.', index: 2, timestamp: '2026-01-02T03:02:00.000Z' }
  ];
}

describe('OptionsChatDetail', () => {
  it('renders messages by role and copies a message', async () => {
    const { dom } = createDom();
    const { OptionsChatDetail } = loadOptionsModules(dom);
    const copied = [];
    const detail = OptionsChatDetail.create({
      root: dom.window.document.getElementById('chat-detail'),
      openLink: dom.window.document.getElementById('open-original'),
      dao: { listMessages: async () => messages() },
      copyText: async (value) => copied.push(value),
      window: dom.window
    });

    await detail.load(chat());
    dom.window.document.querySelectorAll('.copy-message')[1].click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(dom.window.document.getElementById('open-original').href).toBe('https://claude.ai/chat/thread-1');
    expect(dom.window.document.getElementById('open-original').getAttribute('aria-disabled')).toBe('false');
    expect(dom.window.document.querySelectorAll('.message-card')).toHaveLength(3);
    expect(dom.window.document.querySelector('.message-card.user').textContent).toContain('How should I restore this?');
    expect(dom.window.document.querySelector('.message-card.assistant').textContent).toContain('Use the latest vault snapshot.');
    expect(dom.window.document.querySelector('.message-card.system').textContent).toContain('Keep source links.');
    expect(copied).toEqual(['Use the latest vault snapshot.']);
  });

  it('adds and removes free-form chat tags', async () => {
    const { dom } = createDom();
    const { OptionsChatDetail } = loadOptionsModules(dom);
    const saved = [];
    const changed = [];
    const detail = OptionsChatDetail.create({
      root: dom.window.document.getElementById('chat-detail'),
      openLink: dom.window.document.getElementById('open-original'),
      dao: {
        listMessages: async () => messages(),
        setChatTags: async (chatId, tags) => {
          saved.push({ chatId, tags });
          return Object.assign(chat(), { tags });
        }
      },
      onTagsChanged: (updated) => changed.push(updated.tags),
      window: dom.window
    });

    await detail.load(Object.assign(chat(), { tags: [] }));
    const input = dom.window.document.querySelector('.tag-add input');
    input.value = 'research';
    dom.window.document.querySelector('.tag-add button').click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    dom.window.document.querySelector('.tag-chip').click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(saved).toEqual([
      { chatId: 'claude:thread-1', tags: ['research'] },
      { chatId: 'claude:thread-1', tags: [] }
    ]);
    expect(changed).toEqual([['research'], []]);
  });

  it('opens detail when a chat-list row is clicked', async () => {
    const { dom, listRoot } = createDom();
    const { OptionsChatList, OptionsChatDetail } = loadOptionsModules(dom);
    const detail = OptionsChatDetail.create({
      root: dom.window.document.getElementById('chat-detail'),
      openLink: dom.window.document.getElementById('open-original'),
      dao: { listMessages: async () => messages() },
      window: dom.window
    });
    const list = OptionsChatList.create({
      root: listRoot,
      summaryEl: dom.window.document.getElementById('chat-list-summary'),
      countEl: dom.window.document.getElementById('vault-count'),
      onSelect: (selectedChat) => detail.load(selectedChat),
      window: dom.window
    });

    list.setChats([chat()]);
    listRoot.querySelector('[data-chat-id="claude:thread-1"]').click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 5));

    expect(dom.window.document.getElementById('chat-detail').textContent).toContain('Restore plan');
    expect(dom.window.document.getElementById('chat-detail').textContent).toContain('Use the latest vault snapshot.');
    expect(dom.window.document.getElementById('open-original').href).toBe('https://claude.ai/chat/thread-1');
  });
});
