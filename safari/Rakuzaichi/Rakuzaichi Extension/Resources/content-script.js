function logEvent(level, event, details) {
  if (typeof AppLogger !== 'undefined' && AppLogger[level]) {
    AppLogger[level](event, details || {});
  } else {
    var method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[method]('[Rakuzaichi][' + event + ']', details || {});
  }
}

function hashString(value) {
  var hash = 0;
  var input = String(value || '');
  for (var i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function deriveChatId(platform, result) {
  try {
    var url = new URL(window.location.href);
    var parts = url.pathname.split('/').filter(Boolean);
    var pathId = parts.length ? parts[parts.length - 1] : '';
    if (pathId) return platform.id + ':' + pathId;
  } catch (error) {}

  var firstMessage = result && result.messages && result.messages.length ? result.messages[0] : {};
  return platform.id + ':' + hashString([
    firstMessage.content || '',
    firstMessage.timestamp || '',
    document.title
  ].join('|'));
}

function normalizeSnapshotMessages(platform, result, chatId) {
  return result.messages.map(function(message, index) {
    var messageId = message.messageId || message.id || (chatId + ':' + index);
    return Object.assign({}, message, {
      messageId: messageId,
      id: message.id || messageId,
      chatId: chatId,
      platform: platform.id,
      model: message.model || result.model || '',
      index: typeof message.index === 'number' ? message.index : index,
      metadata: message.metadata || {}
    });
  });
}

function extractChatSnapshot(traceId) {
  var platform = PlatformRegistry.detect();
  if (!platform) throw new Error('No supported chat platform detected on this tab');

  var result = platform.extract();
  if (!result || !Array.isArray(result.messages)) {
    throw new Error('Extractor returned an invalid message list');
  }

  var capturedAt = new Date().toISOString();
  var chatId = deriveChatId(platform, result);
  return {
    chatId: chatId,
    platform: platform.id,
    title: result.chatTitle || document.title,
    url: window.location.href,
    model: result.model || '',
    capturedAt: capturedAt,
    lastUpdatedAt: capturedAt,
    messageCount: result.messages.length,
    pinned: false,
    archived: false,
    tags: [],
    metadata: result.metadata || {},
    messages: normalizeSnapshotMessages(platform, result, chatId),
    traceId: traceId || ''
  };
}

function createEnvelopeFromSnapshot(snapshot) {
  return {
    exportVersion: '2.1',
    exportedAt: snapshot.capturedAt,
    platform: snapshot.platform,
    chatTitle: snapshot.title,
    model: snapshot.model,
    messageCount: snapshot.messageCount,
    messages: snapshot.messages
  };
}

function detectContext(traceId) {
  var platform = PlatformRegistry.detect();
  if (!platform) {
    return {
      supported: false,
      chatTitle: document.title,
      messageCount: 0,
      model: '',
      traceId: traceId
    };
  }

  var messageCount = 0;
  var model = '';
  try {
    var summary = platform.extract();
    if (summary && Array.isArray(summary.messages)) messageCount = summary.messages.length;
    model = summary && summary.model ? summary.model : '';
  } catch (error) {
    logEvent('warn', 'content.detect.partial', {
      traceId: traceId,
      platform: platform.id,
      error: typeof AppLogger !== 'undefined' ? AppLogger.serializeError(error) : { message: error.message || String(error) }
    });
  }

  return {
    supported: true,
    platform: platform.id,
    name: platform.name,
    chatTitle: document.title,
    messageCount: messageCount,
    model: model,
    traceId: traceId
  };
}

api.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (!request || !request.action) return false;

  if (request.action === 'detectPlatform') {
    var detectTraceId = request.traceId || (typeof AppLogger !== 'undefined' ? AppLogger.createTraceId('detect') : String(Date.now()));
    try {
      var context = detectContext(detectTraceId);
      logEvent('debug', 'content.detect.success', context);
      sendResponse({ data: context, traceId: detectTraceId });
    } catch (error) {
      logEvent('error', 'content.detect.failed', {
        traceId: detectTraceId,
        error: typeof AppLogger !== 'undefined' ? AppLogger.serializeError(error) : { message: error.message || String(error) }
      });
      sendResponse({ error: error.message || String(error), traceId: detectTraceId });
    }
    return true;
  }

  if (request.action === 'extractChatSnapshot') {
    var snapshotTraceId = request.traceId || (typeof AppLogger !== 'undefined' ? AppLogger.createTraceId('snapshot') : String(Date.now()));
    try {
      var snapshot = extractChatSnapshot(snapshotTraceId);
      logEvent('info', 'content.snapshot.success', {
        traceId: snapshotTraceId,
        platform: snapshot.platform,
        chatId: snapshot.chatId,
        messageCount: snapshot.messageCount
      });
      sendResponse({ data: snapshot, platform: snapshot.platform, traceId: snapshotTraceId });
    } catch (error) {
      logEvent('error', 'content.snapshot.failed', {
        traceId: snapshotTraceId,
        error: typeof AppLogger !== 'undefined' ? AppLogger.serializeError(error) : { message: error.message || String(error) }
      });
      sendResponse({ error: error.message || String(error), traceId: snapshotTraceId });
    }
    return true;
  }

  if (request.action === 'extractChat') {
    var traceId = request.traceId || (typeof AppLogger !== 'undefined' ? AppLogger.createTraceId('extract') : String(Date.now()));
    try {
      logEvent('info', 'content.extract.start', { traceId: traceId, url: window.location.href });
      var snapshot = extractChatSnapshot(traceId);
      var envelope = createEnvelopeFromSnapshot(snapshot);
      logEvent('info', 'content.extract.success', {
        traceId: traceId,
        platform: snapshot.platform,
        chatId: snapshot.chatId,
        messageCount: envelope.messageCount
      });
      sendResponse({ data: envelope, snapshot: snapshot, platform: snapshot.platform, traceId: traceId });
    } catch (error) {
      logEvent('error', 'content.extract.failed', {
        traceId: traceId,
        error: typeof AppLogger !== 'undefined' ? AppLogger.serializeError(error) : { message: error.message || String(error) }
      });
      sendResponse({ error: error.message || String(error), traceId: traceId });
    }
    return true;
  }

  return false;
});

if (typeof module !== 'undefined') {
  module.exports = {
    extractChatSnapshot: extractChatSnapshot,
    createEnvelopeFromSnapshot: createEnvelopeFromSnapshot,
    detectContext: detectContext
  };
}
