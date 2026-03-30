var BackgroundRuntime = (function() {
  var AUTO_EXPORT_STATUS_KEY = 'lastAutoExportStatus';

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

  function validateEnvelope(data) {
    if (!data) throw new Error('Missing export data');
    if (!Array.isArray(data.messages)) throw new Error('Invalid export payload: messages must be an array');
    if (!data.messages.length) throw new Error('No messages were extracted from the current conversation');
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

      return false;
    });

    api.alarms.onAlarm.addListener(function(alarm) {
      if (alarm.name !== 'auto-export') return;
      runAutoExport();
    });

    api.storage.onChanged.addListener(function(changes) {
      if (changes.autoExportInterval) updateAutoExport();
    });

    updateAutoExport().catch(function(error) {
      log('error', 'background.init.schedule.failed', { error: serializeError(error) });
    });

    log('info', 'background.init.complete', {});
  }

  return {
    init: init,
    handleDownload: handleDownload,
    updateAutoExport: updateAutoExport,
    runAutoExport: runAutoExport
  };
})();
