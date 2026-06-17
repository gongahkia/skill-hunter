(function() {
  var SELECTABLE_FORMATS = ['json', 'markdown', 'csv', 'tsv', 'html', 'pdf'];

  var state = {
    settings: null,
    context: null,
    pendingExport: null,
    lastSelectedFormat: ''
  };

  var els = {
    contextPill: document.getElementById('context-pill'),
    contextPlatform: document.getElementById('context-platform'),
    contextMessages: document.getElementById('context-messages'),
    contextTitle: document.getElementById('context-title'),
    contextTitleProp: document.getElementById('context-title-prop'),
    contextUrl: document.getElementById('context-url'),
    contextPreview: document.getElementById('context-preview'),
    contextModel: document.getElementById('context-model'),
    captureStatus: document.getElementById('capture-status'),
    captureStatusText: document.getElementById('capture-status-text'),
    captureNow: document.getElementById('capture-now'),
    quickExport: document.getElementById('quick-export'),
    quickFormat: document.getElementById('quick-format'),
    quickFormatAction: document.getElementById('quick-format-action'),
    openOptions: document.getElementById('open-options'),
    formatButtons: Array.from(document.querySelectorAll('button[data-format]')),
    previewPanel: document.getElementById('export-preview'),
    previewInfo: document.getElementById('preview-info'),
    previewConfirm: document.getElementById('preview-confirm'),
    previewCopy: document.getElementById('preview-copy'),
    previewCancel: document.getElementById('preview-cancel'),
    lastExport: document.getElementById('last-export'),
    status: document.getElementById('status')
  };

  function serializeError(error) {
    if (typeof AppLogger !== 'undefined') return AppLogger.serializeError(error);
    return {
      name: error && error.name ? error.name : 'Error',
      message: error && error.message ? error.message : String(error || 'Unknown error'),
      stack: error && error.stack ? error.stack : ''
    };
  }

  function trace(prefix) {
    if (typeof AppLogger !== 'undefined') return AppLogger.createTraceId(prefix || 'popup');
    return (prefix || 'popup') + '-' + Date.now();
  }

  function log(level, event, details) {
    if (typeof AppLogger !== 'undefined' && AppLogger[level]) {
      AppLogger[level](event, details || {});
      return;
    }
    var method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[method]('[Rakuzaichi][' + event + ']', details || {});
  }

  function applyTheme(mode) {
    var effectiveMode = mode === 'dark' || (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    if (effectiveMode === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    document.documentElement.dataset.themeMode = effectiveMode;
    return effectiveMode;
  }

  function applyColorscheme(id, mode) {
    if (typeof OwlColorschemes !== 'undefined') {
      OwlColorschemes.apply(document, id || OwlColorschemes.defaultId, mode || document.documentElement.dataset.themeMode || 'dark');
    }
  }

  function setPill(stateName, text) {
    if (!els.contextPill) return;
    els.contextPill.className = 'context-pill ' + stateName;
    els.contextPill.textContent = text;
  }

  function formatLabel(format) {
    if (format === 'markdown') return 'MD';
    return String(format || 'json').toUpperCase();
  }

  function normalizeExportFormat(format) {
    return SELECTABLE_FORMATS.indexOf(format) === -1 ? 'json' : format;
  }

  function setActiveFormat(format) {
    format = normalizeExportFormat(format);
    state.lastSelectedFormat = format;
    els.formatButtons.forEach(function(button) {
      if (button.dataset.format === format) button.classList.add('active');
      else button.classList.remove('active');
    });
    if (els.quickFormat) els.quickFormat.textContent = formatLabel(format);
    if (els.quickFormatAction) els.quickFormatAction.textContent = formatLabel(format);
  }

  function setActionsDisabled(disabled) {
    if (els.captureNow) els.captureNow.disabled = disabled;
    if (els.quickExport) els.quickExport.disabled = disabled;
    els.formatButtons.forEach(function(button) {
      button.disabled = disabled;
    });
  }

  function showStatus(message, kind) {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.className = 'status ' + (kind || 'info');
    els.status.classList.remove('hidden');

    if (kind !== 'error') {
      setTimeout(function() {
        els.status.classList.add('hidden');
      }, 3600);
    }
  }

  function updateQuickFormat() {
    var format = normalizeExportFormat((state.settings && state.settings.defaultFormat) || 'json');
    setActiveFormat(format);
  }

  function truncateText(value, limit) {
    var text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (text.length <= limit) return text;
    return text.slice(0, limit - 1).trim() + '...';
  }

  function renderCaptureStatus(status) {
    if (!els.captureStatus || !els.captureStatusText) return;
    status = status || {};
    var kind = 'red';
    if (status.state === 'success' && status.timestamp) {
      var age = Date.now() - new Date(status.timestamp).getTime();
      if (age < 5 * 60 * 1000) kind = 'green';
      else if (age < 30 * 60 * 1000) kind = 'amber';
    }
    if (status.state === 'error') kind = 'red';

    els.captureStatus.className = 'capture-status ' + kind;
    els.captureStatusText.textContent = status.message || 'No captures yet.';
  }

  async function refreshCaptureStatus() {
    try {
      var status = await StorageManager.get('lastCaptureStatus');
      renderCaptureStatus(status);
    } catch (error) {
      renderCaptureStatus({ state: 'error', message: 'Capture status unavailable.' });
    }
  }

  function updateContextUI(data) {
    if (!data || !data.supported) {
      if (els.contextPlatform) els.contextPlatform.textContent = 'Unsupported page';
      if (els.contextMessages) els.contextMessages.textContent = '-';
      if (els.contextModel) els.contextModel.textContent = 'Unavailable';
      if (els.contextTitle) els.contextTitle.textContent = 'Open a supported chat tab, then reopen this popup.';
      if (els.contextTitleProp) els.contextTitleProp.textContent = 'Unsupported page';
      if (els.contextUrl) els.contextUrl.textContent = truncateText(data && data.url ? data.url : 'Current tab', 96);
      if (els.contextPreview) els.contextPreview.textContent = 'Rakuzaichi can capture supported AI chat pages into the local vault.';
      setPill('unsupported', 'Unsupported tab');
      setActionsDisabled(true);
      return;
    }

    if (els.contextPlatform) els.contextPlatform.textContent = data.name || data.platform || 'Supported';
    if (els.contextMessages) els.contextMessages.textContent = String(data.messageCount || 0);
    if (els.contextModel) els.contextModel.textContent = data.model || 'Not exposed by this chat UI';
    if (els.contextTitle) els.contextTitle.textContent = data.chatTitle || 'Untitled conversation';
    if (els.contextTitleProp) els.contextTitleProp.textContent = data.chatTitle || 'Untitled conversation';
    if (els.contextUrl) els.contextUrl.textContent = truncateText(data.url || 'Current tab', 96);
    if (els.contextPreview) els.contextPreview.textContent = data.previewText || 'No message preview is available yet. Capture still works if the page exposes messages.';
    setPill('supported', 'Ready');
    setActionsDisabled(false);
  }

  async function detectCurrentTabContext() {
    var traceId = trace('detect');
    setPill('loading', 'Scanning current tab');

    try {
      var tabs = await api.tabs.query({ active: true, currentWindow: true });
      if (!tabs.length || (tabs[0].id !== 0 && !tabs[0].id)) {
        throw new Error('No active tab available');
      }

      var response = await api.tabs.sendMessage(tabs[0].id, { action: 'detectPlatform', traceId: traceId });
      if (!response) throw new Error('No response from content script');
      if (response.error) throw new Error(response.error);

      state.context = response.data || { supported: false };
      updateContextUI(state.context);

      log('info', 'popup.context.detected', {
        traceId: traceId,
        supported: !!state.context.supported,
        platform: state.context.platform || '',
        messageCount: state.context.messageCount || 0
      });
    } catch (error) {
      var msg = error && error.message ? error.message : String(error);
      state.context = { supported: false };
      updateContextUI(state.context);

      log('warn', 'popup.context.detect.failed', {
        traceId: traceId,
        error: serializeError(error)
      });

      if (/Could not establish connection/i.test(msg) || /Receiving end does not exist/i.test(msg)) {
        showStatus('Open ChatGPT, Claude, Gemini, or another supported chat tab first.', 'info');
      } else {
        showStatus('Context detection failed: ' + msg, 'error');
      }
    }
  }

  async function renderLastExport() {
    if (!els.lastExport) return;
    try {
      var history = await ExportHistory.getAll();
      if (!history.length) {
        els.lastExport.textContent = 'No exports yet.';
        return;
      }

      var item = history[0];
      var when = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Unknown time';
      els.lastExport.textContent =
        formatLabel(item.format) + ' from ' + (item.platform || 'unknown') +
        ' with ' + (item.messageCount || 0) + ' messages at ' + when +
        '. File: ' + (item.filename || 'n/a');
    } catch (error) {
      log('warn', 'popup.history.read.failed', { error: serializeError(error) });
      els.lastExport.textContent = 'Unable to load recent export history.';
    }
  }

  async function requestExtraction(format, traceId) {
    var tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length || (tabs[0].id !== 0 && !tabs[0].id)) throw new Error('No active tab found');

    var response = await api.tabs.sendMessage(tabs[0].id, {
      action: 'extractChat',
      traceId: traceId
    });

    if (!response) throw new Error('No response from content script');
    if (response.error) throw new Error(response.error);
    if (!response.data || !Array.isArray(response.data.messages)) {
      throw new Error('Extraction payload was malformed');
    }

    return response.data;
  }

  async function requestSnapshot(traceId) {
    var tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length || (tabs[0].id !== 0 && !tabs[0].id)) throw new Error('No active tab found');

    var response = await api.tabs.sendMessage(tabs[0].id, {
      action: 'extractChatSnapshot',
      traceId: traceId
    });

    if (!response) throw new Error('No response from content script');
    if (response.error) throw new Error(response.error);
    if (!response.data || !Array.isArray(response.data.messages)) {
      throw new Error('Snapshot payload was malformed');
    }

    return response.data;
  }

  async function captureCurrentChat() {
    var traceId = trace('capture');
    if (!state.context || !state.context.supported) {
      showStatus('This tab is not a supported chat platform.', 'error');
      return;
    }

    try {
      showStatus('Capturing conversation into the local vault...', 'info');
      var snapshot = await requestSnapshot(traceId);
      var response = await api.runtime.sendMessage({
        action: 'captureSnapshot',
        snapshot: snapshot,
        traceId: traceId
      });
      if (response && response.error) throw new Error(response.error);
      showStatus('Chat captured to the local vault.', 'success');
      await refreshCaptureStatus();
      log('info', 'popup.capture.success', {
        traceId: traceId,
        chatId: snapshot.chatId,
        platform: snapshot.platform,
        messageCount: snapshot.messageCount
      });
    } catch (error) {
      log('error', 'popup.capture.failed', {
        traceId: traceId,
        error: serializeError(error)
      });
      showStatus('Capture failed: ' + (error.message || String(error)), 'error');
    }
  }

  async function doDownload(format, data, traceId) {
    if (format === 'pdf') {
      await printPDF(data, traceId);
      return;
    }
    try {
      var response = await api.runtime.sendMessage({
        action: 'download',
        format: format,
        data: data,
        traceId: traceId
      });

      if (response && response.error) throw new Error(response.error);
      showStatus('Export opened your browser save flow.', 'success');
      await renderLastExport();
      log('info', 'popup.download.success', {
        traceId: traceId,
        format: format,
        platform: data.platform,
        messageCount: data.messageCount
      });
    } catch (error) {
      var message = error && error.message ? error.message : String(error);
      if (/download/i.test(message)) {
        await fallbackDownload(format, data, traceId);
        return;
      }
      throw error;
    }
  }

  function loadPrintFrame(iframe, html) {
    return new Promise(function(resolve) {
      var settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        resolve(iframe.contentWindow);
      }
      iframe.onload = finish;
      iframe.srcdoc = html;
      setTimeout(finish, 50);
    });
  }

  async function printPDF(data, traceId) {
    var formatInfo = FormatConverter.formats.pdf;
    var filename = FilenameBuilder.build(state.settings.filenameTemplate, {
      platform: data.platform,
      title: data.chatTitle,
      format: 'pdf',
      ext: formatInfo.ext
    });
    var iframe = document.createElement('iframe');
    iframe.hidden = true;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    try {
      var printWindow = await loadPrintFrame(iframe, FormatConverter.toHTML(data));
      if (!printWindow || typeof printWindow.print !== 'function') throw new Error('Print API is unavailable');
      if (printWindow.focus) printWindow.focus();
      printWindow.print();

      await ExportHistory.add({
        platform: data.platform,
        format: 'pdf',
        messageCount: data.messageCount,
        chatTitle: data.chatTitle,
        filename: filename
      });

      showStatus('Print dialog opened. Choose Save as PDF in the browser dialog.', 'success');
      await renderLastExport();
      log('info', 'popup.pdf.print.opened', { traceId: traceId, filename: filename, platform: data.platform });
    } finally {
      setTimeout(function() {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1200);
    }
  }

  async function fallbackDownload(format, data, traceId) {
    var formatInfo = FormatConverter.formats[format];
    if (!formatInfo) throw new Error('Unsupported format: ' + format);

    var filename = FilenameBuilder.build(state.settings.filenameTemplate, {
      platform: data.platform,
      title: data.chatTitle,
      format: format,
      ext: formatInfo.ext
    });

    var converted = FormatConverter.convert(format, data);
    var blob = new Blob([converted], { type: formatInfo.mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);

    try {
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();

      await ExportHistory.add({
        platform: data.platform,
        format: format,
        messageCount: data.messageCount,
        chatTitle: data.chatTitle,
        filename: filename
      });

      showStatus('Export downloaded via popup fallback mode.', 'success');
      await renderLastExport();
      log('warn', 'popup.download.fallback.used', {
        traceId: traceId,
        format: format,
        filename: filename
      });
    } finally {
      setTimeout(function() {
        URL.revokeObjectURL(url);
      }, 1200);
    }
  }

  async function writeClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = document.execCommand('copy');
    document.body.removeChild(area);
    if (!ok) throw new Error('Clipboard API is unavailable in this browser context');
  }

  function updatePreview(format, data) {
    if (!els.previewInfo || !els.previewPanel) return;
    els.previewInfo.textContent =
      data.messageCount + ' messages from ' + data.platform +
      (data.model ? ' (' + data.model + ')' : '') +
      ' will be exported as ' + formatLabel(format) + '.';
    els.previewPanel.classList.remove('hidden');
  }

  function hidePreview() {
    if (els.previewPanel) els.previewPanel.classList.add('hidden');
    state.pendingExport = null;
  }

  async function startExport(format) {
    format = normalizeExportFormat(format);
    var traceId = trace('export');
    setActiveFormat(format);

    if (!state.context || !state.context.supported) {
      showStatus('This tab is not a supported chat platform.', 'error');
      return;
    }

    try {
      showStatus('Extracting conversation from current tab...', 'info');
      var data = await requestExtraction(format, traceId);

      if (state.settings.showPreview) {
        state.pendingExport = { format: format, data: data, traceId: traceId };
        updatePreview(format, data);
        showStatus('Review the export details before downloading.', 'info');
      } else {
        hidePreview();
        await doDownload(format, data, traceId);
      }
    } catch (error) {
      log('error', 'popup.export.failed', {
        traceId: traceId,
        format: format,
        error: serializeError(error)
      });
      showStatus('Export failed: ' + (error.message || String(error)), 'error');
    }
  }

  async function confirmPreviewDownload() {
    if (!state.pendingExport) return;
    var pending = state.pendingExport;
    hidePreview();
    try {
      await doDownload(pending.format, pending.data, pending.traceId);
    } catch (error) {
      log('error', 'popup.preview.download.failed', {
        traceId: pending.traceId,
        format: pending.format,
        error: serializeError(error)
      });
      showStatus('Download failed: ' + (error.message || String(error)), 'error');
    }
  }

  async function copyPreviewData() {
    if (!state.pendingExport) return;
    var pending = state.pendingExport;

    try {
      var converted = FormatConverter.convert(pending.format, pending.data);
      await writeClipboard(converted);
      showStatus('Converted export copied to clipboard.', 'success');
      log('info', 'popup.preview.copied', {
        traceId: pending.traceId,
        format: pending.format,
        messageCount: pending.data.messageCount
      });
    } catch (error) {
      log('error', 'popup.preview.copy.failed', {
        traceId: pending.traceId,
        format: pending.format,
        error: serializeError(error)
      });
      showStatus('Clipboard copy failed: ' + (error.message || String(error)), 'error');
    }
  }

  function wireEvents() {
    els.formatButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        startExport(button.dataset.format);
      });
    });

    if (els.quickExport) {
      els.quickExport.addEventListener('click', function() {
        startExport(normalizeExportFormat((state.settings && state.settings.defaultFormat) || 'json'));
      });
    }

    if (els.captureNow) els.captureNow.addEventListener('click', captureCurrentChat);

    if (els.previewConfirm) els.previewConfirm.addEventListener('click', confirmPreviewDownload);
    if (els.previewCopy) els.previewCopy.addEventListener('click', copyPreviewData);
    if (els.previewCancel) {
      els.previewCancel.addEventListener('click', function() {
        hidePreview();
        showStatus('Preview dismissed. Nothing exported.', 'info');
      });
    }

    if (els.openOptions) {
      els.openOptions.addEventListener('click', function() {
        if (api.runtime && api.runtime.openOptionsPage) {
          api.runtime.openOptionsPage();
        } else {
          window.location.href = 'options.html';
        }
      });
    }
  }

  async function init() {
    try {
      state.settings = await StorageManager.getAll();
      applyColorscheme(state.settings.colorscheme, applyTheme(state.settings.darkMode));
      renderCaptureStatus(state.settings.lastCaptureStatus);
      updateQuickFormat();
      wireEvents();
      await renderLastExport();
      await detectCurrentTabContext();
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
        applyColorscheme(state.settings.colorscheme, applyTheme(state.settings.darkMode));
      });

      log('info', 'popup.init.complete', {
        defaultFormat: state.settings.defaultFormat,
        colorscheme: state.settings.colorscheme,
        showPreview: !!state.settings.showPreview
      });
    } catch (error) {
      log('error', 'popup.init.failed', { error: serializeError(error) });
      showStatus('Popup initialization failed: ' + (error.message || String(error)), 'error');
      setActionsDisabled(true);
    }
  }

  init();
})();
