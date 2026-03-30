function logEvent(level, event, details) {
  if (typeof AppLogger !== 'undefined' && AppLogger[level]) {
    AppLogger[level](event, details || {});
  } else {
    var method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[method]('[Rakuzaichi][' + event + ']', details || {});
  }
}

function createEnvelope(platform, result) {
  if (!result || !Array.isArray(result.messages)) {
    throw new Error('Extractor returned an invalid message list');
  }

  return {
    exportVersion: '2.1',
    exportedAt: new Date().toISOString(),
    platform: platform.id,
    chatTitle: result.chatTitle || document.title,
    model: result.model || '',
    messageCount: result.messages.length,
    messages: result.messages
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

  if (request.action === 'extractChat') {
    var traceId = request.traceId || (typeof AppLogger !== 'undefined' ? AppLogger.createTraceId('extract') : String(Date.now()));
    try {
      var platform = PlatformRegistry.detect();
      if (!platform) {
        sendResponse({ error: 'No supported chat platform detected on this tab', traceId: traceId });
        return true;
      }
      logEvent('info', 'content.extract.start', { traceId: traceId, platform: platform.id, url: window.location.href });
      var result = platform.extract();
      var envelope = createEnvelope(platform, result);
      logEvent('info', 'content.extract.success', {
        traceId: traceId,
        platform: platform.id,
        messageCount: envelope.messageCount
      });
      sendResponse({ data: envelope, platform: platform.id, traceId: traceId });
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
