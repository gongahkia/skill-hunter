var ImportDedupeMetadataModule = (typeof ImportRunMetadata !== 'undefined') ? ImportRunMetadata : null;
if (!ImportDedupeMetadataModule && typeof require !== 'undefined') {
  ImportDedupeMetadataModule = require('./run-metadata.js');
}

var ImportDedupe = (function() {
  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function metadataModule(options) {
    return options.metadataModule || ImportDedupeMetadataModule || (typeof ImportRunMetadata !== 'undefined' ? ImportRunMetadata : null);
  }

  function metadata(row) {
    return row && row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  }

  function importMetadata(row) {
    var meta = metadata(row);
    return meta.import && typeof meta.import === 'object' ? meta.import : {};
  }

  function provenance(row) {
    var meta = metadata(row);
    return meta.provenance && typeof meta.provenance === 'object' ? meta.provenance : {};
  }

  function adapterId(row) {
    var meta = metadata(row);
    return text(row.adapterId || row.adapter || row.platform || meta.adapterId || (meta.adapter && meta.adapter.id)).trim();
  }

  function sourceFrom(row) {
    var module = metadataModule(row || {});
    if (module && module.normalizeSource) {
      var normalized = module.normalizeSource(row || {});
      if (Object.keys(normalized).length) return normalized;
    }
    var imported = importMetadata(row);
    if (imported.source && typeof imported.source === 'object') return imported.source;
    var prov = provenance(row);
    return {
      kind: text(row.sourceKind || prov.sourceKind),
      object: text(row.sourceObject || row.sourceObjectId || row.sourceId || prov.sourceObject || prov.sourceId),
      path: text(row.sourcePath || prov.sourcePath),
      url: text(row.sourceUrl || prov.sourceUrl),
      name: text(row.sourceName || prov.sourceName)
    };
  }

  function sourceToken(row) {
    var source = sourceFrom(row);
    return text(source.object || source.path || source.url || source.name || contentHash(row)).trim();
  }

  function sourceKey(row) {
    row = row || {};
    var adapter = adapterId(row);
    var source = sourceFrom(row);
    var token = sourceToken(row);
    if (!adapter) throw new Error('adapterId is required');
    if (!token) throw new Error('source identity is required');
    return [adapter, text(source.kind), token].join('\n');
  }

  function contentHash(row) {
    row = row || {};
    var imported = importMetadata(row);
    return text(row.contentHash || row.sourceContentHash || row.packageHash || row.importPackageHash || imported.contentHash || imported.packageHash).trim();
  }

  function safeSourceKey(row) {
    try {
      return sourceKey(row);
    } catch (error) {
      return '';
    }
  }

  function findExisting(existingRows, incoming) {
    var key = sourceKey(incoming);
    var rows = Array.isArray(existingRows) ? existingRows : [];
    for (var i = 0; i < rows.length; i++) {
      if (safeSourceKey(rows[i]) === key) return rows[i];
    }
    return null;
  }

  function decide(existingRows, incoming) {
    var key = sourceKey(incoming);
    var incomingHash = contentHash(incoming);
    var existing = findExisting(existingRows, incoming);
    if (!existing) {
      return { action: 'create', sourceKey: key, contentHash: incomingHash, existing: null };
    }
    var existingHash = contentHash(existing);
    if (incomingHash && existingHash && incomingHash === existingHash) {
      return { action: 'skip', sourceKey: key, contentHash: incomingHash, existing: existing };
    }
    return { action: 'update', sourceKey: key, contentHash: incomingHash, existing: existing };
  }

  return {
    sourceKey: sourceKey,
    contentHash: contentHash,
    findExisting: findExisting,
    decide: decide
  };
})();

if (typeof module !== 'undefined') module.exports = ImportDedupe;
