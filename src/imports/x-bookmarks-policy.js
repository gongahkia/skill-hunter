var XBookmarksImportPolicy = (function() {
  var ADAPTER_ID = 'x-bookmarks';
  var ARCHIVE_FIRST_MESSAGE = 'X bookmarks import is deferred until a user-owned X archive verifies bookmark fields. X/Twitter web pages, cookies, and private GraphQL are not accepted.';

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function sourceText(source) {
    if (typeof source === 'string') return source;
    source = source || {};
    return text(source.url || source.href || source.path || source.name || source.type || source.kind);
  }

  function isRejectedLiveSource(source) {
    var value = sourceText(source).trim();
    return /^https?:\/\/([^/]+\.)?(x|twitter)\.com(?:\/|$)/i.test(value) ||
      /\b(cookie|browser-session|graphql|web-crawl|scrape|x-api|twitter-api)\b/i.test(value);
  }

  function rejectUnsupportedSource(source) {
    if (!isRejectedLiveSource(source)) return null;
    var error = new Error(ARCHIVE_FIRST_MESSAGE);
    error.code = 'X_BOOKMARKS_UNSUPPORTED_SOURCE';
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
    ARCHIVE_FIRST_MESSAGE: ARCHIVE_FIRST_MESSAGE,
    isRejectedLiveSource: isRejectedLiveSource,
    rejectUnsupportedSource: rejectUnsupportedSource,
    assertSupportedSource: assertSupportedSource
  };
})();

if (typeof module !== 'undefined') module.exports = XBookmarksImportPolicy;
