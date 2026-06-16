var VaultBackup = (function() {
  var MANIFEST_FILE = 'manifest.json';
  var PAYLOAD_FILE = 'vault.json';
  var ENCRYPTED_PAYLOAD_FILE = 'vault.json.aesgcm';
  var BACKUP_VERSION = '1';
  var KDF_ITERATIONS = 200000;

  function textBytes(value) {
    return new TextEncoder().encode(String(value || ''));
  }

  function textFromBytes(bytes) {
    return new TextDecoder().decode(bytes);
  }

  function getCrypto() {
    var provider = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (!provider || !provider.subtle || !provider.getRandomValues) throw new Error('Web Crypto API is unavailable');
    return provider;
  }

  function toBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.slice(i, i + 0x8000));
    }
    if (typeof btoa !== 'undefined') return btoa(binary);
    return Buffer.from(binary, 'binary').toString('base64');
  }

  function fromBase64(value) {
    var binary = typeof atob !== 'undefined' ? atob(value) : Buffer.from(value, 'base64').toString('binary');
    var out = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  async function deriveKey(password, salt) {
    var cryptoProvider = getCrypto();
    var material = await cryptoProvider.subtle.importKey('raw', textBytes(password), 'PBKDF2', false, ['deriveKey']);
    return cryptoProvider.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptPayload(json, password) {
    var cryptoProvider = getCrypto();
    var salt = cryptoProvider.getRandomValues(new Uint8Array(16));
    var iv = cryptoProvider.getRandomValues(new Uint8Array(12));
    var key = await deriveKey(password, salt);
    var encrypted = await cryptoProvider.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, textBytes(json));
    return {
      bytes: new Uint8Array(encrypted),
      manifest: {
        encrypted: true,
        payload: ENCRYPTED_PAYLOAD_FILE,
        algorithm: 'AES-GCM',
        kdf: 'PBKDF2',
        hash: 'SHA-256',
        iterations: KDF_ITERATIONS,
        salt: toBase64(salt),
        iv: toBase64(iv)
      }
    };
  }

  async function decryptPayload(bytes, manifest, password) {
    if (!password) throw new Error('Backup password is required');
    var key = await deriveKey(password, fromBase64(manifest.salt));
    var decrypted = await getCrypto().subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(manifest.iv) }, key, bytes);
    return textFromBytes(new Uint8Array(decrypted));
  }

  async function snapshot(options) {
    options = options || {};
    var dao = options.dao;
    if (!dao || !dao.listChats || !dao.listAllMessages || !dao.listOpenThreads) throw new Error('Vault DAO is unavailable');
    return {
      backupVersion: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      chats: await dao.listChats(),
      messages: await dao.listAllMessages(),
      openThreads: await dao.listOpenThreads(),
      folders: dao.listFolders ? await dao.listFolders() : [],
      extractionRuns: dao.listExtractionRuns ? await dao.listExtractionRuns() : [],
      settings: options.settings || {}
    };
  }

  function filename() {
    return 'rakuzaichi_' + new Date().toISOString().slice(0, 10) + '.rakuzaichi-backup.zip';
  }

  async function create(options) {
    options = options || {};
    if (typeof ZipWriter === 'undefined' || !ZipWriter.create) throw new Error('ZIP writer is unavailable');
    var data = options.snapshot || await snapshot(options);
    var json = JSON.stringify(data, null, 2);
    var payload = options.password ? await encryptPayload(json, options.password) : {
      bytes: textBytes(json),
      manifest: { encrypted: false, payload: PAYLOAD_FILE }
    };
    var manifest = Object.assign({
      backupVersion: BACKUP_VERSION,
      createdAt: new Date().toISOString()
    }, payload.manifest);
    return {
      filename: filename(),
      blob: ZipWriter.create([
        { name: MANIFEST_FILE, content: JSON.stringify(manifest, null, 2) },
        { name: manifest.payload, content: payload.bytes }
      ]),
      encrypted: !!options.password,
      snapshot: data
    };
  }

  async function read(input, password) {
    if (typeof ZipWriter === 'undefined' || !ZipWriter.read) throw new Error('ZIP reader is unavailable');
    var entries = await ZipWriter.read(input);
    if (!entries[MANIFEST_FILE]) throw new Error('Backup manifest missing');
    var manifest = JSON.parse(textFromBytes(entries[MANIFEST_FILE]));
    var payload = entries[manifest.payload || PAYLOAD_FILE];
    if (!payload) throw new Error('Backup payload missing');
    var json = manifest.encrypted ? await decryptPayload(payload, manifest, password || '') : textFromBytes(payload);
    return JSON.parse(json);
  }

  function folderDepth(folder, byId) {
    var depth = 0;
    var parentId = folder.parentId || '';
    while (parentId && byId[parentId]) {
      depth++;
      parentId = byId[parentId].parentId || '';
    }
    return depth;
  }

  function groupMessages(messages) {
    var grouped = {};
    (Array.isArray(messages) ? messages : []).forEach(function(message) {
      var chatId = message.chatId || '';
      if (!grouped[chatId]) grouped[chatId] = [];
      grouped[chatId].push(message);
    });
    return grouped;
  }

  async function restore(data, options) {
    options = options || {};
    var dao = options.dao;
    if (!data || !Array.isArray(data.chats)) throw new Error('Invalid backup payload');
    if (!dao || !dao.putChat || !dao.putMessages || !dao.putOpenThreads) throw new Error('Vault DAO is unavailable');
    if (options.replace !== false && dao.clearAll) await dao.clearAll();

    var folders = Array.isArray(data.folders) ? data.folders.slice() : [];
    var byId = {};
    folders.forEach(function(folder) {
      byId[folder.folderId] = folder;
    });
    folders.sort(function(a, b) {
      return folderDepth(a, byId) - folderDepth(b, byId);
    });
    for (var f = 0; f < folders.length; f++) {
      if (dao.putFolder) await dao.putFolder(folders[f]);
    }

    for (var c = 0; c < data.chats.length; c++) await dao.putChat(data.chats[c]);
    var messagesByChat = groupMessages(data.messages);
    for (var chatId in messagesByChat) await dao.putMessages(chatId, messagesByChat[chatId]);
    if (Array.isArray(data.openThreads) && data.openThreads.length) await dao.putOpenThreads(data.openThreads);
    if (dao.putExtractionRun && Array.isArray(data.extractionRuns)) {
      for (var r = 0; r < data.extractionRuns.length; r++) await dao.putExtractionRun(data.extractionRuns[r]);
    }
    if (options.storageManager && data.settings) await options.storageManager.setAll(data.settings);
    return {
      chats: data.chats.length,
      messages: Array.isArray(data.messages) ? data.messages.length : 0,
      openThreads: Array.isArray(data.openThreads) ? data.openThreads.length : 0,
      folders: folders.length,
      extractionRuns: Array.isArray(data.extractionRuns) ? data.extractionRuns.length : 0
    };
  }

  return {
    create: create,
    read: read,
    restore: restore,
    snapshot: snapshot
  };
})();

if (typeof module !== 'undefined') module.exports = VaultBackup;
