var BackgroundRuntime = (function() {
  var AUTO_EXPORT_STATUS_KEY = 'lastAutoExportStatus';
  var CAPTURE_STATUS_KEY = 'lastCaptureStatus';
  var CAPTURE_THROTTLE_MS = 30000;
  var lastCaptureByTab = {};
  var SUPPORTED_CAPTURE_HOSTS = [
    'chat.openai.com',
    'chatgpt.com',
    'claude.ai',
    'gemini.google.com',
    'perplexity.ai',
    'www.perplexity.ai',
    'chat.deepseek.com',
    'grok.com',
    'copilot.microsoft.com',
    'chat.mistral.ai',
    'huggingface.co',
    'poe.com',
    'kimi.com',
    'chat.qwen.ai',
    'tongyi.aliyun.com',
    'chatglm.cn',
    'doubao.com',
    'www.doubao.com',
    'notebooklm.google.com'
  ];

  function serializeError(error) {
    if (typeof AppLogger !== 'undefined') return AppLogger.serializeError(error);
    return {
      name: error && error.name ? error.name : 'Error',
      message: error && error.message ? error.message : String(error || 'Unknown error'),
      stack: error && error.stack ? error.stack : ''
    };
  }

  function trace(prefix) {
    if (typeof AppLogger !== 'undefined') return AppLogger.createTraceId(prefix || 'background');
    return (prefix || 'background') + '-' + Date.now();
  }

  function log(level, event, details) {
    if (typeof AppLogger !== 'undefined' && AppLogger[level]) {
      AppLogger[level](event, details || {});
      return;
    }
    var method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[method]('[Rakuzaichi][' + event + ']', details || {});
  }

  async function setAutoExportStatus(state, message, traceId) {
    await StorageManager.setRuntimeValue(AUTO_EXPORT_STATUS_KEY, {
      state: state,
      message: message,
      timestamp: new Date().toISOString(),
      traceId: traceId || ''
    });
  }

  async function setCaptureStatus(state, message, details) {
    if (typeof StorageManager === 'undefined') return;
    await StorageManager.setRuntimeValue(CAPTURE_STATUS_KEY, {
      state: state,
      message: message,
      timestamp: new Date().toISOString(),
      chatId: details && details.chatId ? details.chatId : '',
      platform: details && details.platform ? details.platform : '',
      traceId: details && details.traceId ? details.traceId : ''
    });
  }

  function validateEnvelope(data) {
    if (!data) throw new Error('Missing export data');
    if (!Array.isArray(data.messages)) throw new Error('Invalid export payload: messages must be an array');
    if (!data.messages.length) throw new Error('No messages were extracted from the current conversation');
  }

  function validateSnapshot(snapshot) {
    if (!snapshot) throw new Error('Missing chat snapshot');
    if (!snapshot.chatId) throw new Error('Snapshot missing chatId');
    if (!snapshot.platform) throw new Error('Snapshot missing platform');
    if (!Array.isArray(snapshot.messages)) throw new Error('Snapshot messages must be an array');
  }

  function isSupportedPlatformUrl(url) {
    try {
      var parsed = new URL(url);
      if (SUPPORTED_CAPTURE_HOSTS.indexOf(parsed.hostname) === -1) return false;
      if (parsed.hostname === 'huggingface.co') return parsed.pathname.indexOf('/chat') === 0;
      return true;
    } catch (error) {
      return false;
    }
  }

  function chatFromSnapshot(snapshot, existingChat) {
    return {
      chatId: snapshot.chatId,
      platform: snapshot.platform,
      title: snapshot.title || snapshot.chatTitle || (existingChat && existingChat.title) || 'Untitled conversation',
      url: snapshot.url || (existingChat && existingChat.url) || '',
      model: snapshot.model || '',
      capturedAt: (existingChat && existingChat.capturedAt) || snapshot.capturedAt || new Date().toISOString(),
      lastUpdatedAt: snapshot.lastUpdatedAt || new Date().toISOString(),
      messageCount: snapshot.messages.length,
      pinned: !!(existingChat && existingChat.pinned) || !!snapshot.pinned,
      archived: !!(existingChat && existingChat.archived) || !!snapshot.archived,
      tags: snapshot.tags || (existingChat && existingChat.tags) || [],
      folderId: snapshot.folderId || (existingChat && existingChat.folderId) || undefined,
      metadata: snapshot.metadata || {}
    };
  }

  function normalizeSnapshotMessages(snapshot) {
    return snapshot.messages.map(function(message, index) {
      var messageIndex = typeof message.index === 'number' ? message.index : index;
      var messageId = message.messageId || message.id || (snapshot.chatId + ':' + messageIndex);
      return Object.assign({}, message, {
        messageId: messageId,
        id: message.id || messageId,
        chatId: snapshot.chatId,
        platform: snapshot.platform,
        model: message.model || snapshot.model || '',
        index: messageIndex,
        metadata: message.metadata || {}
      });
    });
  }

  async function handleCapture(snapshot) {
    validateSnapshot(snapshot);
    if (typeof VaultDAO === 'undefined') throw new Error('Vault DAO is unavailable');

    var existingChat = await VaultDAO.getChat(snapshot.chatId);
    var existingMessages = await VaultDAO.listMessages(snapshot.chatId);
    var existingIndexes = {};
    for (var i = 0; i < existingMessages.length; i++) {
      existingIndexes[existingMessages[i].index] = true;
    }

    var normalizedMessages = normalizeSnapshotMessages(snapshot);
    var newMessages = normalizedMessages.filter(function(message) {
      return !existingIndexes[message.index];
    });

    await VaultDAO.putChat(chatFromSnapshot(Object.assign({}, snapshot, { messages: normalizedMessages }), existingChat));
    if (newMessages.length) await VaultDAO.putMessages(snapshot.chatId, newMessages);
    if (VaultDAO.putExtractionRun) {
      await VaultDAO.putExtractionRun({
        runId: (snapshot.traceId || ('capture-' + Date.now())) + ':' + snapshot.chatId,
        chatId: snapshot.chatId,
        modelName: 'capture',
        modelVersion: 'snapshot-v1',
        completedAt: new Date().toISOString(),
        threadCount: normalizedMessages.length,
        durationMs: 0
      });
    }
    await setCaptureStatus('success', 'Captured ' + normalizedMessages.length + ' messages.', {
      chatId: snapshot.chatId,
      platform: snapshot.platform,
      traceId: snapshot.traceId || ''
    });

    log('info', 'background.capture.success', {
      chatId: snapshot.chatId,
      platform: snapshot.platform,
      addedMessages: newMessages.length,
      messageCount: existingMessages.length + newMessages.length
    });

    return {
      success: true,
      chatId: snapshot.chatId,
      addedMessages: newMessages.length,
      messageCount: existingMessages.length + newMessages.length
    };
  }

  async function captureTab(tabId, tabUrl, traceId) {
    try {
      var response = await api.tabs.sendMessage(tabId, {
        action: 'extractChatSnapshot',
        traceId: traceId
      });
      if (!response) throw new Error('No response from content script');
      if (response.error) throw new Error(response.error);
      return await handleCapture(response.data);
    } catch (error) {
      await setCaptureStatus('error', error.message || String(error), { traceId: traceId });
      throw error;
    }
  }

  async function handleTabUpdated(tabId, changeInfo, tab) {
    if (!changeInfo || changeInfo.status !== 'complete') return null;
    var tabUrl = changeInfo.url || (tab && tab.url) || '';
    if (!isSupportedPlatformUrl(tabUrl)) return null;

    var now = Date.now();
    if (lastCaptureByTab[tabId] && now - lastCaptureByTab[tabId] < CAPTURE_THROTTLE_MS) {
      return { skipped: true, reason: 'throttled' };
    }

    lastCaptureByTab[tabId] = now;
    return captureTab(tabId, tabUrl, trace('capture'));
  }

  async function runCaptureSweep() {
    var tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length || (tabs[0].id !== 0 && !tabs[0].id)) {
      return { skipped: true, reason: 'no-active-tab' };
    }
    if (!isSupportedPlatformUrl(tabs[0].url || '')) {
      return { skipped: true, reason: 'unsupported-tab' };
    }
    return captureTab(tabs[0].id, tabs[0].url, trace('sweep'));
  }

  async function handleDownload(request) {
    var traceId = request && request.traceId ? request.traceId : trace('download');
    try {
      var format = request.format;
      var data = request.data;
      if (!format || !data) throw new Error('Missing format or data');
      validateEnvelope(data);

      var formatInfo = FormatConverter.formats[format];
      if (!formatInfo) throw new Error('Unsupported format: ' + format);

      log('info', 'background.download.start', {
        traceId: traceId,
        format: format,
        platform: data.platform,
        messageCount: data.messageCount
      });

      var converted = FormatConverter.convert(format, data);
      if (!api.downloads || !api.downloads.download) {
        throw new Error('The browser download API is unavailable in the background context');
      }

      var settings = await StorageManager.getAll();
      var filename = FilenameBuilder.build(settings.filenameTemplate, {
        platform: data.platform,
        title: data.chatTitle,
        format: format,
        ext: formatInfo.ext
      });

      var url = 'data:' + formatInfo.mime + ';charset=utf-8,' + encodeURIComponent(converted);
      await api.downloads.download({
        url: url,
        filename: filename,
        saveAs: request.saveAs !== false,
        conflictAction: 'uniquify'
      });

      await ExportHistory.add({
        platform: data.platform,
        format: format,
        messageCount: data.messageCount,
        chatTitle: data.chatTitle,
        filename: filename
      });

      log('info', 'background.download.success', {
        traceId: traceId,
        filename: filename,
        format: format,
        platform: data.platform
      });

      return { success: true, filename: filename, traceId: traceId };
    } catch (error) {
      log('error', 'background.download.failed', {
        traceId: traceId,
        error: serializeError(error)
      });
      throw new Error((error.message || String(error)) + ' (trace ' + traceId + ')');
    }
  }

  async function extractFromActiveTab(traceId) {
    var tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length || (tabs[0].id !== 0 && !tabs[0].id)) {
      throw new Error('No active tab is available for export');
    }

    var response = await api.tabs.sendMessage(tabs[0].id, { action: 'extractChat', traceId: traceId });
    if (!response) throw new Error('No response from content script');
    if (response.error) throw new Error(response.error);

    validateEnvelope(response.data);
    return response.data;
  }

  async function runAutoExport() {
    var traceId = trace('auto');
    try {
      log('info', 'background.autoExport.start', { traceId: traceId });
      var settings = await StorageManager.getAll();
      var data = await extractFromActiveTab(traceId);
      await handleDownload({
        format: settings.defaultFormat || 'json',
        data: data,
        saveAs: true,
        traceId: traceId
      });
      await setAutoExportStatus('success', 'Auto-export opened the browser save flow for the active supported tab.', traceId);
      log('info', 'background.autoExport.success', {
        traceId: traceId,
        format: settings.defaultFormat || 'json',
        messageCount: data.messageCount
      });
    } catch (error) {
      await setAutoExportStatus('error', (error && error.message) || String(error), traceId);
      log('error', 'background.autoExport.failed', {
        traceId: traceId,
        error: serializeError(error)
      });
    }
  }

  async function updateAutoExport() {
    var traceId = trace('alarm');
    await api.alarms.clear('auto-export');
    var interval = await StorageManager.get('autoExportInterval');
    if (interval && interval > 0) {
      api.alarms.create('auto-export', { periodInMinutes: interval });
      log('info', 'background.autoExport.schedule.enabled', {
        traceId: traceId,
        interval: interval
      });
      return;
    }

    log('info', 'background.autoExport.schedule.disabled', { traceId: traceId });
  }

  function init() {
    api.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (!request || !request.action) return false;

      if (request.action === 'download') {
        handleDownload(request).then(sendResponse).catch(function(error) {
          sendResponse({ error: error.message || String(error) });
        });
        return true;
      }

      if (request.action === 'captureSnapshot') {
        handleCapture(request.snapshot).then(sendResponse).catch(function(error) {
          sendResponse({ error: error.message || String(error) });
        });
        return true;
      }

      return false;
    });

    api.alarms.onAlarm.addListener(function(alarm) {
      if (alarm.name === 'auto-export') {
        runAutoExport();
        return;
      }
      if (alarm.name === 'capture-sweep') {
        runCaptureSweep().catch(function(error) {
          log('error', 'background.capture.sweep.failed', { error: serializeError(error) });
        });
      }
    });

    if (api.tabs && api.tabs.onUpdated && api.tabs.onUpdated.addListener) {
      api.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        handleTabUpdated(tabId, changeInfo, tab).catch(function(error) {
          log('error', 'background.capture.tabUpdated.failed', {
            tabId: tabId,
            error: serializeError(error)
          });
        });
      });
    }

    api.storage.onChanged.addListener(function(changes) {
      if (changes.autoExportInterval) updateAutoExport();
    });

    updateAutoExport().catch(function(error) {
      log('error', 'background.init.schedule.failed', { error: serializeError(error) });
    });
    api.alarms.create('capture-sweep', { periodInMinutes: 10 });

    log('info', 'background.init.complete', {});
  }

  return {
    init: init,
    handleDownload: handleDownload,
    handleCapture: handleCapture,
    handleTabUpdated: handleTabUpdated,
    isSupportedPlatformUrl: isSupportedPlatformUrl,
    runCaptureSweep: runCaptureSweep,
    updateAutoExport: updateAutoExport,
    runAutoExport: runAutoExport
  };
})();

if (typeof module !== 'undefined') module.exports = BackgroundRuntime;
