var ImportNormalizerMetadataModule = (typeof ImportRunMetadata !== 'undefined') ? ImportRunMetadata : null;
if (!ImportNormalizerMetadataModule && typeof require !== 'undefined') {
  ImportNormalizerMetadataModule = require('./run-metadata.js');
}

var ImportNormalizer = (function() {
  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function number(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function compact(row) {
    var out = {};
    Object.keys(row || {}).forEach(function(key) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') out[key] = row[key];
    });
    return out;
  }

  function metadata(options) {
    var module = options.metadataModule || ImportNormalizerMetadataModule || (typeof ImportRunMetadata !== 'undefined' ? ImportRunMetadata : null);
    if (!module || !module.createSnapshotMetadata) throw new Error('ImportRunMetadata is unavailable');
    return module;
  }

  function adapterId(options) {
    var id = text(options.adapterId || options.adapter || '').trim();
    if (!id) throw new Error('adapterId is required');
    return id;
  }

  function source(options, module) {
    if (module.normalizeSource) return module.normalizeSource(options);
    return compact({
      kind: text(options.sourceKind),
      object: text(options.sourceObject || options.sourceObjectId),
      path: text(options.sourcePath),
      url: text(options.sourceUrl),
      name: text(options.sourceName)
    });
  }

  function createProvenance(options) {
    options = options || {};
    var module = metadata(options);
    var src = source(options, module);
    return Object.assign(compact({
      sourceKind: src.kind,
      sourceId: text(options.sourceId || src.object),
      sourceObject: src.object,
      sourcePath: src.path,
      sourceUrl: src.url,
      sourceName: src.name,
      originalId: text(options.originalId || options.sourceRowId || options.blockId || options.emailMessageId),
      parentId: text(options.parentId || options.sourceParentId),
      authorId: text(options.authorId),
      authorName: text(options.authorName),
      sourceTimestamp: text(options.sourceTimestamp)
    }), options.provenance || {});
  }

  function rowMetadata(options) {
    options = Object.assign({}, options || {});
    options.provenance = createProvenance(options);
    return metadata(options).createSnapshotMetadata(options);
  }

  function createChat(options) {
    options = options || {};
    var id = adapterId(options);
    var chatId = text(options.chatId).trim();
    if (!chatId) throw new Error('chatId is required');
    var importedAt = text(options.importedAt || new Date().toISOString());

    return {
      chatId: chatId,
      platform: id,
      title: text(options.title || options.sourceTitle || options.sourceName || 'Untitled import'),
      url: text(options.url || options.sourceUrl),
      model: text(options.model),
      capturedAt: text(options.capturedAt || importedAt),
      lastUpdatedAt: text(options.lastUpdatedAt || options.sourceUpdatedAt || importedAt),
      messageCount: number(options.messageCount, 0),
      pinned: !!options.pinned,
      archived: !!options.archived,
      tags: Array.isArray(options.tags) ? options.tags.slice() : [],
      metadata: rowMetadata(Object.assign({}, options, { adapterId: id, importedAt: importedAt }))
    };
  }

  function createMessage(options) {
    options = options || {};
    var id = adapterId(options);
    var chatId = text(options.chatId).trim();
    var messageId = text(options.messageId || options.id).trim();
    if (!chatId) throw new Error('chatId is required');
    if (!messageId) throw new Error('messageId is required');
    var importedAt = text(options.importedAt || new Date().toISOString());

    return {
      messageId: messageId,
      id: text(options.id || messageId),
      chatId: chatId,
      platform: id,
      role: text(options.role || 'document'),
      content: text(options.content),
      timestamp: text(options.timestamp || options.sourceTimestamp || importedAt),
      index: number(options.index, 0),
      model: text(options.model),
      metadata: rowMetadata(Object.assign({}, options, { adapterId: id, importedAt: importedAt }))
    };
  }

  return {
    createChat: createChat,
    createMessage: createMessage,
    createProvenance: createProvenance
  };
})();

if (typeof module !== 'undefined') module.exports = ImportNormalizer;
