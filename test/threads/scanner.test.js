import { describe, expect, it } from 'vitest';
import { loadSrc } from '../helpers.js';

function loadScanner() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('threads/scanner.js'));
  fn(module, module.exports);
  return module.exports;
}

function message(content) {
  return {
    chatId: 'chat-1',
    messageId: 'msg-1',
    content,
    timestamp: '2026-01-01T00:00:00.000Z'
  };
}

describe('ThreadScanner', () => {
  it('scans all built-in tag prefixes', () => {
    const scanner = loadScanner();
    const content = scanner.TAGS.map((tag) => `${tag}: ${tag.toLowerCase()} item`).join('\n');
    const rows = scanner.scanMessage(message(content));

    expect(rows.map((row) => row.tag)).toEqual(scanner.TAGS);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({
      chatId: 'chat-1',
      messageId: 'msg-1',
      tag: 'TODO',
      text: 'todo item',
      source: 'explicit',
      subSource: 'scan',
      status: 'open',
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    expect(rows[0].threadId).toMatch(/^scan:chat-1:msg-1:0:TODO:/);
  });

  it('normalizes mixed-case tags', () => {
    const scanner = loadScanner();
    const rows = scanner.scanMessage(message('todo: ping Alice\nFixMe: repair parser'));

    expect(rows.map((row) => row.tag)).toEqual(['TODO', 'FIXME']);
    expect(rows.map((row) => row.text)).toEqual(['ping Alice', 'repair parser']);
  });

  it('scans configured custom tag prefixes', () => {
    const scanner = loadScanner();
    const rows = scanner.scanMessage(message('waiting: vendor reply\nTODO: built in'), {
      customTags: [{ tag: 'WAITING', color: '#123456' }]
    });

    expect(rows.map((row) => row.tag)).toEqual(['WAITING', 'TODO']);
    expect(rows.map((row) => row.text)).toEqual(['vendor reply', 'built in']);
    expect(rows[0].threadId).toMatch(/^scan:chat-1:msg-1:0:WAITING:/);
  });

  it('scans tag lines inside multi-line messages', () => {
    const scanner = loadScanner();
    const rows = scanner.scanMessage(message('intro\n  REF: source doc\nmiddle\nUNRESOLVED: confirm status'));

    expect(rows.map((row) => row.tag)).toEqual(['REF', 'UNRESOLVED']);
    expect(rows.map((row) => row.text)).toEqual(['source doc', 'confirm status']);
  });

  it('does not match inline or malformed false positives', () => {
    const scanner = loadScanner();
    const rows = scanner.scanMessage(message([
      'TODOLIST: not a tag',
      'This has TODO: inline text',
      'TODO - missing colon',
      'FIXME:',
      'PROMPTER: wrong word'
    ].join('\n')));

    expect(rows).toEqual([]);
  });
});
