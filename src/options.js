(function() {
  var SELECTABLE_FORMATS = ['json', 'markdown', 'csv', 'tsv'];
  var currentFolderId = '';

  var els = {
    form: document.getElementById('options-form'),
    defaultFormat: document.getElementById('defaultFormat'),
    filenameTemplate: document.getElementById('filenameTemplate'),
    darkMode: document.getElementById('darkMode'),
    showPreview: document.getElementById('showPreview'),
    autoExportInterval: document.getElementById('autoExportInterval'),
    autoExportStatus: document.getElementById('autoExportStatus'),
    captureStatus: document.getElementById('capture-status'),
    captureStatusText: document.getElementById('capture-status-text'),
    vaultSearch: document.getElementById('vaultSearch'),
    allChatsFolder: document.getElementById('allChatsFolder'),
    folderTree: document.getElementById('folderTree'),
    folderAdd: document.getElementById('folderAdd'),
    folderRename: document.getElementById('folderRename'),
    folderDelete: document.getElementById('folderDelete'),
    platformFilter: document.getElementById('platformFilter'),
    dateFilter: document.getElementById('dateFilter'),
    customDateFields: document.getElementById('customDateFields'),
    dateStart: document.getElementById('dateStart'),
    dateEnd: document.getElementById('dateEnd'),
    tagFilter: document.getElementById('tagFilter'),
    tagQuery: document.getElementById('tagQuery'),
    pinnedOnly: document.getElementById('pinnedOnly'),
    clearFilters: document.getElementById('clearFilters'),
    chatList: document.getElementById('chat-list'),
    chatListSummary: document.getElementById('chat-list-summary'),
    chatDetail: document.getElementById('chat-detail'),
    openOriginal: document.getElementById('open-original'),
    vaultCount: document.getElementById('vault-count'),
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

  function normalizeDefaultFormat(format) {
    return SELECTABLE_FORMATS.indexOf(format) === -1 ? 'json' : format;
  }

  function isStorageUnavailable(error) {
    return !!(error && error.message === 'Browser storage API is unavailable');
  }

  function getDefaultSettings() {
    if (typeof StorageManager !== 'undefined' && StorageManager.defaults) return StorageManager.defaults;
    return {
      defaultFormat: 'json',
      filenameTemplate: '{platform}_{title}_{date}.{ext}',
      darkMode: 'system',
      showPreview: true,
      autoExportInterval: 0,
      lastAutoExportStatus: null,
      lastCaptureStatus: null
    };
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
        defaultFormat: normalizeDefaultFormat(els.defaultFormat.value),
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

  function renderSettings(settings) {
    applyTheme(settings.darkMode);

    if (els.defaultFormat) els.defaultFormat.value = normalizeDefaultFormat(settings.defaultFormat);
    if (els.filenameTemplate) els.filenameTemplate.value = settings.filenameTemplate;
    if (els.darkMode) els.darkMode.value = settings.darkMode;
    if (els.showPreview) els.showPreview.checked = !!settings.showPreview;
    if (els.autoExportInterval) els.autoExportInterval.value = settings.autoExportInterval;

    renderAutoExportStatus(settings.lastAutoExportStatus);
    renderCaptureStatus(settings.lastCaptureStatus);
  }

  function bindThemeWatcher() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
      applyTheme((els.darkMode && els.darkMode.value) || 'system');
    });
  }

  async function initVaultViews() {
    var detail = null;
    var refreshVault = function() {};
    if (els.chatDetail && typeof OptionsChatDetail !== 'undefined') {
      detail = OptionsChatDetail.create({
        root: els.chatDetail,
        openLink: els.openOriginal,
        dao: typeof VaultDAO !== 'undefined' ? VaultDAO : null,
        onTagsChanged: function() {
          refreshVault(true);
        }
      });
    }

    if (!els.chatList || typeof OptionsChatList === 'undefined') return;
    var list = OptionsChatList.create({
      root: els.chatList,
      summaryEl: els.chatListSummary,
      countEl: els.vaultCount,
      onSelect: function(chat) {
        if (detail) detail.load(chat);
      }
    });
    if (typeof VaultSearch !== 'undefined') {
      try {
        var search = VaultSearch.create({ dao: typeof VaultDAO !== 'undefined' ? VaultDAO : null });
        list.setChats(await search.load());
        refreshVault = bindVaultControls(search, list);
        return;
      } catch (error) {
        log('warn', 'options.search.init.failed', { error: serializeError(error) });
      }
    }

    await list.load();
  }

  function selectedOptions(select) {
    if (!select) return [];
    return Array.prototype.slice.call(select.selectedOptions || []).map(function(option) {
      return option.value;
    }).filter(Boolean);
  }

  function selectedTags() {
    var tags = els.tagFilter ? Array.prototype.slice.call(els.tagFilter.querySelectorAll('button[aria-pressed="true"]')).map(function(button) {
      return button.dataset.tag;
    }).filter(Boolean) : [];
    if (els.tagQuery && els.tagQuery.value.trim()) {
      tags = tags.concat(els.tagQuery.value.split(',').map(function(tag) {
        return tag.trim();
      }).filter(Boolean));
    }
    return tags;
  }

  function filterState() {
    return {
      folderId: currentFolderId,
      platforms: selectedOptions(els.platformFilter),
      datePreset: els.dateFilter ? els.dateFilter.value : 'all',
      dateStart: els.dateStart ? els.dateStart.value : '',
      dateEnd: els.dateEnd ? els.dateEnd.value : '',
      tags: selectedTags(),
      pinnedOnly: !!(els.pinnedOnly && els.pinnedOnly.checked)
    };
  }

  function resetFilters() {
    if (els.vaultSearch) els.vaultSearch.value = '';
    if (els.platformFilter) {
      Array.prototype.forEach.call(els.platformFilter.options, function(option) {
        option.selected = false;
      });
    }
    if (els.dateFilter) els.dateFilter.value = 'all';
    if (els.dateStart) els.dateStart.value = '';
    if (els.dateEnd) els.dateEnd.value = '';
    if (els.tagQuery) els.tagQuery.value = '';
    if (els.pinnedOnly) els.pinnedOnly.checked = false;
    if (els.tagFilter) {
      Array.prototype.forEach.call(els.tagFilter.querySelectorAll('button'), function(button) {
        button.setAttribute('aria-pressed', 'false');
      });
    }
    syncCustomDateVisibility();
  }

  function syncCustomDateVisibility() {
    if (!els.customDateFields || !els.dateFilter) return;
    els.customDateFields.hidden = els.dateFilter.value !== 'custom';
  }

  function bindVaultControls(search, list) {
    var serial = 0;

    async function refresh() {
      var token = ++serial;
      var query = els.vaultSearch ? els.vaultSearch.value || '' : '';
      try {
        var source = query.trim() ? await search.search(query, 100) : search.getChats();
        var chats = typeof OptionsFilters !== 'undefined' ? OptionsFilters.apply(source, filterState()) : source;
        if (token === serial) list.setChats(chats);
      } catch (error) {
        log('error', 'options.search.failed', { error: serializeError(error), query: query });
      }
    }

    if (els.vaultSearch) els.vaultSearch.addEventListener('input', refresh);
    if (els.platformFilter) els.platformFilter.addEventListener('change', refresh);
    if (els.dateFilter) {
      els.dateFilter.addEventListener('change', function() {
        syncCustomDateVisibility();
        refresh();
      });
    }
    if (els.dateStart) els.dateStart.addEventListener('change', refresh);
    if (els.dateEnd) els.dateEnd.addEventListener('change', refresh);
    if (els.tagQuery) els.tagQuery.addEventListener('input', refresh);
    if (els.pinnedOnly) els.pinnedOnly.addEventListener('change', refresh);
    if (els.tagFilter) {
      els.tagFilter.addEventListener('click', function(event) {
        var button = event.target.closest('button[data-tag]');
        if (!button) return;
        button.setAttribute('aria-pressed', button.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        refresh();
      });
    }
    if (els.clearFilters) {
      els.clearFilters.addEventListener('click', function() {
        resetFilters();
        refresh();
      });
    }
    if (els.folderTree && typeof OptionsFolders !== 'undefined') {
      var folders = OptionsFolders.create({
        root: els.folderTree,
        dao: typeof VaultDAO !== 'undefined' ? VaultDAO : null,
        allButton: els.allChatsFolder,
        onSelect: function(folderId) {
          currentFolderId = folderId || '';
          refresh();
        },
        onChange: async function() {
          await search.load();
          await refresh();
        }
      });
      folders.bindControls(els.folderAdd, els.folderRename, els.folderDelete, els.allChatsFolder);
      folders.load().catch(function(error) {
        log('error', 'options.folders.load.failed', { error: serializeError(error) });
      });
    }
    syncCustomDateVisibility();
    return async function(reload) {
      if (reload) await search.load();
      await refresh();
    };
  }

  async function init() {
    try {
      var settings = await StorageManager.getAll();
      renderSettings(settings);
      await refreshDiagnostics();
      await refreshHistorySummary();
      await initVaultViews();
      wireEvents();
      bindThemeWatcher();

      log('info', 'options.init.complete', {
        defaultFormat: settings.defaultFormat,
        showPreview: !!settings.showPreview,
        autoExportInterval: settings.autoExportInterval
      });
    } catch (error) {
      if (isStorageUnavailable(error)) {
        var defaults = getDefaultSettings();
        renderSettings(defaults);
        renderDiagnostics([]);
        if (els.historySummary) els.historySummary.textContent = 'No exports captured yet.';
        await initVaultViews();
        wireEvents();
        bindThemeWatcher();
        log('info', 'options.init.local_storage_unavailable', { error: serializeError(error) });
        return;
      }
      log('error', 'options.init.failed', { error: serializeError(error) });
      if (els.saveStatus) els.saveStatus.textContent = 'Initialization failed';
    }
  }

  init();
})();
