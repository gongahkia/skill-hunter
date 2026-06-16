var VAULT_DB_NAME = 'rakuzaichi-vault';
var VAULT_SCHEMA_VERSION = 1;

var VAULT_STORE_DEFINITIONS = [
  {
    name: 'chats',
    options: { keyPath: 'chatId' },
    indexes: [
      ['platform', 'platform'],
      ['capturedAt', 'capturedAt'],
      ['lastUpdatedAt', 'lastUpdatedAt'],
      ['title', 'title']
    ]
  },
  {
    name: 'messages',
    options: { keyPath: 'messageId' },
    indexes: [
      ['chatId', 'chatId'],
      ['role', 'role'],
      ['timestamp', 'timestamp']
    ]
  },
  {
    name: 'openThreads',
    options: { keyPath: 'threadId' },
    indexes: [
      ['chatId', 'chatId'],
      ['messageId', 'messageId'],
      ['tag', 'tag'],
      ['source', 'source'],
      ['status', 'status']
    ]
  },
  {
    name: 'folders',
    options: { keyPath: 'folderId' },
    indexes: []
  },
  {
    name: 'extractionRuns',
    options: { keyPath: 'runId' },
    indexes: [
      ['chatId', 'chatId'],
      ['completedAt', 'completedAt']
    ]
  },
  {
    name: 'meta',
    options: { keyPath: 'key' },
    indexes: []
  }
];

var VaultDB = (function() {
  function getFactory(options) {
    if (options && options.indexedDB) return options.indexedDB;
    if (typeof indexedDB !== 'undefined') return indexedDB;
    if (typeof globalThis !== 'undefined' && globalThis.indexedDB) return globalThis.indexedDB;
    throw new Error('IndexedDB is unavailable');
  }

  function hasStore(db, name) {
    return db.objectStoreNames && db.objectStoreNames.contains(name);
  }

  function createIndexes(store, indexes) {
    for (var i = 0; i < indexes.length; i++) {
      var index = indexes[i];
      if (!store.indexNames.contains(index[0])) store.createIndex(index[0], index[1]);
    }
  }

  function createSchema(db, transaction) {
    for (var i = 0; i < VAULT_STORE_DEFINITIONS.length; i++) {
      var definition = VAULT_STORE_DEFINITIONS[i];
      var store = hasStore(db, definition.name)
        ? transaction.objectStore(definition.name)
        : db.createObjectStore(definition.name, definition.options);
      createIndexes(store, definition.indexes);
    }

    var meta = transaction.objectStore('meta');
    meta.put({ key: 'schemaVersion', value: VAULT_SCHEMA_VERSION });
    meta.put({ key: 'createdAt', value: new Date().toISOString() });
  }

  function openVaultDB(options) {
    options = options || {};
    var factory = getFactory(options);
    var name = options.name || VAULT_DB_NAME;
    var version = options.version || VAULT_SCHEMA_VERSION;

    return new Promise(function(resolve, reject) {
      var request = factory.open(name, version);
      request.onupgradeneeded = function(event) {
        createSchema(request.result, event.target.transaction);
      };
      request.onsuccess = function() {
        resolve(request.result);
      };
      request.onerror = function() {
        reject(request.error || new Error('Failed to open vault database'));
      };
      request.onblocked = function() {
        reject(new Error('Vault database open blocked'));
      };
    });
  }

  function closeVaultDB(db) {
    if (db && typeof db.close === 'function') db.close();
  }

  return {
    dbName: VAULT_DB_NAME,
    schemaVersion: VAULT_SCHEMA_VERSION,
    stores: VAULT_STORE_DEFINITIONS,
    open: openVaultDB,
    close: closeVaultDB,
    createSchema: createSchema
  };
})();

if (typeof module !== 'undefined') {
  module.exports = {
    VAULT_DB_NAME: VAULT_DB_NAME,
    VAULT_SCHEMA_VERSION: VAULT_SCHEMA_VERSION,
    VAULT_STORE_DEFINITIONS: VAULT_STORE_DEFINITIONS,
    VaultDB: VaultDB
  };
}
