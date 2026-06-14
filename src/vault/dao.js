var VaultDBModule = (typeof VaultDB !== 'undefined') ? VaultDB : null;
if (!VaultDBModule && typeof require !== 'undefined') {
  VaultDBModule = require('./db.js').VaultDB;
}

function createVaultDAO(options) {
  options = options || {};
  var dbModule = options.db || VaultDBModule;

  function requestToPromise(request) {
    return new Promise(function(resolve, reject) {
      request.onsuccess = function() {
        resolve(request.result);
      };
      request.onerror = function() {
        reject(request.error || new Error('IndexedDB request failed'));
      };
    });
  }

  function transactionDone(transaction) {
    return new Promise(function(resolve, reject) {
      transaction.oncomplete = function() {
        resolve();
      };
      transaction.onerror = function() {
        reject(transaction.error || new Error('IndexedDB transaction failed'));
      };
      transaction.onabort = function() {
        reject(transaction.error || new Error('IndexedDB transaction aborted'));
      };
    });
  }

  async function withTransaction(storeNames, mode, callback) {
    var db = await dbModule.open(options);
    var transaction = db.transaction(storeNames, mode);
    var done = transactionDone(transaction);

    try {
      var result = await callback(transaction);
      await done;
      return result;
    } catch (error) {
      try {
        if (transaction.error == null) transaction.abort();
      } catch (abortError) {}
      try {
        await done;
      } catch (transactionError) {}
      throw error;
    } finally {
      dbModule.close(db);
    }
  }

  function filterRows(rows, filter) {
    filter = filter || {};
    return rows.filter(function(row) {
      for (var key in filter) {
        if (filter[key] !== undefined && row[key] !== filter[key]) return false;
      }
      return true;
    });
  }

  function deleteByIndex(store, indexName, key) {
    return new Promise(function(resolve, reject) {
      var count = 0;
      var request = store.index(indexName).openCursor(key);
      request.onsuccess = function() {
        var cursor = request.result;
        if (!cursor) {
          resolve(count);
          return;
        }
        cursor.delete();
        count++;
        cursor.continue();
      };
      request.onerror = function() {
        reject(request.error || new Error('IndexedDB cursor failed'));
      };
    });
  }

  function folderDepth(folder, foldersById) {
    var depth = 1;
    var parentId = folder.parentId || '';
    while (parentId) {
      depth++;
      if (depth > 3) return depth;
      var parent = foldersById[parentId];
      if (!parent) break;
      parentId = parent.parentId || '';
    }
    return depth;
  }

  function collectFolderIds(folderId, folders) {
    var ids = [folderId];
    for (var i = 0; i < folders.length; i++) {
      if (ids.indexOf(folders[i].parentId) !== -1 && ids.indexOf(folders[i].folderId) === -1) {
        ids.push(folders[i].folderId);
        i = -1;
      }
    }
    return ids;
  }

  async function putChat(chat) {
    if (!chat || !chat.chatId) throw new Error('chatId is required');
    return withTransaction(['chats'], 'readwrite', async function(transaction) {
      var record = Object.assign({}, chat);
      await requestToPromise(transaction.objectStore('chats').put(record));
      return record;
    });
  }

  async function getChat(chatId) {
    if (!chatId) throw new Error('chatId is required');
    return withTransaction(['chats'], 'readonly', async function(transaction) {
      var row = await requestToPromise(transaction.objectStore('chats').get(chatId));
      return row || null;
    });
  }

  async function listChats(filter) {
    return withTransaction(['chats'], 'readonly', async function(transaction) {
      var rows = await requestToPromise(transaction.objectStore('chats').getAll());
      return filterRows(rows, filter).sort(function(a, b) {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        return String(b.lastUpdatedAt || '').localeCompare(String(a.lastUpdatedAt || ''));
      });
    });
  }

  async function putMessages(chatId, messages) {
    if (!chatId) throw new Error('chatId is required');
    if (!Array.isArray(messages)) throw new Error('messages must be an array');
    return withTransaction(['messages'], 'readwrite', async function(transaction) {
      var store = transaction.objectStore('messages');
      var records = messages.map(function(message) {
        return Object.assign({}, message, { chatId: chatId });
      });
      for (var i = 0; i < records.length; i++) {
        store.put(records[i]);
      }
      return records;
    });
  }

  async function listMessages(chatId) {
    if (!chatId) throw new Error('chatId is required');
    return withTransaction(['messages'], 'readonly', async function(transaction) {
      var rows = await requestToPromise(transaction.objectStore('messages').index('chatId').getAll(chatId));
      return rows.sort(function(a, b) {
        return (a.index || 0) - (b.index || 0);
      });
    });
  }

  async function listAllMessages() {
    return withTransaction(['messages'], 'readonly', async function(transaction) {
      var rows = await requestToPromise(transaction.objectStore('messages').getAll());
      return rows.sort(function(a, b) {
        var chatCompare = String(a.chatId || '').localeCompare(String(b.chatId || ''));
        if (chatCompare !== 0) return chatCompare;
        return (a.index || 0) - (b.index || 0);
      });
    });
  }

  async function putFolder(folder) {
    if (!folder || !folder.folderId) throw new Error('folderId is required');
    if (!folder.name) throw new Error('folder name is required');
    return withTransaction(['folders'], 'readwrite', async function(transaction) {
      var store = transaction.objectStore('folders');
      var folders = await requestToPromise(store.getAll());
      var foldersById = {};
      folders.forEach(function(row) {
        foldersById[row.folderId] = row;
      });
      if (folder.parentId && !foldersById[folder.parentId]) throw new Error('parent folder not found');
      var record = Object.assign({
        parentId: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, folder);
      if (folderDepth(record, foldersById) > 3) throw new Error('folders can only be nested up to 3 levels');
      await requestToPromise(store.put(record));
      return record;
    });
  }

  async function listFolders() {
    return withTransaction(['folders'], 'readonly', async function(transaction) {
      var rows = await requestToPromise(transaction.objectStore('folders').getAll());
      return rows.sort(function(a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
    });
  }

  async function renameFolder(folderId, name) {
    if (!folderId) throw new Error('folderId is required');
    if (!name) throw new Error('folder name is required');
    return withTransaction(['folders'], 'readwrite', async function(transaction) {
      var store = transaction.objectStore('folders');
      var folder = await requestToPromise(store.get(folderId));
      if (!folder) return null;
      folder.name = name;
      folder.updatedAt = new Date().toISOString();
      await requestToPromise(store.put(folder));
      return folder;
    });
  }

  async function deleteFolder(folderId) {
    if (!folderId) throw new Error('folderId is required');
    return withTransaction(['folders', 'chats'], 'readwrite', async function(transaction) {
      var folderStore = transaction.objectStore('folders');
      var folders = await requestToPromise(folderStore.getAll());
      if (!folders.some(function(folder) { return folder.folderId === folderId; })) return false;
      var ids = collectFolderIds(folderId, folders);
      for (var i = 0; i < ids.length; i++) folderStore.delete(ids[i]);

      var chatStore = transaction.objectStore('chats');
      var chats = await requestToPromise(chatStore.getAll());
      for (var j = 0; j < chats.length; j++) {
        if (ids.indexOf(chats[j].folderId) !== -1) {
          delete chats[j].folderId;
          chatStore.put(chats[j]);
        }
      }
      return true;
    });
  }

  async function setChatFolder(chatId, folderId) {
    if (!chatId) throw new Error('chatId is required');
    return withTransaction(['chats', 'folders'], 'readwrite', async function(transaction) {
      var chatStore = transaction.objectStore('chats');
      var chat = await requestToPromise(chatStore.get(chatId));
      if (!chat) return null;
      if (folderId) {
        var folder = await requestToPromise(transaction.objectStore('folders').get(folderId));
        if (!folder) throw new Error('folder not found');
        chat.folderId = folderId;
      } else {
        delete chat.folderId;
      }
      await requestToPromise(chatStore.put(chat));
      return chat;
    });
  }

  async function setChatTags(chatId, tags) {
    if (!chatId) throw new Error('chatId is required');
    if (!Array.isArray(tags)) throw new Error('tags must be an array');
    return withTransaction(['chats'], 'readwrite', async function(transaction) {
      var store = transaction.objectStore('chats');
      var chat = await requestToPromise(store.get(chatId));
      if (!chat) return null;
      var seen = {};
      chat.tags = tags.map(function(tag) {
        return String(tag || '').trim();
      }).filter(function(tag) {
        if (!tag || seen[tag]) return false;
        seen[tag] = true;
        return true;
      });
      await requestToPromise(store.put(chat));
      return chat;
    });
  }

  async function setChatPinned(chatId, pinned) {
    if (!chatId) throw new Error('chatId is required');
    return withTransaction(['chats'], 'readwrite', async function(transaction) {
      var store = transaction.objectStore('chats');
      var chat = await requestToPromise(store.get(chatId));
      if (!chat) return null;
      chat.pinned = !!pinned;
      await requestToPromise(store.put(chat));
      return chat;
    });
  }

  async function getStats() {
    return withTransaction(['chats'], 'readonly', async function(transaction) {
      var rows = await requestToPromise(transaction.objectStore('chats').getAll());
      var platformMap = {};
      var stats = {
        totalChats: rows.length,
        totalMessages: 0,
        oldestChat: null,
        newestChat: null,
        perPlatform: []
      };

      rows.forEach(function(chat) {
        var messageCount = Number(chat.messageCount || 0);
        var platform = chat.platform || 'unknown';
        stats.totalMessages += messageCount;
        if (!platformMap[platform]) platformMap[platform] = { platform: platform, chats: 0, messages: 0 };
        platformMap[platform].chats++;
        platformMap[platform].messages += messageCount;

        var dateValue = chat.lastUpdatedAt || chat.capturedAt || '';
        var oldestValue = stats.oldestChat ? (stats.oldestChat.lastUpdatedAt || stats.oldestChat.capturedAt || '') : '';
        var newestValue = stats.newestChat ? (stats.newestChat.lastUpdatedAt || stats.newestChat.capturedAt || '') : '';
        if (!stats.oldestChat || String(dateValue).localeCompare(String(oldestValue)) < 0) stats.oldestChat = chat;
        if (!stats.newestChat || String(dateValue).localeCompare(String(newestValue)) > 0) stats.newestChat = chat;
      });

      stats.perPlatform = Object.keys(platformMap).map(function(key) {
        return platformMap[key];
      }).sort(function(a, b) {
        if (b.chats !== a.chats) return b.chats - a.chats;
        return a.platform.localeCompare(b.platform);
      });
      return stats;
    });
  }

  async function putOpenThreads(threads) {
    if (!Array.isArray(threads)) throw new Error('threads must be an array');
    return withTransaction(['openThreads'], 'readwrite', async function(transaction) {
      var store = transaction.objectStore('openThreads');
      for (var i = 0; i < threads.length; i++) {
        store.put(Object.assign({}, threads[i]));
      }
      return threads.slice();
    });
  }

  async function listOpenThreads(filter) {
    return withTransaction(['openThreads'], 'readonly', async function(transaction) {
      var rows = await requestToPromise(transaction.objectStore('openThreads').getAll());
      return filterRows(rows, filter).sort(function(a, b) {
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      });
    });
  }

  async function setThreadStatus(threadId, status) {
    if (!threadId) throw new Error('threadId is required');
    if (!status) throw new Error('status is required');
    return withTransaction(['openThreads'], 'readwrite', async function(transaction) {
      var store = transaction.objectStore('openThreads');
      var thread = await requestToPromise(store.get(threadId));
      if (!thread) return null;
      thread.status = status;
      thread.resolvedAt = status === 'done' ? new Date().toISOString() : null;
      await requestToPromise(store.put(thread));
      return thread;
    });
  }

  async function deleteChat(chatId) {
    if (!chatId) throw new Error('chatId is required');
    return withTransaction(['chats', 'messages', 'openThreads', 'extractionRuns'], 'readwrite', async function(transaction) {
      var chatStore = transaction.objectStore('chats');
      var chat = await requestToPromise(chatStore.get(chatId));
      if (!chat) return false;

      chatStore.delete(chatId);
      await deleteByIndex(transaction.objectStore('messages'), 'chatId', chatId);
      await deleteByIndex(transaction.objectStore('openThreads'), 'chatId', chatId);
      await deleteByIndex(transaction.objectStore('extractionRuns'), 'chatId', chatId);
      return true;
    });
  }

  async function putExtractionRun(run) {
    if (!run || !run.runId) throw new Error('runId is required');
    return withTransaction(['extractionRuns'], 'readwrite', async function(transaction) {
      var record = Object.assign({}, run);
      await requestToPromise(transaction.objectStore('extractionRuns').put(record));
      return record;
    });
  }

  async function listExtractionRuns(filter) {
    return withTransaction(['extractionRuns'], 'readonly', async function(transaction) {
      var rows = await requestToPromise(transaction.objectStore('extractionRuns').getAll());
      return filterRows(rows, filter).sort(function(a, b) {
        return String(b.completedAt || '').localeCompare(String(a.completedAt || ''));
      });
    });
  }

  async function getMeta(key) {
    if (!key) throw new Error('meta key is required');
    return withTransaction(['meta'], 'readonly', async function(transaction) {
      var row = await requestToPromise(transaction.objectStore('meta').get(key));
      return row ? row.value : null;
    });
  }

  async function setMeta(key, value) {
    if (!key) throw new Error('meta key is required');
    return withTransaction(['meta'], 'readwrite', async function(transaction) {
      await requestToPromise(transaction.objectStore('meta').put({
        key: key,
        value: value,
        updatedAt: new Date().toISOString()
      }));
      return value;
    });
  }

  return {
    putChat: putChat,
    getChat: getChat,
    listChats: listChats,
    putMessages: putMessages,
    listMessages: listMessages,
    listAllMessages: listAllMessages,
    putFolder: putFolder,
    listFolders: listFolders,
    renameFolder: renameFolder,
    deleteFolder: deleteFolder,
    setChatFolder: setChatFolder,
    setChatTags: setChatTags,
    setChatPinned: setChatPinned,
    getStats: getStats,
    putOpenThreads: putOpenThreads,
    listOpenThreads: listOpenThreads,
    setThreadStatus: setThreadStatus,
    deleteChat: deleteChat,
    putExtractionRun: putExtractionRun,
    listExtractionRuns: listExtractionRuns,
    getMeta: getMeta,
    setMeta: setMeta
  };
}

var VaultDAO = createVaultDAO();

if (typeof module !== 'undefined') {
  module.exports = {
    createVaultDAO: createVaultDAO,
    VaultDAO: VaultDAO
  };
}
