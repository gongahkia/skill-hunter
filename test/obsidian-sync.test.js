import { describe, expect, it, vi } from 'vitest';
import { evalSrc } from './helpers.js';

const { FormatConverter, ObsidianSync } = evalSrc('filename.js', 'converters.js', 'zip.js', 'obsidian-sync.js');

async function readStoredEntries(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  const entries = {};
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    entries[name] = decoder.decode(bytes.slice(dataStart, dataStart + compressedSize));
    offset = dataStart + compressedSize;
  }
  return entries;
}

function makeDirectoryHandle(name, permission = 'granted') {
  const handle = {
    kind: 'directory',
    name,
    permission,
    directories: {},
    files: {},
    async queryPermission(descriptor) {
      handle.lastQuery = descriptor;
      return handle.permission;
    },
    async requestPermission(descriptor) {
      handle.lastRequest = descriptor;
      handle.permission = 'granted';
      return handle.permission;
    },
    async getDirectoryHandle(childName, options) {
      if (!handle.directories[childName]) {
        if (!options || !options.create) throw new Error('directory not found');
        handle.directories[childName] = makeDirectoryHandle(childName, handle.permission);
      }
      return handle.directories[childName];
    },
    async getFileHandle(fileName, options) {
      if (!handle.files[fileName]) {
        if (!options || !options.create) throw new Error('file not found');
        const file = { name: fileName, content: '' };
        handle.files[fileName] = {
          async createWritable() {
            return {
              async write(content) {
                file.content = content;
              },
              async close() {
                file.closed = true;
              }
            };
          },
          file
        };
      }
      return handle.files[fileName];
    }
  };
  return handle;
}

function chats() {
  return [
    { chatId: 'chatgpt:thread-1', platform: 'chatgpt', title: 'Deploy plan', model: 'gpt-4', messageCount: 1 },
    { chatId: 'claude:thread-2', platform: 'claude', title: 'Deploy plan', model: 'claude', messageCount: 1 }
  ];
}

describe('ObsidianSync', () => {
  it('picks a writable vault and persists the handle', async () => {
    const root = makeDirectoryHandle('Notes', 'prompt');
    const saved = {};
    const picker = vi.fn(async () => root);

    const handle = await ObsidianSync.chooseVault({
      window: { showDirectoryPicker: picker },
      dao: { setMeta: async (key, value) => { saved[key] = value; } }
    });

    expect(handle).toBe(root);
    expect(picker).toHaveBeenCalledWith({ id: 'rakuzaichi-obsidian-vault', mode: 'readwrite' });
    expect(root.lastQuery).toEqual({ mode: 'readwrite' });
    expect(root.lastRequest).toEqual({ mode: 'readwrite' });
    expect(saved[ObsidianSync.metaKey]).toBe(root);
  });

  it('writes one Markdown note per chat into the Rakuzaichi subfolder', async () => {
    const root = makeDirectoryHandle('Obsidian');
    const rows = chats();
    const dao = {
      getMeta: async () => root,
      listChats: async () => rows,
      listMessages: async (chatId) => [
        { messageId: `${chatId}:m1`, role: 'user', content: `Question ${chatId}`, index: 0 }
      ],
      listOpenThreads: async (filter) => [
        { threadId: `${filter.chatId}:todo`, chatId: filter.chatId, messageId: `${filter.chatId}:m1`, tag: 'TODO', text: 'follow up' }
      ]
    };

    const result = await ObsidianSync.syncAll({ dao, converter: FormatConverter });
    const folder = root.directories.Rakuzaichi;
    const fileNames = Object.keys(folder.files).sort();

    expect(result).toMatchObject({ vaultName: 'Obsidian', subfolderName: 'Rakuzaichi', chatCount: 2, messageCount: 2 });
    expect(fileNames).toHaveLength(2);
    expect(fileNames[0]).toMatch(/^chatgpt_Deploy_plan_thread-1.*\.md$/);
    expect(fileNames[1]).toMatch(/^claude_Deploy_plan_thread-2.*\.md$/);
    expect(folder.files[fileNames[0]].file.content).toContain('# Deploy plan');
    expect(folder.files[fileNames[0]].file.content).toContain('Question chatgpt:thread-1');
  });

  it('refuses sync when write permission is denied', async () => {
    const root = makeDirectoryHandle('Obsidian', 'denied');
    root.requestPermission = async () => 'denied';
    const dao = {
      getMeta: async () => root,
      listChats: async () => chats(),
      listMessages: async () => []
    };

    await expect(ObsidianSync.syncAll({ dao, converter: FormatConverter })).rejects.toThrow('Write permission');
  });

  it('creates a ZIP fallback with one Markdown note per chat', async () => {
    const rows = chats();
    const dao = {
      listChats: async () => rows,
      listMessages: async (chatId) => [
        { messageId: `${chatId}:m1`, role: 'user', content: `Zip ${chatId}`, index: 0 }
      ],
      listOpenThreads: async () => []
    };

    const result = await ObsidianSync.createZip({ dao, converter: FormatConverter });
    const entries = await readStoredEntries(result.blob);
    const names = Object.keys(entries).sort();

    expect(result.filename).toMatch(/^rakuzaichi_obsidian_\d{4}-\d{2}-\d{2}\.zip$/);
    expect(result.files).toHaveLength(2);
    expect(names[0]).toMatch(/^Rakuzaichi\/chatgpt_Deploy_plan_thread-1.*\.md$/);
    expect(entries[names[0]]).toContain('Zip chatgpt:thread-1');
  });
});
