(function() {
  var els = {
    form: document.getElementById('options-form'),
    defaultFormat: document.getElementById('defaultFormat'),
    filenameTemplate: document.getElementById('filenameTemplate'),
    darkMode: document.getElementById('darkMode'),
    showPreview: document.getElementById('showPreview'),
    autoExportInterval: document.getElementById('autoExportInterval'),
    autoExportStatus: document.getElementById('autoExportStatus'),
    saveStatus: document.getElementById('save-status'),
    diagnosticsList: document.getElementById('diagnostics-list'),
    downloadDiagnostics: document.getElementById('download-diagnostics'),
    clearDiagnostics: document.getElementById('clear-diagnostics'),
    historySummary: document.getElementById('history-summary'),
    downloadHistory: document.getElementById('download-history'),
    clearHistory: document.getElementById('clear-history')
  };

  function serializeError(error) {
    if (typeof AppLogger !== 'undefined') return AppLogger.serializeError(error);
    return {
      name: error && error.name ? error.name : 'Error',
      message: error && error.message ? error.message : String(error || 'Unknown error'),
      stack: error && error.stack ? error.stack : ''
    };
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
    if (mode === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (mode === 'light') document.documentElement.removeAttribute('data-theme');
    else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
  }

  function renderAutoExportStatus(status) {
    if (!els.autoExportStatus) return;
    if (!status || !status.message) {
      els.autoExportStatus.textContent = 'Auto-export has not run yet.';
      return;
    }

    var prefix = status.state === 'error' ? 'Error' : status.state === 'success' ? 'Success' : 'Status';
    var timestamp = status.timestamp ? new Date(status.timestamp).toLocaleString() : '';
    var traceId = status.traceId ? ' | trace: ' + status.traceId : '';
    els.autoExportStatus.textContent = prefix + ': ' + status.message + (timestamp ? ' (' + timestamp + ')' : '') + traceId;
  }

  function makeBlobDownload(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(function() {
      URL.revokeObjectURL(url);
    }, 1200);
  }

  function renderDiagnostics(logs) {
    if (!els.diagnosticsList) return;
    els.diagnosticsList.innerHTML = '';

    if (!logs.length) {
      var empty = document.createElement('li');
      empty.textContent = 'No diagnostics captured yet.';
      els.diagnosticsList.appendChild(empty);
      return;
    }

    logs.forEach(function(entry) {
      var item = document.createElement('li');

      var meta = document.createElement('div');
      meta.className = 'log-meta';

      var level = document.createElement('span');
      level.className = 'log-level ' + (entry.level || 'info');
      level.textContent = entry.level || 'info';
      meta.appendChild(level);

      var event = document.createElement('strong');
      event.textContent = entry.event || 'unknown.event';
      meta.appendChild(event);

      var when = document.createElement('span');
      when.textContent = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '';
      meta.appendChild(when);

      item.appendChild(meta);

      var message = document.createElement('div');
      var details = entry.details && entry.details.message ? entry.details.message : '';
      var traceId = entry.traceId ? 'Trace: ' + entry.traceId : '';
      message.textContent = [details, traceId].filter(Boolean).join(' | ') || 'No extra details.';
      item.appendChild(message);

      els.diagnosticsList.appendChild(item);
    });
  }

  async function refreshDiagnostics() {
    try {
      var logs = [];
      if (typeof AppLogger !== 'undefined') logs = await AppLogger.getRecent(25);
      renderDiagnostics(logs);
    } catch (error) {
      log('error', 'options.diagnostics.refresh.failed', { error: serializeError(error) });
      renderDiagnostics([]);
    }
  }

  async function refreshHistorySummary() {
    if (!els.historySummary) return;

    try {
      var history = await ExportHistory.getAll();
      if (!history.length) {
        els.historySummary.textContent = 'No exports captured yet.';
        return;
      }

      var last = history[0];
      var lastWhen = last.timestamp ? new Date(last.timestamp).toLocaleString() : 'Unknown time';
      els.historySummary.textContent =
        'Total exports: ' + history.length +
        ' | Last: ' + (last.format || 'unknown').toUpperCase() +
        ' from ' + (last.platform || 'unknown') +
        ' at ' + lastWhen +
        ' (' + (last.messageCount || 0) + ' messages).';
    } catch (error) {
      log('error', 'options.history.refresh.failed', { error: serializeError(error) });
      els.historySummary.textContent = 'Unable to load export history.';
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    try {
      var darkMode = els.darkMode.value;
      var payload = {
        defaultFormat: els.defaultFormat.value,
        filenameTemplate: els.filenameTemplate.value,
        darkMode: darkMode,
        showPreview: !!els.showPreview.checked,
        autoExportInterval: parseInt(els.autoExportInterval.value, 10) || 0
      };

      await StorageManager.setAll(payload);
      applyTheme(darkMode);

      if (els.saveStatus) {
        els.saveStatus.textContent = 'Saved';
        setTimeout(function() {
          els.saveStatus.textContent = '';
        }, 2200);
      }

      log('info', 'options.save.success', payload);
    } catch (error) {
      log('error', 'options.save.failed', { error: serializeError(error) });
      if (els.saveStatus) {
        els.saveStatus.textContent = 'Save failed';
      }
    }
  }

  async function downloadDiagnostics() {
    try {
      var logs = typeof AppLogger !== 'undefined' ? await AppLogger.getRecent(400) : [];
      makeBlobDownload('rakuzaichi_diagnostics.json', JSON.stringify(logs, null, 2), 'application/json;charset=utf-8');
      log('info', 'options.diagnostics.downloaded', { count: logs.length });
    } catch (error) {
      log('error', 'options.diagnostics.download.failed', { error: serializeError(error) });
    }
  }

  async function clearDiagnostics() {
    try {
      if (typeof AppLogger !== 'undefined') await AppLogger.clear();
      await refreshDiagnostics();
      log('warn', 'options.diagnostics.cleared', {});
    } catch (error) {
      log('error', 'options.diagnostics.clear.failed', { error: serializeError(error) });
    }
  }

  async function downloadHistory() {
    try {
      var history = await ExportHistory.getAll();
      makeBlobDownload('rakuzaichi_export_history.json', JSON.stringify(history, null, 2), 'application/json;charset=utf-8');
      log('info', 'options.history.downloaded', { count: history.length });
    } catch (error) {
      log('error', 'options.history.download.failed', { error: serializeError(error) });
    }
  }

  async function clearHistory() {
    try {
      await ExportHistory.clear();
      await refreshHistorySummary();
      log('warn', 'options.history.cleared', {});
    } catch (error) {
      log('error', 'options.history.clear.failed', { error: serializeError(error) });
    }
  }

  function wireEvents() {
    if (els.form) els.form.addEventListener('submit', handleSave);
    if (els.downloadDiagnostics) els.downloadDiagnostics.addEventListener('click', downloadDiagnostics);
    if (els.clearDiagnostics) els.clearDiagnostics.addEventListener('click', clearDiagnostics);
    if (els.downloadHistory) els.downloadHistory.addEventListener('click', downloadHistory);
    if (els.clearHistory) els.clearHistory.addEventListener('click', clearHistory);
  }

  async function init() {
    try {
      var settings = await StorageManager.getAll();
      applyTheme(settings.darkMode);

      if (els.defaultFormat) els.defaultFormat.value = settings.defaultFormat;
      if (els.filenameTemplate) els.filenameTemplate.value = settings.filenameTemplate;
      if (els.darkMode) els.darkMode.value = settings.darkMode;
      if (els.showPreview) els.showPreview.checked = !!settings.showPreview;
      if (els.autoExportInterval) els.autoExportInterval.value = settings.autoExportInterval;

      renderAutoExportStatus(settings.lastAutoExportStatus);
      await refreshDiagnostics();
      await refreshHistorySummary();
      wireEvents();

      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
        applyTheme((els.darkMode && els.darkMode.value) || 'system');
      });

      log('info', 'options.init.complete', {
        defaultFormat: settings.defaultFormat,
        showPreview: !!settings.showPreview,
        autoExportInterval: settings.autoExportInterval
      });
    } catch (error) {
      log('error', 'options.init.failed', { error: serializeError(error) });
      if (els.saveStatus) els.saveStatus.textContent = 'Initialization failed';
    }
  }

  init();
})();
