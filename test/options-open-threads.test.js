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
      <label><input id="showDone" type="checkbox">Show done</label>
      <select id="source"><option value="">All</option><option value="explicit">Explicit</option></select>
      <select id="subSource"><option value="">All</option><option value="user">User</option><option value="scan">Scan</option></select>
      <select id="sort"><option value="priority">Priority</option></select>
      <button id="archive" type="button">Archive selected</button>
      <span id="summary"></span>
      <div id="threads"></div>
    </main>
  `);
  return { dom, root: dom.window.document.getElementById('threads') };
}

async function flush(window) {
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
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
        showDone: dom.window.document.getElementById('showDone'),
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

  it('uses configured tag priority for default sort', async () => {
    const { dom, root } = createDom();
    const OptionsOpenThreads = loadOpenThreads(dom);
    const pane = OptionsOpenThreads.create({
      root,
      summaryEl: dom.window.document.getElementById('summary'),
      tagPriority: ['PROMPT', 'REF', 'REV', 'FOLLOWUP', 'UNRESOLVED', 'TODO', 'FIXME'],
      filters: {
        tag: dom.window.document.getElementById('tag'),
        chat: dom.window.document.getElementById('chat'),
        platform: dom.window.document.getElementById('platform'),
        status: dom.window.document.getElementById('status'),
        showDone: dom.window.document.getElementById('showDone'),
        source: dom.window.document.getElementById('source'),
        subSource: dom.window.document.getElementById('subSource'),
        sort: dom.window.document.getElementById('sort')
      },
      dao: {
        listOpenThreads: async () => threads(7),
        listChats: async () => chats()
      },
      window: dom.window
    });

    await pane.load();
    expect([...root.querySelectorAll('.thread-row-data .thread-tag')].map((cell) => cell.textContent)).toEqual([
      'PROMPT',
      'REF',
      'REV',
      'FOLLOWUP',
      'UNRESOLVED',
      'TODO',
      'FIXME'
    ]);

    pane.setTagPriority(['FIXME', 'TODO', 'UNRESOLVED', 'FOLLOWUP', 'REV', 'REF', 'PROMPT']);
    expect([...root.querySelectorAll('.thread-row-data .thread-tag')].map((cell) => cell.textContent)).toEqual([
      'FIXME',
      'TODO',
      'UNRESOLVED',
      'FOLLOWUP',
      'REV',
      'REF',
      'PROMPT'
    ]);
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
        showDone: dom.window.document.getElementById('showDone'),
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

  it('marks threads done and reveals them with show done', async () => {
    const { dom, root } = createDom();
    const OptionsOpenThreads = loadOpenThreads(dom);
    const showDone = dom.window.document.getElementById('showDone');
    const rows = [
      { threadId: 'thread-open', chatId: 'chat-a', messageId: 'msg-1', tag: 'TODO', text: 'open item', source: 'explicit', subSource: 'user', status: 'open', createdAt: '2026-01-01T00:00:00.000Z' },
      { threadId: 'thread-done', chatId: 'chat-a', messageId: 'msg-2', tag: 'REF', text: 'done item', source: 'explicit', subSource: 'scan', status: 'done', createdAt: '2026-01-01T00:01:00.000Z' }
    ];
    const statusCalls = [];
    const pane = OptionsOpenThreads.create({
      root,
      summaryEl: dom.window.document.getElementById('summary'),
      filters: {
        tag: dom.window.document.getElementById('tag'),
        chat: dom.window.document.getElementById('chat'),
        platform: dom.window.document.getElementById('platform'),
        status: dom.window.document.getElementById('status'),
        showDone,
        source: dom.window.document.getElementById('source'),
        subSource: dom.window.document.getElementById('subSource'),
        sort: dom.window.document.getElementById('sort')
      },
      dao: {
        listOpenThreads: async () => rows,
        listChats: async () => chats(),
        setThreadStatus: async (threadId, status) => {
          statusCalls.push({ threadId, status });
          const row = rows.find((item) => item.threadId === threadId);
          row.status = status;
          if (status === 'done') row.resolvedAt = '2026-01-01T00:02:00.000Z';
          return row;
        }
      },
      window: dom.window
    });

    await pane.load();
    expect(root.querySelectorAll('.thread-row-data')).toHaveLength(1);
    root.querySelector('.thread-actions button').click();
    await flush(dom.window);

    expect(statusCalls).toEqual([{ threadId: 'thread-open', status: 'done' }]);
    expect(rows[0].resolvedAt).toBe('2026-01-01T00:02:00.000Z');
    expect(root.querySelectorAll('.thread-row-data')).toHaveLength(0);

    showDone.checked = true;
    showDone.dispatchEvent(new dom.window.Event('change'));
    expect(root.querySelectorAll('.thread-row-data')).toHaveLength(2);
    expect(dom.window.document.getElementById('summary').textContent).toBe('2 threads');
  });

  it('bulk archives selected done threads', async () => {
    const { dom, root } = createDom();
    const OptionsOpenThreads = loadOpenThreads(dom);
    const showDone = dom.window.document.getElementById('showDone');
    showDone.checked = true;
    const status = dom.window.document.getElementById('status');
    const rows = [
      { threadId: 'done-1', chatId: 'chat-a', messageId: 'msg-1', tag: 'TODO', text: 'done one', source: 'explicit', subSource: 'user', status: 'done', createdAt: '2026-01-01T00:00:00.000Z' },
      { threadId: 'done-2', chatId: 'chat-a', messageId: 'msg-2', tag: 'REF', text: 'done two', source: 'explicit', subSource: 'scan', status: 'done', createdAt: '2026-01-01T00:01:00.000Z' }
    ];
    const calls = [];
    const pane = OptionsOpenThreads.create({
      root,
      summaryEl: dom.window.document.getElementById('summary'),
      archiveButton: dom.window.document.getElementById('archive'),
      filters: {
        tag: dom.window.document.getElementById('tag'),
        chat: dom.window.document.getElementById('chat'),
        platform: dom.window.document.getElementById('platform'),
        status,
        showDone,
        source: dom.window.document.getElementById('source'),
        subSource: dom.window.document.getElementById('subSource'),
        sort: dom.window.document.getElementById('sort')
      },
      dao: {
        listOpenThreads: async () => rows,
        listChats: async () => chats(),
        setThreadStatus: async (threadId, nextStatus) => {
          calls.push({ threadId, status: nextStatus });
          rows.find((row) => row.threadId === threadId).status = nextStatus;
        }
      },
      window: dom.window
    });

    await pane.load();
    root.querySelectorAll('.thread-select').forEach((checkbox) => {
      checkbox.checked = true;
      checkbox.dispatchEvent(new dom.window.Event('change'));
    });
    dom.window.document.getElementById('archive').click();
    await flush(dom.window);

    expect(calls).toEqual([
      { threadId: 'done-1', status: 'archived' },
      { threadId: 'done-2', status: 'archived' }
    ]);
    expect(root.querySelectorAll('.thread-row-data')).toHaveLength(0);

    status.value = 'archived';
    status.dispatchEvent(new dom.window.Event('change'));
    expect(root.querySelectorAll('.thread-row-data')).toHaveLength(2);
  });
});
