(function() {
  var SELECTABLE_FORMATS = ['json', 'markdown', 'csv', 'tsv'];
  var DEFAULT_THREAD_TAG_PRIORITY = ['FIXME', 'TODO', 'UNRESOLVED', 'FOLLOWUP', 'REV', 'REF', 'PROMPT'];
  var BUILT_IN_THREAD_TAGS = DEFAULT_THREAD_TAG_PRIORITY.slice();
  var currentFolderId = '';
  var currentThreadTagPriority = DEFAULT_THREAD_TAG_PRIORITY.slice();
  var currentCustomThreadTags = [];
  var threadPane = null;

  var els = {
    form: document.getElementById('options-form'),
    defaultFormat: document.getElementById('defaultFormat'),
    filenameTemplate: document.getElementById('filenameTemplate'),
    darkMode: document.getElementById('darkMode'),
    colorscheme: document.getElementById('colorscheme'),
    tagPriorityList: document.getElementById('tagPriorityList'),
    customThreadTagsList: document.getElementById('customThreadTagsList'),
    customThreadTagName: document.getElementById('customThreadTagName'),
    customThreadTagColor: document.getElementById('customThreadTagColor'),
    customThreadTagAdd: document.getElementById('customThreadTagAdd'),
    showPreview: document.getElementById('showPreview'),
    autoExportInterval: document.getElementById('autoExportInterval'),
    autoExportStatus: document.getElementById('autoExportStatus'),
    captureStatus: document.getElementById('capture-status'),
    captureStatusText: document.getElementById('capture-status-text'),
    rescanThreads: document.getElementById('rescanThreads'),
    rescanStatus: document.getElementById('rescanStatus'),
    statsTotalChats: document.getElementById('statsTotalChats'),
    statsTotalMessages: document.getElementById('statsTotalMessages'),
    statsStorageUsed: document.getElementById('statsStorageUsed'),
    statsOldestChat: document.getElementById('statsOldestChat'),
    statsNewestChat: document.getElementById('statsNewestChat'),
    statsPlatformBreakdown: document.getElementById('statsPlatformBreakdown'),
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
    detailPin: document.getElementById('detailPin'),
    sendToNewChat: document.getElementById('sendToNewChat'),
    restoreClipboard: document.getElementById('restoreClipboard'),
    openThreadsList: document.getElementById('openThreadsList'),
    archiveSelectedThreads: document.getElementById('archiveSelectedThreads'),
    threadListSummary: document.getElementById('threadListSummary'),
    threadTagFilter: document.getElementById('threadTagFilter'),
    threadChatFilter: document.getElementById('threadChatFilter'),
    threadPlatformFilter: document.getElementById('threadPlatformFilter'),
    threadStatusFilter: document.getElementById('threadStatusFilter'),
    threadShowDone: document.getElementById('threadShowDone'),
    threadSourceFilter: document.getElementById('threadSourceFilter'),
    threadSubSourceFilter: document.getElementById('threadSubSourceFilter'),
    threadSort: document.getElementById('threadSort'),
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
    var effectiveMode = mode === 'dark' || (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    if (effectiveMode === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    document.documentElement.dataset.themeMode = effectiveMode;
    return effectiveMode;
  }

  function normalizeColorscheme(id) {
    if (typeof OwlColorschemes === 'undefined') return id || 'gruvbox';
    return OwlColorschemes.get(id).id;
  }

  function populateColorschemes() {
    if (!els.colorscheme || typeof OwlColorschemes === 'undefined' || els.colorscheme.options.length) return;
    OwlColorschemes.all().forEach(function(scheme) {
      var option = document.createElement('option');
      option.value = scheme.id;
      option.textContent = scheme.name;
      els.colorscheme.appendChild(option);
    });
  }

  function applyColorscheme(id, mode) {
    if (typeof OwlColorschemes === 'undefined') return;
    OwlColorschemes.apply(document, normalizeColorscheme(id), mode || document.documentElement.dataset.themeMode || 'dark');
  }

  function applyAppearance() {
    var mode = applyTheme((els.darkMode && els.darkMode.value) || 'system');
    applyColorscheme(els.colorscheme ? els.colorscheme.value : 'gruvbox', mode);
  }

  function normalizeDefaultFormat(format) {
    return SELECTABLE_FORMATS.indexOf(format) === -1 ? 'json' : format;
  }

  function normalizeThreadTagName(value) {
    if (typeof ThreadScanner !== 'undefined' && ThreadScanner.normalizeTagName) return ThreadScanner.normalizeTagName(value);
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function normalizeColor(value) {
    value = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : '#888888';
  }

  function normalizeCustomThreadTags(tags) {
    var seen = {};
    var result = [];
    (Array.isArray(tags) ? tags : []).forEach(function(entry) {
      var tag = normalizeThreadTagName(entry && typeof entry === 'object' ? entry.tag : entry);
      if (!tag || seen[tag] || BUILT_IN_THREAD_TAGS.indexOf(tag) !== -1) return;
      seen[tag] = true;
      result.push({ tag: tag, color: normalizeColor(entry && entry.color) });
    });
    return result;
  }

  function allThreadTags() {
    return DEFAULT_THREAD_TAG_PRIORITY.concat(currentCustomThreadTags.map(function(entry) {
      return entry.tag;
    }));
  }

  function normalizeThreadTagPriority(priority) {
    var seen = {};
    var tags = [];
    var allowed = allThreadTags();
    (Array.isArray(priority) ? priority : []).forEach(function(tag) {
      tag = normalizeThreadTagName(tag);
      if (allowed.indexOf(tag) === -1 || seen[tag]) return;
      seen[tag] = true;
      tags.push(tag);
    });
    allowed.forEach(function(tag) {
      if (seen[tag]) return;
      seen[tag] = true;
      tags.push(tag);
    });
    return tags;
  }

  function moveThreadTagPriority(index, delta) {
    var nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= currentThreadTagPriority.length) return;
    var next = currentThreadTagPriority.slice();
    var tag = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = tag;
    renderThreadTagPriority(next);
    if (threadPane && threadPane.setTagPriority) threadPane.setTagPriority(currentThreadTagPriority);
  }

  function renderThreadTagPriority(priority) {
    currentThreadTagPriority = normalizeThreadTagPriority(priority);
    if (!els.tagPriorityList) return;
    els.tagPriorityList.innerHTML = '';
    currentThreadTagPriority.forEach(function(tag, index) {
      var item = document.createElement('li');
      item.className = 'tag-priority-row';
      item.dataset.tag = tag;
      var label = document.createElement('strong');
      label.textContent = tag;
      item.appendChild(label);

      var actions = document.createElement('div');
      actions.className = 'tag-priority-actions';
      var up = document.createElement('button');
      up.type = 'button';
      up.className = 'btn btn-ghost';
      up.textContent = 'Up';
      up.disabled = index === 0;
      up.setAttribute('aria-label', 'Move ' + tag + ' up');
      up.addEventListener('click', function() {
        moveThreadTagPriority(index, -1);
      });
      actions.appendChild(up);

      var down = document.createElement('button');
      down.type = 'button';
      down.className = 'btn btn-ghost';
      down.textContent = 'Down';
      down.disabled = index === currentThreadTagPriority.length - 1;
      down.setAttribute('aria-label', 'Move ' + tag + ' down');
      down.addEventListener('click', function() {
        moveThreadTagPriority(index, 1);
      });
      actions.appendChild(down);

      item.appendChild(actions);
      els.tagPriorityList.appendChild(item);
    });
  }

  function renderThreadTagFilter() {
    if (!els.threadTagFilter) return;
    var selected = els.threadTagFilter.value;
    els.threadTagFilter.innerHTML = '';
    var all = document.createElement('option');
    all.value = '';
    all.textContent = 'All tags';
    els.threadTagFilter.appendChild(all);
    allThreadTags().forEach(function(tag) {
      var option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      els.threadTagFilter.appendChild(option);
    });
    els.threadTagFilter.value = allThreadTags().indexOf(selected) === -1 ? '' : selected;
  }

  function renderCustomThreadTags(tags) {
    currentCustomThreadTags = normalizeCustomThreadTags(tags);
    renderThreadTagPriority(currentThreadTagPriority);
    renderThreadTagFilter();
    if (threadPane && threadPane.setTagPriority) threadPane.setTagPriority(currentThreadTagPriority);
    if (!els.customThreadTagsList) return;
    els.customThreadTagsList.innerHTML = '';
    if (!currentCustomThreadTags.length) {
      var empty = document.createElement('p');
      empty.className = 'panel-note';
      empty.textContent = 'No custom thread tags.';
      els.customThreadTagsList.appendChild(empty);
      return;
    }
    currentCustomThreadTags.forEach(function(entry) {
      var row = document.createElement('div');
      row.className = 'custom-thread-tag-row';
      row.dataset.tag = entry.tag;
      var swatch = document.createElement('span');
      swatch.className = 'custom-thread-tag-swatch';
      swatch.style.backgroundColor = entry.color;
      row.appendChild(swatch);
      var label = document.createElement('strong');
      label.textContent = entry.tag;
      row.appendChild(label);
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-ghost';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove custom thread tag ' + entry.tag);
      remove.addEventListener('click', function() {
        renderCustomThreadTags(currentCustomThreadTags.filter(function(item) {
          return item.tag !== entry.tag;
        }));
      });
      row.appendChild(remove);
      els.customThreadTagsList.appendChild(row);
    });
  }

  function addCustomThreadTag() {
    if (!els.customThreadTagName) return;
    var tag = normalizeThreadTagName(els.customThreadTagName.value);
    if (!tag || BUILT_IN_THREAD_TAGS.indexOf(tag) !== -1) return;
    var tags = currentCustomThreadTags.filter(function(entry) {
      return entry.tag !== tag;
    });
    tags.push({ tag: tag, color: normalizeColor(els.customThreadTagColor && els.customThreadTagColor.value) });
    els.customThreadTagName.value = '';
    renderCustomThreadTags(tags);
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
      colorscheme: 'gruvbox',
      threadTagPriority: DEFAULT_THREAD_TAG_PRIORITY.slice(),
      customThreadTags: [],
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

  function defaultStats() {
    return {
      totalChats: 0,
      totalMessages: 0,
      oldestChat: null,
      newestChat: null,
      perPlatform: []
    };
  }

  function formatNumber(value) {
    return String(Number(value || 0).toLocaleString());
  }

  function formatMB(value) {
    return (Math.round(Number(value || 0) * 100) / 100).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }) + ' MB';
  }

  function chatStatLabel(chat) {
    if (!chat) return 'None';
    return String(chat.title || chat.chatId || 'Untitled chat');
  }

  function renderStats(stats, quota) {
    if (!els.statsTotalChats) return;
    stats = stats || defaultStats();
    quota = quota || {};
    els.statsTotalChats.textContent = formatNumber(stats.totalChats);
    els.statsTotalMessages.textContent = formatNumber(stats.totalMessages);
    els.statsStorageUsed.textContent = formatMB(quota.usageMB);
    els.statsOldestChat.textContent = chatStatLabel(stats.oldestChat);
    els.statsNewestChat.textContent = chatStatLabel(stats.newestChat);
    if (els.statsPlatformBreakdown) {
      var rows = Array.isArray(stats.perPlatform) ? stats.perPlatform : [];
      els.statsPlatformBreakdown.textContent = rows.length ? rows.map(function(row) {
        return String(row.platform || 'unknown') + ': ' + formatNumber(row.chats) + ' chats, ' + formatNumber(row.messages) + ' messages';
      }).join(' | ') : 'None';
    }
  }

  function threadKey(thread) {
    return [thread.messageId || '', thread.tag || '', thread.text || ''].join('\n');
  }

  async function rescanThreads(refreshVault) {
    if (!els.rescanThreads) return;
    var previous = els.rescanThreads.textContent;
    els.rescanThreads.disabled = true;
    els.rescanThreads.textContent = 'Scanning';
    if (els.rescanStatus) els.rescanStatus.textContent = 'Scanning...';

    try {
      if (typeof ThreadScanner === 'undefined' || !ThreadScanner.scanMessage) throw new Error('Thread scanner is unavailable');
      if (typeof VaultDAO === 'undefined' || !VaultDAO.listAllMessages || !VaultDAO.listOpenThreads || !VaultDAO.putOpenThreads) {
        throw new Error('Vault thread store is unavailable');
      }

      var existing = await VaultDAO.listOpenThreads();
      var seen = {};
      existing.forEach(function(thread) {
        seen[threadKey(thread)] = true;
      });

      var rows = [];
      var messages = await VaultDAO.listAllMessages();
      messages.forEach(function(message) {
        ThreadScanner.scanMessage(message, { customTags: currentCustomThreadTags }).forEach(function(thread) {
          var key = threadKey(thread);
          if (seen[key]) return;
          seen[key] = true;
          rows.push(thread);
        });
      });
      if (rows.length) await VaultDAO.putOpenThreads(rows);
      if (els.rescanStatus) els.rescanStatus.textContent = 'Added ' + rows.length + ' threads';
      if (refreshVault) await refreshVault(true);
      else await refreshVaultStats();
      log('info', 'options.threads.rescan.success', { addedThreads: rows.length, scannedMessages: messages.length });
    } catch (error) {
      if (els.rescanStatus) els.rescanStatus.textContent = 'Rescan failed';
      log('error', 'options.threads.rescan.failed', { error: serializeError(error) });
    } finally {
      els.rescanThreads.disabled = false;
      els.rescanThreads.textContent = previous;
    }
  }

  async function refreshVaultStats() {
    try {
      var stats = typeof VaultDAO !== 'undefined' && VaultDAO.getStats ? await VaultDAO.getStats() : defaultStats();
      var quota = typeof VaultQuota !== 'undefined' && VaultQuota.getQuotaUsage ? await VaultQuota.getQuotaUsage() : { usageMB: 0 };
      renderStats(stats, quota);
    } catch (error) {
      log('error', 'options.stats.refresh.failed', { error: serializeError(error) });
      renderStats(defaultStats(), { usageMB: 0 });
    }
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
      var colorscheme = normalizeColorscheme(els.colorscheme ? els.colorscheme.value : 'gruvbox');
      var payload = {
        defaultFormat: normalizeDefaultFormat(els.defaultFormat.value),
        filenameTemplate: els.filenameTemplate.value,
        darkMode: darkMode,
        colorscheme: colorscheme,
        threadTagPriority: currentThreadTagPriority.slice(),
        customThreadTags: currentCustomThreadTags.slice(),
        showPreview: !!els.showPreview.checked,
        autoExportInterval: parseInt(els.autoExportInterval.value, 10) || 0
      };

      await StorageManager.setAll(payload);
      applyTheme(darkMode);
      applyColorscheme(colorscheme, document.documentElement.dataset.themeMode);

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

  function wireEvents(refreshVault) {
    if (els.form) els.form.addEventListener('submit', handleSave);
    if (els.downloadDiagnostics) els.downloadDiagnostics.addEventListener('click', downloadDiagnostics);
    if (els.clearDiagnostics) els.clearDiagnostics.addEventListener('click', clearDiagnostics);
    if (els.downloadHistory) els.downloadHistory.addEventListener('click', downloadHistory);
    if (els.clearHistory) els.clearHistory.addEventListener('click', clearHistory);
    if (els.customThreadTagAdd) els.customThreadTagAdd.addEventListener('click', addCustomThreadTag);
    if (els.customThreadTagName) {
      els.customThreadTagName.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        addCustomThreadTag();
      });
    }
    if (els.rescanThreads) {
      els.rescanThreads.addEventListener('click', function() {
        rescanThreads(refreshVault);
      });
    }
    if (els.colorscheme) {
      els.colorscheme.addEventListener('change', function() {
        applyColorscheme(els.colorscheme.value, document.documentElement.dataset.themeMode);
      });
    }
    if (els.darkMode) {
      els.darkMode.addEventListener('change', function() {
        applyAppearance();
      });
    }
  }

  function renderSettings(settings) {
    populateColorschemes();

    if (els.defaultFormat) els.defaultFormat.value = normalizeDefaultFormat(settings.defaultFormat);
    if (els.filenameTemplate) els.filenameTemplate.value = settings.filenameTemplate;
    if (els.darkMode) els.darkMode.value = settings.darkMode;
    if (els.colorscheme) els.colorscheme.value = normalizeColorscheme(settings.colorscheme);
    renderCustomThreadTags(settings.customThreadTags);
    renderThreadTagPriority(settings.threadTagPriority);
    if (els.showPreview) els.showPreview.checked = !!settings.showPreview;
    if (els.autoExportInterval) els.autoExportInterval.value = settings.autoExportInterval;
    applyAppearance();

    renderAutoExportStatus(settings.lastAutoExportStatus);
    renderCaptureStatus(settings.lastCaptureStatus);
  }

  function bindThemeWatcher() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
      applyAppearance();
    });
  }

  async function initVaultViews() {
    var detail = null;
    threadPane = null;
    async function refreshThreads() {
      if (threadPane) await threadPane.load();
    }
    var refreshVault = async function() {
      await refreshVaultStats();
      await refreshThreads();
    };
    if (els.chatDetail && typeof OptionsChatDetail !== 'undefined') {
      detail = OptionsChatDetail.create({
        root: els.chatDetail,
        openLink: els.openOriginal,
        pinButton: els.detailPin,
        sendButton: els.sendToNewChat,
        restoreButton: els.restoreClipboard,
        getCustomThreadTags: function() {
          return currentCustomThreadTags;
        },
        dao: typeof VaultDAO !== 'undefined' ? VaultDAO : null,
        onTagsChanged: function() {
          refreshVault(true);
        },
        onPinChanged: function() {
          refreshVault(true);
        }
      });
    }
    if (els.openThreadsList && typeof OptionsOpenThreads !== 'undefined') {
      threadPane = OptionsOpenThreads.create({
        root: els.openThreadsList,
        summaryEl: els.threadListSummary,
        archiveButton: els.archiveSelectedThreads,
        tagPriority: currentThreadTagPriority,
        dao: typeof VaultDAO !== 'undefined' ? VaultDAO : null,
        filters: {
          tag: els.threadTagFilter,
          chat: els.threadChatFilter,
          platform: els.threadPlatformFilter,
          status: els.threadStatusFilter,
          showDone: els.threadShowDone,
          source: els.threadSourceFilter,
          subSource: els.threadSubSourceFilter,
          sort: els.threadSort
        },
        onSelect: function(thread) {
          if (detail && thread.chat) detail.load(thread.chat);
        },
        onChange: function() {
          refreshVault(true);
        }
      });
    }

    if (!els.chatList || typeof OptionsChatList === 'undefined') return refreshVault;
    var list = OptionsChatList.create({
      root: els.chatList,
      summaryEl: els.chatListSummary,
      countEl: els.vaultCount,
      onSelect: function(chat) {
        if (detail) detail.load(chat);
      },
      onPinToggle: async function(chat, pinned) {
        if (typeof VaultDAO === 'undefined' || !VaultDAO.setChatPinned) return null;
        var updated = await VaultDAO.setChatPinned(chat.chatId, pinned);
        await refreshVault(true);
        return updated;
      }
    });
    if (typeof VaultSearch !== 'undefined') {
      try {
        var search = VaultSearch.create({ dao: typeof VaultDAO !== 'undefined' ? VaultDAO : null });
        list.setChats(await search.load());
        await refreshThreads();
        refreshVault = bindVaultControls(search, list, refreshThreads);
        return refreshVault;
      } catch (error) {
        log('warn', 'options.search.init.failed', { error: serializeError(error) });
      }
    }

    await list.load();
    await refreshThreads();
    return async function() {
      await list.load();
      await refreshThreads();
      await refreshVaultStats();
    };
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

  function bindVaultControls(search, list, refreshThreads) {
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
      if (refreshThreads) await refreshThreads();
      await refreshVaultStats();
    };
  }

  function bindCaptureRefresh(refreshVault) {
    if (typeof api === 'undefined' || !api.storage || !api.storage.onChanged || !api.storage.onChanged.addListener) return;
    api.storage.onChanged.addListener(function(changes, areaName) {
      if (areaName && areaName !== 'local') return;
      if (!changes.lastCaptureStatus) return;
      renderCaptureStatus(changes.lastCaptureStatus.newValue);
      Promise.resolve(refreshVault ? refreshVault(true) : refreshVaultStats()).catch(function(error) {
        log('error', 'options.capture_refresh.failed', { error: serializeError(error) });
      });
    });
  }

  async function init() {
    try {
      var settings = await StorageManager.getAll();
      renderSettings(settings);
      await refreshDiagnostics();
      await refreshHistorySummary();
      var refreshVault = await initVaultViews();
      await refreshVaultStats();
      wireEvents(refreshVault);
      bindThemeWatcher();
      bindCaptureRefresh(refreshVault);

      log('info', 'options.init.complete', {
        defaultFormat: settings.defaultFormat,
        colorscheme: normalizeColorscheme(settings.colorscheme),
        showPreview: !!settings.showPreview,
        autoExportInterval: settings.autoExportInterval
      });
    } catch (error) {
      if (isStorageUnavailable(error)) {
        var defaults = getDefaultSettings();
        renderSettings(defaults);
        renderDiagnostics([]);
        if (els.historySummary) els.historySummary.textContent = 'No exports captured yet.';
        var localRefreshVault = await initVaultViews();
        await refreshVaultStats();
        wireEvents(localRefreshVault);
        bindThemeWatcher();
        bindCaptureRefresh(localRefreshVault);
        log('info', 'options.init.local_storage_unavailable', { error: serializeError(error) });
        return;
      }
      log('error', 'options.init.failed', { error: serializeError(error) });
      if (els.saveStatus) els.saveStatus.textContent = 'Initialization failed';
    }
  }

  init();
})();
