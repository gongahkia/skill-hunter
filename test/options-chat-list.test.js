import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadSrc } from './helpers.js';

function loadChatList(dom) {
  const code = 'var module = undefined;\n' + loadSrc('options/chat-list.js') + '\nthis.result = OptionsChatList;';
  const fn = new Function('window', 'document', code);
  const ctx = { result: null };
  fn.call(ctx, dom.window, dom.window.document);
  return ctx.result;
}

function createDom() {
  const dom = new JSDOM(`
    <main>
      <strong id="vault-count">0</strong>
      <span id="chat-list-summary">0 captured</span>
      <div id="chat-list"></div>
    </main>
  `);
  const root = dom.window.document.getElementById('chat-list');
  Object.defineProperty(root, 'clientHeight', { configurable: true, value: 84 });
  dom.window.requestAnimationFrame = (callback) => dom.window.setTimeout(callback, 0);
  dom.window.cancelAnimationFrame = (id) => dom.window.clearTimeout(id);
  return { dom, root };
}

function makeChats(count) {
  return Array.from({ length: count }, (_, index) => ({
    chatId: `chat-${index}`,
    platform: index % 2 ? 'claude' : 'chatgpt',
    title: `Chat ${index}`,
    lastUpdatedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    messageCount: index + 1,
    tags: index % 3 === 0 ? ['TODO', 'REF'] : []
  }));
}

describe('OptionsChatList', () => {
  it('loads 1000 chats without rendering all rows', async () => {
    const { dom, root } = createDom();
    const OptionsChatList = loadChatList(dom);
    const chats = makeChats(1000);
    const list = OptionsChatList.create({
      root,
      summaryEl: dom.window.document.getElementById('chat-list-summary'),
      countEl: dom.window.document.getElementById('vault-count'),
      dao: { listChats: async () => chats },
      window: dom.window
    });

    await list.load();

    expect(dom.window.document.getElementById('chat-list-summary').textContent).toBe('1000 captured');
    expect(dom.window.document.getElementById('vault-count').textContent).toBe('1000');
    expect(root.querySelectorAll('.chat-row-data')).toHaveLength(18);
    expect(root.textContent).toContain('Date');
    expect(root.textContent).toContain('ChatGPT');
    expect(root.textContent).toContain('TODO, REF');
  });

  it('replaces visible rows after scrolling', async () => {
    const { dom, root } = createDom();
    const OptionsChatList = loadChatList(dom);
    const list = OptionsChatList.create({
      root,
      dao: { listChats: async () => makeChats(1000) },
      window: dom.window
    });

    await list.load();
    root.scrollTop = 36 + OptionsChatList.ROW_HEIGHT * 420;
    root.dispatchEvent(new dom.window.Event('scroll'));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 5));

    expect(list.getVisibleRange()).toMatchObject({ start: 412, end: 430 });
    expect(root.textContent).toContain('Chat 420');
    expect(root.querySelectorAll('.chat-row-data')).toHaveLength(18);
  });

  it('emits selected chat on row click and keyboard activation', async () => {
    const { dom, root } = createDom();
    const OptionsChatList = loadChatList(dom);
    const selected = [];
    const list = OptionsChatList.create({
      root,
      onSelect: (chat) => selected.push(chat.chatId),
      window: dom.window
    });

    list.setChats(makeChats(2));
    const row = root.querySelector('[data-chat-id="chat-0"]');
    row.click();
    row.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(selected).toEqual(['chat-0', 'chat-0']);
    expect(root.querySelector('[data-chat-id="chat-0"]').className).toContain('selected');
  });
});
