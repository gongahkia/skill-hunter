import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadSrc } from './helpers.js';

function loadOpenThreads(dom) {
  const code = 'var module = undefined;\n' + loadSrc('options/open-threads.js') + '\nthis.result = OptionsOpenThreads;';
  const fn = new Function('window', 'document', code);
  const ctx = { result: null };
  fn.call(ctx, dom.window, dom.window.document);
  return ctx.result;
}

function createDom() {
  const dom = new JSDOM(`
    <main>
      <select id="tag"><option value="">All</option><option value="FIXME">FIXME</option></select>
      <input id="chat">
      <select id="platform"><option value="">All</option><option value="claude">Claude</option></select>
      <select id="status"><option value="open">Open</option><option value="">All</option><option value="archived">Archived</option></select>
      <select id="source"><option value="">All</option><option value="explicit">Explicit</option></select>
      <select id="subSource"><option value="">All</option><option value="user">User</option><option value="scan">Scan</option></select>
      <select id="sort"><option value="priority">Priority</option></select>
      <span id="summary"></span>
      <div id="threads"></div>
    </main>
  `);
  return { dom, root: dom.window.document.getElementById('threads') };
}

function chats() {
  return [
    { chatId: 'chat-a', platform: 'claude', title: 'Alpha chat' },
    { chatId: 'chat-b', platform: 'chatgpt', title: 'Beta chat' }
  ];
}

function threads(count) {
  const tags = ['PROMPT', 'REF', 'REV', 'FOLLOWUP', 'UNRESOLVED', 'TODO', 'FIXME'];
  return Array.from({ length: count }, (_, index) => ({
    threadId: `thread-${index}`,
    chatId: index % 2 ? 'chat-a' : 'chat-b',
    messageId: `msg-${index}`,
    tag: tags[index % tags.length],
    text: `thread text ${index}`,
    source: 'explicit',
    subSource: index % 5 === 0 ? 'user' : 'scan',
    status: 'open',
    createdAt: `2026-01-01T00:${String(index).padStart(2, '0')}:00.000Z`
  }));
}

describe('OptionsOpenThreads', () => {
  it('renders all open threads in tag-priority order', async () => {
    const { dom, root } = createDom();
    const OptionsOpenThreads = loadOpenThreads(dom);
    const pane = OptionsOpenThreads.create({
      root,
      summaryEl: dom.window.document.getElementById('summary'),
      filters: {
        tag: dom.window.document.getElementById('tag'),
        chat: dom.window.document.getElementById('chat'),
        platform: dom.window.document.getElementById('platform'),
        status: dom.window.document.getElementById('status'),
        source: dom.window.document.getElementById('source'),
        subSource: dom.window.document.getElementById('subSource'),
        sort: dom.window.document.getElementById('sort')
      },
      dao: {
        listOpenThreads: async () => threads(50),
        listChats: async () => chats()
      },
      window: dom.window
    });

    await pane.load();
    const tags = [...root.querySelectorAll('.thread-row-data .thread-tag')].map((cell) => cell.textContent);
    expect(tags[0]).toBe('FIXME');
    expect(tags[tags.length - 1]).toBe('PROMPT');
    expect(tags).toHaveLength(50);
    expect(dom.window.document.getElementById('summary').textContent).toBe('50 threads');
  });

  it('filters by sub-source', async () => {
    const { dom, root } = createDom();
    const OptionsOpenThreads = loadOpenThreads(dom);
    const subSource = dom.window.document.getElementById('subSource');
    const pane = OptionsOpenThreads.create({
      root,
      summaryEl: dom.window.document.getElementById('summary'),
      filters: {
        tag: dom.window.document.getElementById('tag'),
        chat: dom.window.document.getElementById('chat'),
        platform: dom.window.document.getElementById('platform'),
        status: dom.window.document.getElementById('status'),
        source: dom.window.document.getElementById('source'),
        subSource,
        sort: dom.window.document.getElementById('sort')
      },
      dao: {
        listOpenThreads: async () => threads(50),
        listChats: async () => chats()
      },
      window: dom.window
    });

    await pane.load();
    subSource.value = 'user';
    subSource.dispatchEvent(new dom.window.Event('change'));

    const rows = [...root.querySelectorAll('.thread-row-data')];
    expect(rows).toHaveLength(10);
    expect(rows.every((row) => row.textContent.includes('explicit / user'))).toBe(true);
    expect(dom.window.document.getElementById('summary').textContent).toBe('10 threads');
  });
});
