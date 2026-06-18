var ImportRunMetadata = (function() {
  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function idPart(value) {
    return text(value).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'unknown';
  }

  function stableHash(value) {
    var hash = 5381;
    value = text(value);
    for (var i = 0; i < value.length; i++) {
      hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  function number(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function adapterId(options) {
    var id = text(options.adapterId || options.adapter || '').trim();
    if (!id) throw new Error('adapterId is required');
    return id;
  }

  function adapterVersion(options) {
    return text(options.adapterVersion || 'v1').trim() || 'v1';
  }

  function compact(row) {
    var out = {};
    Object.keys(row || {}).forEach(function(key) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') out[key] = row[key];
    });
    return out;
  }

  function normalizeSource(options) {
    var source = options.source || {};
    return compact({
      kind: text(source.kind || options.sourceKind),
      object: text(source.object || source.objectId || source.id || options.sourceObject || options.sourceObjectId),
      path: text(source.path || options.sourcePath),
      url: text(source.url || options.sourceUrl),
      name: text(source.name || options.sourceName)
    });
  }

  function normalizeIssue(issue, defaultCode, defaultRecoverable) {
    if (typeof issue === 'string') {
      return { code: defaultCode, message: issue, sourceRef: '', recoverable: defaultRecoverable };
    }
    issue = issue || {};
    return {
      code: text(issue.code || defaultCode),
      message: text(issue.message || issue.reason || 'Import issue'),
      sourceRef: text(issue.sourceRef || issue.path || issue.objectId || issue.id),
      recoverable: issue.recoverable !== undefined ? !!issue.recoverable : defaultRecoverable
    };
  }

  function normalizeIssues(issues, defaultCode, defaultRecoverable) {
    return (Array.isArray(issues) ? issues : []).map(function(issue) {
      return normalizeIssue(issue, defaultCode, defaultRecoverable);
    });
  }

  function itemCounts(options, warnings, errors) {
    var counts = options.itemCounts || {};
    return {
      parsed: number(counts.parsed, 0),
      imported: number(counts.imported, 0),
      skipped: number(counts.skipped, 0),
      updated: number(counts.updated, 0),
      warnings: number(counts.warnings, warnings.length),
      errors: number(counts.errors, errors.length)
    };
  }

  function createRunId(options, adapter, source, importedAt, packageHash) {
    if (options.runId) return text(options.runId);
    var sourceId = source.object || source.path || source.url || source.name || packageHash || importedAt;
    return ['import', idPart(adapter), idPart(sourceId), stableHash(packageHash || importedAt)].join(':');
  }

  function createRun(options) {
    options = options || {};
    var id = adapterId(options);
    var version = adapterVersion(options);
    var importedAt = text(options.importedAt || new Date().toISOString());
    var completedAt = text(options.completedAt || importedAt);
    var source = normalizeSource(options);
    var packageHash = text(options.packageHash || options.importPackageHash || '');
    var warnings = normalizeIssues(options.warnings, 'IMPORT_WARNING', true);
    var errors = normalizeIssues(options.errors, 'IMPORT_ERROR', false);
    var counts = itemCounts(options, warnings, errors);
    var durationMs = number(options.durationMs, 0);

    return {
      runId: createRunId(options, id, source, importedAt, packageHash),
      chatId: text(options.chatId),
      modelName: 'import',
      modelVersion: id + ':' + version,
      completedAt: completedAt,
      threadCount: number(options.threadCount, 0),
      durationMs: durationMs,
      metadata: {
        adapter: { id: id, version: version },
        adapterId: id,
        adapterVersion: version,
        source: source,
        packageHash: packageHash,
        importedAt: importedAt,
        durationMs: durationMs,
        itemCounts: counts,
        warnings: warnings,
        errors: errors,
        status: text(options.status || (errors.length ? 'error' : 'done'))
      }
    };
  }

  function createSnapshotMetadata(options) {
    options = options || {};
    var id = adapterId(options);
    var version = adapterVersion(options);
    var warnings = normalizeIssues(options.warnings, 'IMPORT_WARNING', true);
    var errors = normalizeIssues(options.errors, 'IMPORT_ERROR', false);
    return {
      adapter: { id: id, version: version },
      import: {
        runId: text(options.runId),
        source: normalizeSource(options),
        packageHash: text(options.packageHash || options.importPackageHash || ''),
        importedAt: text(options.importedAt || new Date().toISOString()),
        itemCounts: itemCounts(options, warnings, errors),
        durationMs: number(options.durationMs, 0),
        warningCount: warnings.length,
        errorCount: errors.length
      },
      provenance: Object.assign({}, options.provenance || {})
    };
  }

  return {
    createRun: createRun,
    createSnapshotMetadata: createSnapshotMetadata,
    normalizeSource: normalizeSource,
    normalizeIssues: normalizeIssues
  };
})();

if (typeof module !== 'undefined') module.exports = ImportRunMetadata;
