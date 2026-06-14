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

  return {
    putChat: putChat,
    getChat: getChat,
    listChats: listChats,
    putMessages: putMessages,
    listMessages: listMessages,
    putOpenThreads: putOpenThreads,
    listOpenThreads: listOpenThreads,
    setThreadStatus: setThreadStatus,
    deleteChat: deleteChat
  };
}

var VaultDAO = createVaultDAO();

if (typeof module !== 'undefined') {
  module.exports = {
    createVaultDAO: createVaultDAO,
    VaultDAO: VaultDAO
  };
}
