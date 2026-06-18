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

  function lowerHeaders(headers) {
    var out = {};
    Object.keys(headers || {}).forEach(function(key) {
      out[text(key).toLowerCase()] = headers[key];
    });
    return out;
  }

  function firstError(body) {
    if (!body) return {};
    if (Array.isArray(body.errors) && body.errors.length) return body.errors[0] || {};
    if (body.error && typeof body.error === 'object') return body.error;
    return body;
  }

  function errorText(error) {
    return [error.type, error.title, error.detail, error.message, error.reason].map(text).join(' ');
  }

  function retryAt(headers) {
    var reset = Number(headers['x-rate-limit-reset']);
    if (Number.isFinite(reset) && reset > 0) return new Date(reset * 1000).toISOString();
    var retry = Number(headers['retry-after']);
    if (Number.isFinite(retry) && retry >= 0) return new Date(Date.now() + retry * 1000).toISOString();
    return '';
  }

  function apiState(code, message, patch) {
    return Object.assign({
      code: code,
      message: message,
      adapterId: ADAPTER_ID,
      source: 'official-api',
      recoverable: true
    }, patch || {});
  }

  function classifyApiError(response) {
    response = response || {};
    var status = Number(response.status || response.statusCode || 0);
    var headers = lowerHeaders(response.headers || {});
    var error = firstError(response.body || response.json || response.error || {});
    var details = errorText(error).toLowerCase();
    if (status === 401) {
      return apiState('X_BOOKMARKS_AUTH_FAILED', 'X API authentication failed; re-authentication would be required if API import ships.', {
        action: 'reauth'
      });
    }
    if (status === 403 && /usage-capped|usage cap|cap exceeded|billing|cost/.test(details)) {
      return apiState('X_BOOKMARKS_USAGE_CAPPED', 'X API usage cap or paid access limit was reached; stop import and show cost/access copy.', {
        action: 'stop',
        costRelated: true
      });
    }
    if (status === 403 && /not-authorized-for-resource|protected|private/.test(details)) {
      return apiState('X_BOOKMARKS_PROTECTED_POST', 'Bookmarked post is protected or private; keep any imported context and skip live hydration.', {
        action: 'skip',
        preserveContext: true
      });
    }
    if (status === 403) {
      return apiState('X_BOOKMARKS_INSUFFICIENT_ACCESS', 'X API access tier, enrollment, or OAuth scope is insufficient for bookmarks.', {
        action: 'stop',
        costRelated: true
      });
    }
    if (status === 404 || /resource-not-found|not found|deleted/.test(details)) {
      return apiState('X_BOOKMARKS_POST_UNAVAILABLE', 'Bookmarked post is unavailable or deleted; keep archive/API context if present.', {
        action: 'skip',
        preserveContext: true
      });
    }
    if (status === 429 || /rate-limit-exceeded|rate limit|too many requests/.test(details)) {
      return apiState('X_BOOKMARKS_RATE_LIMITED', 'X API rate limit reached; stop until the reset time or retry with backoff.', {
        action: 'retry-after-reset',
        retryAt: retryAt(headers)
      });
    }
    if (status >= 500) {
      return apiState('X_BOOKMARKS_API_RETRYABLE', 'X API server error; retry later with backoff.', {
        action: 'retry',
        retryAt: retryAt(headers)
      });
    }
    return apiState('X_BOOKMARKS_API_ERROR', 'X API request failed; stop and surface the response details.', {
      action: 'stop',
      recoverable: false
    });
  }

  function classifyPartialError(error) {
    var details = errorText(error || {}).toLowerCase();
    if (/not-authorized-for-resource|protected|private/.test(details)) {
      return classifyApiError({ status: 403, body: error });
    }
    if (/resource-not-found|not found|deleted/.test(details)) {
      return classifyApiError({ status: 404, body: error });
    }
    return apiState('X_BOOKMARKS_PARTIAL_ERROR', 'X API returned a partial bookmark error; keep successful rows and skip the failed item.', {
      action: 'skip',
      preserveContext: true
    });
  }

  return {
    ADAPTER_ID: ADAPTER_ID,
    ARCHIVE_FIRST_MESSAGE: ARCHIVE_FIRST_MESSAGE,
    isRejectedLiveSource: isRejectedLiveSource,
    rejectUnsupportedSource: rejectUnsupportedSource,
    assertSupportedSource: assertSupportedSource,
    classifyApiError: classifyApiError,
    classifyPartialError: classifyPartialError
  };
})();

if (typeof module !== 'undefined') module.exports = XBookmarksImportPolicy;
