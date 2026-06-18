var ImportRunMetadataModule = (typeof ImportRunMetadata !== 'undefined') ? ImportRunMetadata : null;
if (!ImportRunMetadataModule && typeof require !== 'undefined') {
  ImportRunMetadataModule = require('./run-metadata.js');
}

var ImportSession = (function() {
  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function number(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function abortError() {
    var error = new Error('Import cancelled');
    error.name = 'AbortError';
    error.code = 'ABORT_ERR';
    return error;
  }

  function pushUnique(rows, value) {
    value = text(value);
    if (value && rows.indexOf(value) === -1) rows.push(value);
  }

  function metadata(options) {
    var module = options.metadata || ImportRunMetadataModule || (typeof ImportRunMetadata !== 'undefined' ? ImportRunMetadata : null);
    if (!module || !module.createRun) throw new Error('ImportRunMetadata is unavailable');
    return module;
  }

  function create(options) {
    options = options || {};
    var module = metadata(options);
    var source = module.normalizeSource ? module.normalizeSource(options) : {};
    var onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    var now = typeof options.now === 'function' ? options.now : function() { return Date.now(); };
    var isoNow = typeof options.isoNow === 'function' ? options.isoNow : function() { return new Date().toISOString(); };
    var startedAtMs = number(options.startedAtMs, now());
    var importedAt = text(options.importedAt || isoNow());
    var total = number(options.total, 0);
    var phase = 'idle';
    var counts = { parsed: 0, imported: 0, skipped: 0, updated: 0 };
    var warnings = [];
    var errors = [];
    var completedSnapshotIds = [];
    var skippedSourceIds = [];
    var cancelled = false;

    function isCancelled() {
      return cancelled || !!(options.signal && options.signal.aborted);
    }

    function event(status, extra) {
      return Object.assign({
        status: status,
        phase: phase,
        adapterId: text(options.adapterId || options.adapter),
        source: source,
        total: total,
        itemCounts: Object.assign({}, counts),
        warnings: warnings.length,
        errors: errors.length,
        cancelled: isCancelled()
      }, extra || {});
    }

    function emit(status, extra) {
      if (onProgress) onProgress(event(status, extra));
    }

    function setPhase(value, extra) {
      phase = text(value) || phase;
      emit('progress', extra);
    }

    function setTotal(value) {
      total = number(value, total);
      emit('progress');
    }

    function increment(key, value) {
      counts[key] += number(value, 1);
      emit('progress');
    }

    function normalizeIssue(issue, code, recoverable) {
      if (module.normalizeIssues) return module.normalizeIssues([issue], code, recoverable)[0];
      if (typeof issue === 'string') return { code: code, message: issue, sourceRef: '', recoverable: recoverable };
      issue = issue || {};
      return {
        code: text(issue.code || code),
        message: text(issue.message || 'Import issue'),
        sourceRef: text(issue.sourceRef || issue.path || issue.objectId || issue.id),
        recoverable: issue.recoverable !== undefined ? !!issue.recoverable : recoverable
      };
    }

    function addWarning(issue) {
      warnings.push(normalizeIssue(issue, 'IMPORT_WARNING', true));
      emit('warning', { warning: warnings[warnings.length - 1] });
    }

    function addError(issue) {
      errors.push(normalizeIssue(issue, 'IMPORT_ERROR', false));
      emit('error', { error: errors[errors.length - 1] });
    }

    function completeSnapshot(snapshotId) {
      pushUnique(completedSnapshotIds, snapshotId);
    }

    function skipSource(sourceId) {
      pushUnique(skippedSourceIds, sourceId);
    }

    function cancel() {
      cancelled = true;
      emit('cancelled');
    }

    function throwIfCancelled() {
      if (!isCancelled()) return;
      cancelled = true;
      throw abortError();
    }

    function state() {
      return {
        phase: phase,
        total: total,
        itemCounts: Object.assign({}, counts),
        warnings: warnings.slice(),
        errors: errors.slice(),
        completedSnapshotIds: completedSnapshotIds.slice(),
        skippedSourceIds: skippedSourceIds.slice(),
        cancelled: isCancelled()
      };
    }

    function finish(status, patch) {
      var doneAt = text(options.completedAt || isoNow());
      var durationMs = number(options.durationMs, Math.max(0, now() - startedAtMs));
      var finalStatus = text(status);
      if (isCancelled()) finalStatus = 'cancelled';
      if (!finalStatus) finalStatus = errors.length ? 'error' : 'done';

      var run = module.createRun(Object.assign({}, options, {
        importedAt: importedAt,
        completedAt: doneAt,
        durationMs: durationMs,
        itemCounts: Object.assign({}, counts, {
          warnings: warnings.length,
          errors: errors.length
        }),
        warnings: warnings,
        errors: errors,
        status: finalStatus
      }));
      run.metadata.partial = {
        recoverable: finalStatus === 'cancelled' || completedSnapshotIds.length > 0,
        completedSnapshotIds: completedSnapshotIds.slice(),
        skippedSourceIds: skippedSourceIds.slice()
      };
      if (patch && typeof patch === 'object') Object.assign(run.metadata, patch);
      emit(finalStatus, { runId: run.runId, run: run });
      return run;
    }

    return {
      setPhase: setPhase,
      setTotal: setTotal,
      recordParsed: function(value) { increment('parsed', value); },
      recordImported: function(value) { increment('imported', value); },
      recordSkipped: function(value) { increment('skipped', value); },
      recordUpdated: function(value) { increment('updated', value); },
      addWarning: addWarning,
      addError: addError,
      completeSnapshot: completeSnapshot,
      skipSource: skipSource,
      cancel: cancel,
      throwIfCancelled: throwIfCancelled,
      isCancelled: isCancelled,
      state: state,
      finish: finish
    };
  }

  return {
    create: create
  };
})();

if (typeof module !== 'undefined') module.exports = ImportSession;
