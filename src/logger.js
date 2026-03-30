var AppLogger = (function() {
  var STORAGE_KEY = 'runtimeDiagnostics';
  var MAX_EVENTS = 400;
  var writeQueue = Promise.resolve();

  function normalizeLevel(level) {
    var value = String(level || 'info').toLowerCase();
    if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') return value;
    return 'info';
  }

  function createTraceId(prefix) {
    var stem = String(prefix || 'trace').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'trace';
    return stem + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function safeDetails(details) {
    if (details == null) return {};
    if (typeof details === 'string') return { message: details };
    if (details instanceof Error) return serializeError(details);
    if (typeof details !== 'object') return { value: details };
    try {
      return JSON.parse(JSON.stringify(details));
    } catch (error) {
      return {
        message: 'Details could not be serialized',
        serializationError: error.message
      };
    }
  }

  function serializeError(error) {
    if (!error) {
      return {
        name: 'Error',
        message: 'Unknown error',
        stack: ''
      };
    }

    return {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack || ''
    };
  }

  function print(entry) {
    var method = entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log';
    var prefix = '[Rakuzaichi][' + entry.level.toUpperCase() + '][' + entry.event + ']';
    try {
      if (entry.details && Object.keys(entry.details).length) console[method](prefix, entry.details);
      else console[method](prefix);
    } catch (error) {
      console.log(prefix);
    }
  }

  function persist(entry) {
    if (!api || !api.storage || !api.storage.local || !api.storage.local.get || !api.storage.local.set) {
      return Promise.resolve();
    }

    writeQueue = writeQueue.then(async function() {
      try {
        var result = await api.storage.local.get({ [STORAGE_KEY]: [] });
        var logs = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
        logs.unshift(entry);
        if (logs.length > MAX_EVENTS) logs.length = MAX_EVENTS;
        await api.storage.local.set({ [STORAGE_KEY]: logs });
      } catch (error) {
        console.warn('[Rakuzaichi][WARN][logger.persist.failed]', serializeError(error));
      }
    });

    return writeQueue;
  }

  function track(level, event, details) {
    var traceId = details && details.traceId ? details.traceId : createTraceId('evt');
    var entry = {
      traceId: traceId,
      timestamp: new Date().toISOString(),
      level: normalizeLevel(level),
      event: String(event || 'unknown.event'),
      details: safeDetails(details)
    };

    print(entry);
    persist(entry);
    return entry;
  }

  async function getRecent(limit) {
    if (!api || !api.storage || !api.storage.local || !api.storage.local.get) return [];
    try {
      var result = await api.storage.local.get({ [STORAGE_KEY]: [] });
      var logs = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
      var cap = typeof limit === 'number' && limit > 0 ? limit : logs.length;
      return logs.slice(0, cap);
    } catch (error) {
      console.warn('[Rakuzaichi][WARN][logger.read.failed]', serializeError(error));
      return [];
    }
  }

  async function clear() {
    if (!api || !api.storage || !api.storage.local || !api.storage.local.set) return;
    try {
      await api.storage.local.set({ [STORAGE_KEY]: [] });
    } catch (error) {
      console.warn('[Rakuzaichi][WARN][logger.clear.failed]', serializeError(error));
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    MAX_EVENTS: MAX_EVENTS,
    createTraceId: createTraceId,
    serializeError: serializeError,
    track: track,
    debug: function(event, details) { return track('debug', event, details); },
    info: function(event, details) { return track('info', event, details); },
    warn: function(event, details) { return track('warn', event, details); },
    error: function(event, details) { return track('error', event, details); },
    getRecent: getRecent,
    clear: clear
  };
})();

if (typeof module !== 'undefined') module.exports = AppLogger;
