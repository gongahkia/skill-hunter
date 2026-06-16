var ObsidianSync = (function() {
  var META_HANDLE_KEY = 'obsidianVaultDirectoryHandle';
  var DEFAULT_SUBFOLDER = 'Rakuzaichi';

  function isSupported(win) {
    win = win || (typeof window !== 'undefined' ? window : null);
    return !!(win && typeof win.showDirectoryPicker === 'function');
  }

  function sanitizeFilename(value) {
    if (typeof FilenameBuilder !== 'undefined' && FilenameBuilder.sanitize) return FilenameBuilder.sanitize(String(value || 'untitled'));
    return String(value || 'untitled').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '_').slice(0, 100);
  }

  function chatStem(chat, index) {
    chat = chat || {};
    var idPart = String(chat.chatId || String(index + 1)).split(':').pop();
    var parts = [
      chat.platform || 'chat',
      chat.title || chat.chatTitle || 'Untitled chat',
      idPart
    ].filter(Boolean);
    return sanitizeFilename(parts.join('_')).replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'chat_' + String(index + 1);
  }

  function uniqueFilename(name, seen) {
    var base = name.replace(/\.md$/i, '');
    var candidate = base + '.md';
    var count = 2;
    while (seen[candidate]) {
      candidate = base.slice(0, 94) + '_' + String(count) + '.md';
      count++;
    }
    seen[candidate] = true;
    return candidate;
  }

  function filenameForChat(chat, index, seen) {
    var stem = chatStem(chat, index).slice(0, 96);
    return uniqueFilename(stem + '.md', seen || {});
  }

  async function ensurePermission(handle) {
    if (!handle) return false;
    var descriptor = { mode: 'readwrite' };
    if (handle.queryPermission && await handle.queryPermission(descriptor) === 'granted') return true;
    if (handle.requestPermission && await handle.requestPermission(descriptor) === 'granted') return true;
    return !handle.queryPermission && !handle.requestPermission;
  }

  async function chooseVault(options) {
    options = options || {};
    var win = options.window || (typeof window !== 'undefined' ? window : null);
    if (!isSupported(win)) throw new Error('File System Access API is unavailable');
    var handle = await win.showDirectoryPicker({ id: 'rakuzaichi-obsidian-vault', mode: 'readwrite' });
    if (!await ensurePermission(handle)) throw new Error('Write permission was not granted');
    if (options.dao && options.dao.setMeta) await options.dao.setMeta(META_HANDLE_KEY, handle);
    return handle;
  }

  async function storedVault(dao) {
    if (!dao || !dao.getMeta) return null;
    return dao.getMeta(META_HANDLE_KEY);
  }

  function chatEnvelope(chat, messages, openThreads) {
    messages = Array.isArray(messages) ? messages : [];
    return {
      exportVersion: '2.1',
      exportedAt: new Date().toISOString(),
      chatId: chat.chatId || '',
      platform: chat.platform || 'unknown',
      chatTitle: chat.title || chat.chatTitle || 'Untitled chat',
      title: chat.title || chat.chatTitle || 'Untitled chat',
      url: chat.url || chat.sourceUrl || '',
      model: chat.model || '',
      messageCount: messages.length,
      messages: messages,
      openThreads: Array.isArray(openThreads) ? openThreads : [],
      capturedAt: chat.capturedAt || '',
      lastUpdatedAt: chat.lastUpdatedAt || '',
      tags: Array.isArray(chat.tags) ? chat.tags.slice() : []
    };
  }

  async function writeText(directoryHandle, filename, content) {
    var fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
    var writable = await fileHandle.createWritable();
    try {
      await writable.write(content);
    } finally {
      await writable.close();
    }
  }

  async function syncAll(options) {
    options = options || {};
    var dao = options.dao;
    var converter = options.converter || (typeof FormatConverter !== 'undefined' ? FormatConverter : null);
    if (!dao || !dao.listChats || !dao.listMessages) throw new Error('Vault DAO is unavailable');
    if (!converter || !converter.toMarkdown) throw new Error('Markdown converter is unavailable');
    var handle = options.handle || await storedVault(dao);
    if (!handle) throw new Error('No Obsidian vault directory selected');
    if (!await ensurePermission(handle)) throw new Error('Write permission was not granted');

    var subfolderName = sanitizeFilename(options.subfolderName || DEFAULT_SUBFOLDER);
    var directory = await handle.getDirectoryHandle(subfolderName, { create: true });
    var chats = Array.isArray(options.chats) ? options.chats : await dao.listChats();
    var seen = {};
    var files = [];
    var messageCount = 0;

    for (var i = 0; i < chats.length; i++) {
      var chat = chats[i];
      var messages = await dao.listMessages(chat.chatId);
      var openThreads = dao.listOpenThreads ? await dao.listOpenThreads({ chatId: chat.chatId }) : [];
      var envelope = chatEnvelope(chat, messages, openThreads);
      var filename = filenameForChat(chat, i, seen);
      await writeText(directory, filename, converter.toMarkdown(envelope));
      files.push(filename);
      messageCount += messages.length;
    }

    return {
      vaultName: handle.name || '',
      subfolderName: subfolderName,
      chatCount: chats.length,
      messageCount: messageCount,
      files: files
    };
  }

  return {
    metaKey: META_HANDLE_KEY,
    defaultSubfolder: DEFAULT_SUBFOLDER,
    isSupported: isSupported,
    ensurePermission: ensurePermission,
    chooseVault: chooseVault,
    storedVault: storedVault,
    filenameForChat: filenameForChat,
    syncAll: syncAll
  };
})();

if (typeof module !== 'undefined') module.exports = ObsidianSync;
