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
      <button id="detail-pin" type="button"></button>
      <button id="send-new-chat" type="button"></button>
      <button id="restore-clipboard" type="button"></button>
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

  it('toggles pinned state from the detail header', async () => {
    const { dom } = createDom();
    const { OptionsChatDetail } = loadOptionsModules(dom);
    const changed = [];
    const detail = OptionsChatDetail.create({
      root: dom.window.document.getElementById('chat-detail'),
      openLink: dom.window.document.getElementById('open-original'),
      pinButton: dom.window.document.getElementById('detail-pin'),
      dao: {
        listMessages: async () => messages(),
        setChatPinned: async (chatId, pinned) => Object.assign(chat(), { chatId, pinned })
      },
      onPinChanged: (updated) => changed.push(updated.pinned),
      window: dom.window
    });

    await detail.load(Object.assign(chat(), { pinned: false }));
    dom.window.document.getElementById('detail-pin').click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(changed).toEqual([true]);
    expect(dom.window.document.getElementById('detail-pin').textContent).toBe('★');
  });

  it('copies a primer and opens the platform new-chat URL', async () => {
    const { dom } = createDom();
    const { OptionsChatDetail } = loadOptionsModules(dom);
    const copied = [];
    const opened = [];
    const sendButton = dom.window.document.getElementById('send-new-chat');
    const detail = OptionsChatDetail.create({
      root: dom.window.document.getElementById('chat-detail'),
      openLink: dom.window.document.getElementById('open-original'),
      sendButton,
      dao: { listMessages: async () => messages() },
      copyText: async (value) => copied.push(value),
      openUrl: (url) => opened.push(url),
      window: dom.window
    });

    await detail.load(chat());
    sendButton.click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(opened).toEqual(['https://claude.ai/new']);
    expect(sendButton.textContent).toBe('Sent');
    expect(copied).toHaveLength(1);
    expect(copied[0]).toContain('# Continue this saved chat');
    expect(copied[0]).toContain('Source platform: Claude');
    expect(copied[0]).toContain('Source URL: https://claude.ai/chat/thread-1');
    expect(copied[0]).toContain('\n\nUse this transcript as context.');
    expect(copied[0]).toContain('[1] User');
    expect(copied[0]).toContain('How should I restore this?');
  });

  it('copies the full chat as Markdown with headings and roles', async () => {
    const { dom } = createDom();
    const { OptionsChatDetail } = loadOptionsModules(dom);
    const copied = [];
    const restoreButton = dom.window.document.getElementById('restore-clipboard');
    const detail = OptionsChatDetail.create({
      root: dom.window.document.getElementById('chat-detail'),
      openLink: dom.window.document.getElementById('open-original'),
      restoreButton,
      dao: { listMessages: async () => messages() },
      copyText: async (value) => copied.push(value),
      window: dom.window
    });

    await detail.load(chat());
    restoreButton.click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(restoreButton.textContent).toBe('Copied');
    expect(copied).toHaveLength(1);
    expect(copied[0]).toContain('# Restore plan');
    expect(copied[0]).toContain('- Platform: Claude');
    expect(copied[0]).toContain('## User');
    expect(copied[0]).toContain('How should I restore this?');
    expect(copied[0]).toContain('## Assistant');
    expect(copied[0]).toContain('Use the latest vault snapshot.');
    expect(copied[0]).toContain('## System');
    expect(copied[0]).toContain('Keep source links.');
  });

  it('creates explicit user open-thread rows from per-message tag popover', async () => {
    const { dom } = createDom();
    const { OptionsChatDetail } = loadOptionsModules(dom);
    const created = [];
    const detail = OptionsChatDetail.create({
      root: dom.window.document.getElementById('chat-detail'),
      openLink: dom.window.document.getElementById('open-original'),
      dao: {
        listMessages: async () => messages(),
        putOpenThreads: async (threads) => {
          created.push(...threads);
          return threads;
        }
      },
      window: dom.window
    });

    await detail.load(chat());
    dom.window.document.querySelector('.tag-message').click();
    dom.window.document.querySelector('.thread-popover input').value = 'follow up with owner';
    dom.window.document.querySelector('.thread-tag-grid button[data-tag="TODO"]').click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      chatId: 'claude:thread-1',
      messageId: 'm1',
      tag: 'TODO',
      text: 'follow up with owner',
      source: 'explicit',
      subSource: 'user',
      status: 'open'
    });
    expect(created[0].threadId).toMatch(/^thread:/);
    expect(created[0].createdAt).toBeTruthy();
  });

  it('renders per-message open-thread chips and opens the thread record', async () => {
    const { dom } = createDom();
    const { OptionsChatDetail } = loadOptionsModules(dom);
    const opened = [];
    const detail = OptionsChatDetail.create({
      root: dom.window.document.getElementById('chat-detail'),
      openLink: dom.window.document.getElementById('open-original'),
      dao: {
        listMessages: async () => messages(),
        listOpenThreads: async () => [
          { threadId: 'thread-1', chatId: 'claude:thread-1', messageId: 'm1', tag: 'TODO', text: 'follow up', source: 'explicit', subSource: 'user', status: 'open' },
          { threadId: 'thread-2', chatId: 'claude:thread-1', messageId: 'm1', tag: 'REF', text: 'reference source', source: 'explicit', subSource: 'user', status: 'open' },
          { threadId: 'thread-3', chatId: 'claude:thread-1', messageId: 'm2', tag: 'FIXME', text: 'old bug', source: 'explicit', subSource: 'user', status: 'archived' }
        ]
      },
      onThreadOpen: (thread) => opened.push(thread.threadId),
      window: dom.window
    });

    await detail.load(chat());
    const cards = dom.window.document.querySelectorAll('.message-card');
    expect([...cards[0].querySelectorAll('.thread-chip')].map((chip) => chip.textContent)).toEqual(['TODO', 'REF']);
    expect(cards[1].querySelectorAll('.thread-chip')).toHaveLength(0);
    cards[0].querySelector('.thread-chip[data-tag="REF"]').click();

    expect(opened).toEqual(['thread-2']);
    expect(cards[0].querySelector('.thread-record').textContent).toContain('REF');
    expect(cards[0].querySelector('.thread-record').textContent).toContain('reference source');
  });

  it('archives a thread row when removing a message tag chip', async () => {
    const { dom } = createDom();
    const { OptionsChatDetail } = loadOptionsModules(dom);
    const archived = [];
    const detail = OptionsChatDetail.create({
      root: dom.window.document.getElementById('chat-detail'),
      openLink: dom.window.document.getElementById('open-original'),
      dao: {
        listMessages: async () => messages(),
        listOpenThreads: async () => [
          { threadId: 'thread-1', chatId: 'claude:thread-1', messageId: 'm1', tag: 'TODO', text: 'follow up', source: 'explicit', subSource: 'user', status: 'open' },
          { threadId: 'thread-2', chatId: 'claude:thread-1', messageId: 'm1', tag: 'REF', text: 'reference source', source: 'explicit', subSource: 'user', status: 'open' }
        ],
        setThreadStatus: async (threadId, status) => {
          archived.push({ threadId, status });
          return { threadId, status };
        }
      },
      window: dom.window
    });

    await detail.load(chat());
    dom.window.document.querySelector('.thread-chip-remove[aria-label="Remove TODO thread"]').click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(archived).toEqual([{ threadId: 'thread-1', status: 'archived' }]);
    expect([...dom.window.document.querySelectorAll('.message-card:first-of-type .thread-chip')].map((chip) => chip.textContent)).toEqual(['REF']);
  });

  it('opens the tag popover and applies a tag with keyboard shortcuts', async () => {
    const { dom } = createDom();
    const { OptionsChatDetail } = loadOptionsModules(dom);
    const created = [];
    const detail = OptionsChatDetail.create({
      root: dom.window.document.getElementById('chat-detail'),
      openLink: dom.window.document.getElementById('open-original'),
      dao: {
        listMessages: async () => messages(),
        putOpenThreads: async (threads) => {
          created.push(...threads);
          return threads;
        }
      },
      window: dom.window
    });

    await detail.load(chat());
    const card = dom.window.document.querySelector('.message-card');
    card.focus();
    card.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 't', bubbles: true, cancelable: true }));
    expect(dom.window.document.querySelector('.thread-popover').hidden).toBe(false);
    card.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true }));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ messageId: 'm1', tag: 'FIXME', source: 'explicit', subSource: 'user' });
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
