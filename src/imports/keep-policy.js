var KeepImportPolicy = (function() {
  var ADAPTER_ID = 'keep';
  var TAKEOUT_ONLY_MESSAGE = 'Google Keep import uses local Google Takeout exports. Keep URLs and browser pages are not accepted.';

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function sourceText(source) {
    if (typeof source === 'string') return source;
    source = source || {};
    return text(source.url || source.href || source.path || source.name || source.type || source.kind);
  }

  function isKeepLiveSource(source) {
    var value = sourceText(source).trim();
    return /^https?:\/\/([^/]+\.)?keep\.google\.com(?:\/|$)/i.test(value) ||
      /^keep(?:-web|-url|-page|-api)?$/i.test(value) ||
      /keep\.google\.com/i.test(value);
  }

  function rejectUnsupportedSource(source) {
    if (!isKeepLiveSource(source)) return null;
    var error = new Error(TAKEOUT_ONLY_MESSAGE);
    error.code = 'KEEP_UNSUPPORTED_LIVE_SOURCE';
    error.adapterId = ADAPTER_ID;
    error.recoverable = true;
    return error;
  }

  function assertSupportedSource(source) {
    var error = rejectUnsupportedSource(source);
    if (error) throw error;
    return true;
  }

  return {
    ADAPTER_ID: ADAPTER_ID,
    TAKEOUT_ONLY_MESSAGE: TAKEOUT_ONLY_MESSAGE,
    isKeepLiveSource: isKeepLiveSource,
    rejectUnsupportedSource: rejectUnsupportedSource,
    assertSupportedSource: assertSupportedSource
  };
})();

if (typeof module !== 'undefined') module.exports = KeepImportPolicy;
