var ExtractionChunker = (function() {
  var DEFAULT_WINDOW_SIZE = 8;
  var DEFAULT_OVERLAP = 2;

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function now() {
    return Date.now();
  }

  function messageId(message, index) {
    return text(message && (message.messageId || message.id)) || ('msg-' + index);
  }

  function normalizePositiveInt(value, fallback) {
    if (typeof value !== 'number' || !isFinite(value)) return fallback;
    return Math.max(1, Math.floor(value));
  }

  function normalizeMessages(messages) {
    return (Array.isArray(messages) ? messages : []).map(function(message, index) {
      var id = messageId(message, index);
      return Object.assign({}, message || {}, {
        id: text(message && message.id || id),
        messageId: id,
        index: typeof (message && message.index) === 'number' ? message.index : index,
        content: text(message && message.content)
      });
    });
  }

  function chunkOptions(options) {
    options = options || {};
    var windowSize = normalizePositiveInt(options.windowSize, DEFAULT_WINDOW_SIZE);
    var overlap = typeof options.overlap === 'number' && isFinite(options.overlap) ? Math.max(0, Math.floor(options.overlap)) : DEFAULT_OVERLAP;
    return {
      windowSize: windowSize,
      overlap: Math.min(overlap, Math.max(0, windowSize - 1))
    };
  }

  function buildSlidingWindows(messages, options) {
    var normalized = normalizeMessages(messages);
    var opts = chunkOptions(options);
    if (!normalized.length) return [];
    var step = Math.max(1, opts.windowSize - opts.overlap);
    var windows = [];
    for (var start = 0; start < normalized.length; start += step) {
      var endExclusive = Math.min(normalized.length, start + opts.windowSize);
      windows.push({
        id: 'chunk:' + start + '-' + (endExclusive - 1),
        startIndex: start,
        endIndex: endExclusive - 1,
        overlap: opts.overlap,
        messages: normalized.slice(start, endExclusive)
      });
      if (endExclusive === normalized.length) break;
    }
    return windows;
  }

  function normalizeThreadText(value) {
    return text(value).replace(/\s+/g, ' ').trim();
  }

  function threadKey(thread) {
    return text(thread && thread.messageId).trim() + '\u0000' + normalizeThreadText(thread && thread.text);
  }

  function dedupeThreads(threads) {
    var seen = {};
    var rows = [];
    (Array.isArray(threads) ? threads : []).forEach(function(thread) {
      var key = threadKey(thread);
      if (key === '\u0000' || seen[key]) return;
      seen[key] = true;
      rows.push(Object.assign({}, thread, {
        text: normalizeThreadText(thread.text)
      }));
    });
    return rows;
  }

  async function runWindowedExtraction(messages, extractWindow, options) {
    if (typeof extractWindow !== 'function') throw new Error('Extraction window function is required');
    options = options || {};
    var startedAt = now();
    var windows = buildSlidingWindows(messages, options);
    var threads = [];
    for (var i = 0; i < windows.length; i++) {
      if (typeof options.onProgress === 'function') {
        options.onProgress({ status: 'chunk-start', index: i, total: windows.length, window: windows[i] });
      }
      var result = await extractWindow(windows[i].messages, windows[i]);
      var rows = Array.isArray(result) ? result : result && Array.isArray(result.threads) ? result.threads : [];
      Array.prototype.push.apply(threads, rows);
      if (typeof options.onProgress === 'function') {
        options.onProgress({ status: 'chunk-done', index: i, total: windows.length, window: windows[i], threadCount: rows.length });
      }
    }
    return {
      windows: windows,
      rawThreadCount: threads.length,
      threads: dedupeThreads(threads),
      durationMs: now() - startedAt
    };
  }

  return {
    DEFAULT_WINDOW_SIZE: DEFAULT_WINDOW_SIZE,
    DEFAULT_OVERLAP: DEFAULT_OVERLAP,
    buildSlidingWindows: buildSlidingWindows,
    dedupeThreads: dedupeThreads,
    runWindowedExtraction: runWindowedExtraction
  };
})();

if (typeof module !== 'undefined') module.exports = ExtractionChunker;
