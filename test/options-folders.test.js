import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadSrc } from './helpers.js';

function loadFolders(dom) {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'window', 'document', loadSrc('options/folders.js'));
  fn(module, module.exports, dom.window, dom.window.document);
  return module.exports;
}

function createDom() {
  const dom = new JSDOM(`
    <main>
      <button id="all">All</button>
      <button id="add">New</button>
      <button id="rename">Rename</button>
      <button id="delete">Delete</button>
      <div id="folders"></div>
    </main>
  `);
  return dom;
}

function makeDAO() {
  const folders = [
    { folderId: 'folder-1', name: 'Work', parentId: '' },
    { folderId: 'folder-2', name: 'Client', parentId: 'folder-1' }
  ];
  const moved = [];
  return {
    folders,
    moved,
    listFolders: async () => folders.slice(),
    putFolder: async (folder) => {
      folders.push(folder);
      return folder;
    },
    renameFolder: async (folderId, name) => {
      const folder = folders.find((row) => row.folderId === folderId);
      folder.name = name;
      return folder;
    },
    deleteFolder: async (folderId) => {
      const index = folders.findIndex((row) => row.folderId === folderId);
      if (index !== -1) folders.splice(index, 1);
      return index !== -1;
    },
    setChatFolder: async (chatId, folderId) => {
      moved.push({ chatId, folderId });
      return { chatId, folderId };
    }
  };
}

describe('OptionsFolders', () => {
  it('renders nested folders and handles select/create/rename/delete', async () => {
    const dom = createDom();
    const OptionsFolders = loadFolders(dom);
    const dao = makeDAO();
    const selected = [];
    const changed = [];
    const prompts = ['New Child', 'Renamed'];
    dom.window.prompt = () => prompts.shift();
    dom.window.confirm = () => true;
    const folders = OptionsFolders.create({
      root: dom.window.document.getElementById('folders'),
      allButton: dom.window.document.getElementById('all'),
      dao,
      onSelect: (folderId) => selected.push(folderId),
      onChange: async () => changed.push(true),
      window: dom.window
    });
    folders.bindControls(
      dom.window.document.getElementById('add'),
      dom.window.document.getElementById('rename'),
      dom.window.document.getElementById('delete'),
      dom.window.document.getElementById('all')
    );

    await folders.load();
    dom.window.document.querySelector('[data-folder-id="folder-1"]').click();
    await folders.createFolder();
    await folders.renameFolder();
    await folders.deleteFolder();

    expect(selected[0]).toBe('folder-1');
    expect(dao.folders.some((folder) => folder.name === 'Renamed')).toBe(false);
    expect(changed.length).toBeGreaterThanOrEqual(3);
    expect(dom.window.document.getElementById('all').className).toContain('active');
  });

  it('drops a dragged chat onto a folder', async () => {
    const dom = createDom();
    const OptionsFolders = loadFolders(dom);
    const dao = makeDAO();
    const folders = OptionsFolders.create({
      root: dom.window.document.getElementById('folders'),
      dao,
      onChange: async () => {},
      window: dom.window
    });

    await folders.load();
    const event = new dom.window.Event('drop', { bubbles: true, cancelable: true });
    event.dataTransfer = {
      getData: (type) => type === 'application/x-rakuzaichi-chat-id' ? 'chat-1' : ''
    };
    dom.window.document.querySelector('[data-folder-id="folder-2"]').dispatchEvent(event);
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(dao.moved).toEqual([{ chatId: 'chat-1', folderId: 'folder-2' }]);
  });
});
