(function() {
  var SELECTABLE_FORMATS = ['json', 'markdown', 'csv', 'tsv'];
  var DEFAULT_THREAD_TAG_PRIORITY = ['FIXME', 'TODO', 'UNRESOLVED', 'FOLLOWUP', 'REV', 'REF', 'PROMPT'];
  var BUILT_IN_THREAD_TAGS = DEFAULT_THREAD_TAG_PRIORITY.slice();
  var currentFolderId = '';
  var currentThreadTagPriority = DEFAULT_THREAD_TAG_PRIORITY.slice();
  var currentCustomThreadTags = [];
  var currentExtractionModel = 'qwen2.5-0.5b-q4';
  var currentPromptApiAvailability = { status: 'unknown', available: false, api: 'none' };
  var currentBatchExtractionController = null;
  var currentRagController = null;
  var currentChatImportController = null;
  var currentEmailImportController = null;
  var latestWrappedStats = null;
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
    extractionModel: document.getElementById('extractionModel'),
    extractionBackendStatus: document.getElementById('extractionBackendStatus'),
    showPreview: document.getElementById('showPreview'),
    autoExportInterval: document.getElementById('autoExportInterval'),
    autoExportStatus: document.getElementById('autoExportStatus'),
    captureStatus: document.getElementById('capture-status'),
    captureStatusText: document.getElementById('capture-status-text'),
    runExtractionAll: document.getElementById('runExtractionAll'),
    stopExtractionAll: document.getElementById('stopExtractionAll'),
    extractionStatus: document.getElementById('extractionStatus'),
    rescanThreads: document.getElementById('rescanThreads'),
    rescanStatus: document.getElementById('rescanStatus'),
    importDocsFiles: document.getElementById('importDocsFiles'),
    importDocsFolder: document.getElementById('importDocsFolder'),
    docsImportFiles: document.getElementById('docsImportFiles'),
    docsImportFolderFiles: document.getElementById('docsImportFolderFiles'),
    docsImportDrop: document.getElementById('docsImportDrop'),
    docsImportStatus: document.getElementById('docsImportStatus'),
    importSlackZip: document.getElementById('importSlackZip'),
    importSlackFolder: document.getElementById('importSlackFolder'),
    slackImportZipFile: document.getElementById('slackImportZipFile'),
    slackImportFolderFiles: document.getElementById('slackImportFolderFiles'),
    importDiscordZip: document.getElementById('importDiscordZip'),
    importDiscordFolder: document.getElementById('importDiscordFolder'),
    discordImportZipFile: document.getElementById('discordImportZipFile'),
    discordImportFolderFiles: document.getElementById('discordImportFolderFiles'),
    cancelChatImport: document.getElementById('cancelChatImport'),
    chatImportStatus: document.getElementById('chatImportStatus'),
    importEmailFiles: document.getElementById('importEmailFiles'),
    importEmailFolder: document.getElementById('importEmailFolder'),
    emailImportFiles: document.getElementById('emailImportFiles'),
    emailImportFolderFiles: document.getElementById('emailImportFolderFiles'),
    cancelEmailImport: document.getElementById('cancelEmailImport'),
    emailImportStatus: document.getElementById('emailImportStatus'),
    statsTotalChats: document.getElementById('statsTotalChats'),
    statsTotalMessages: document.getElementById('statsTotalMessages'),
    statsStorageUsed: document.getElementById('statsStorageUsed'),
    statsOldestChat: document.getElementById('statsOldestChat'),
    statsNewestChat: document.getElementById('statsNewestChat'),
    statsPlatformBreakdown: document.getElementById('statsPlatformBreakdown'),
    wrappedStats: document.getElementById('wrappedStats'),
    wrappedRenderTime: document.getElementById('wrappedRenderTime'),
    wrappedSharePng: document.getElementById('wrappedSharePng'),
    wrappedMostActivePlatform: document.getElementById('wrappedMostActivePlatform'),
    wrappedMostActivePlatformDetail: document.getElementById('wrappedMostActivePlatformDetail'),
    wrappedBusiestDay: document.getElementById('wrappedBusiestDay'),
    wrappedBusiestDayDetail: document.getElementById('wrappedBusiestDayDetail'),
    wrappedLongestChat: document.getElementById('wrappedLongestChat'),
    wrappedLongestChatDetail: document.getElementById('wrappedLongestChatDetail'),
    wrappedTopTopics: document.getElementById('wrappedTopTopics'),
    wrappedStatus: document.getElementById('wrappedStatus'),
    ragSearch: document.getElementById('ragSearch'),
    ragDownloadModel: document.getElementById('ragDownloadModel'),
    ragBuildIndex: document.getElementById('ragBuildIndex'),
    ragStopIndex: document.getElementById('ragStopIndex'),
    ragClearIndex: document.getElementById('ragClearIndex'),
    ragClearModelCache: document.getElementById('ragClearModelCache'),
    ragRunSearch: document.getElementById('ragRunSearch'),
    ragStatus: document.getElementById('ragStatus'),
    ragResults: document.getElementById('ragResults'),
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
    bulkExportSummary: document.getElementById('bulkExportSummary'),
    bulkExportFormat: document.getElementById('bulkExportFormat'),
    bulkExportSelected: document.getElementById('bulkExportSelected'),
    chatDetail: document.getElementById('chat-detail'),
    openOriginal: document.getElementById('open-original'),
    detailPin: document.getElementById('detailPin'),
    runExtractionChat: document.getElementById('runExtractionChat'),
    stopExtractionChat: document.getElementById('stopExtractionChat'),
    detailExtractionStatus: document.getElementById('detailExtractionStatus'),
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
    extractionRunsList: document.getElementById('extraction-runs-list'),
    downloadDiagnostics: document.getElementById('download-diagnostics'),
    clearDiagnostics: document.getElementById('clear-diagnostics'),
    historySummary: document.getElementById('history-summary'),
    downloadHistory: document.getElementById('download-history'),
    clearHistory: document.getElementById('clear-history'),
    chooseObsidianVault: document.getElementById('chooseObsidianVault'),
    syncObsidianVault: document.getElementById('syncObsidianVault'),
    obsidianFallbackNote: document.getElementById('obsidianFallbackNote'),
    obsidianSyncStatus: document.getElementById('obsidianSyncStatus'),
    backupPassword: document.getElementById('backupPassword'),
    exportBackup: document.getElementById('exportBackup'),
    importBackup: document.getElementById('importBackup'),
    backupFile: document.getElementById('backupFile'),
    backupStatus: document.getElementById('backupStatus')
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

  function extractionModelPresets() {
    var presets = typeof ExtractionModelLoader !== 'undefined' && ExtractionModelLoader.modelPresets ? ExtractionModelLoader.modelPresets() : [
      { id: 'qwen2.5-0.5b-q4', label: 'Qwen2.5-0.5B-Instruct-Q4', modelId: 'Qwen/Qwen2.5-0.5B-Instruct', quantization: 'q4' },
      { id: 'phi-3.5-mini-q4', label: 'Phi-3.5-mini-Q4', modelId: 'onnx-community/Phi-3.5-mini-instruct-onnx-web', quantization: 'q4f16', backend: 'webgpu', useExternalDataFormat: true },
      { id: 'gemma-3-1b-q4', label: 'Gemma-3-1B-Q4', modelId: 'onnx-community/gemma-3-1b-it-ONNX', quantization: 'q4' }
    ];
    if (typeof ExtractionPromptApiBackend !== 'undefined' && ExtractionPromptApiBackend.modelPreset) {
      presets = [ExtractionPromptApiBackend.modelPreset()].concat(presets);
    }
    return presets;
  }

  function extractionModelPreset(id) {
    var presets = extractionModelPresets();
    return presets.filter(function(preset) {
      return preset.id === id;
    })[0] || presets[0];
  }

  function normalizeExtractionModel(id) {
    return extractionModelPreset(id).id;
  }

  function populateExtractionModels() {
    if (!els.extractionModel) return;
    var selected = els.extractionModel.value;
    els.extractionModel.innerHTML = '';
    extractionModelPresets().forEach(function(preset) {
      var option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.label;
      if (preset.backendType === 'prompt-api' && (!currentPromptApiAvailability || currentPromptApiAvailability.status !== 'available')) {
        option.disabled = true;
      }
      els.extractionModel.appendChild(option);
    });
    els.extractionModel.value = normalizeExtractionModel(selected || currentExtractionModel);
  }

  function renderPromptApiAvailability() {
    if (!els.extractionBackendStatus) return;
    if (typeof ExtractionPromptApiBackend === 'undefined') {
      els.extractionBackendStatus.textContent = 'Chrome built-in AI not detected; local models will be used.';
      return;
    }
    var status = currentPromptApiAvailability.status || 'unknown';
    if (status === 'available') {
      els.extractionBackendStatus.textContent = 'Chrome built-in AI available; Gemini Nano can run without the bundled model download.';
    } else if (status === 'downloadable' || status === 'downloading') {
      els.extractionBackendStatus.textContent = 'Chrome built-in AI is not ready; local models will be used.';
    } else if (status === 'unavailable') {
      els.extractionBackendStatus.textContent = 'Chrome built-in AI unavailable; local models will be used.';
    } else {
      els.extractionBackendStatus.textContent = 'Checking Chrome built-in AI.';
    }
  }

  async function refreshPromptApiAvailability() {
    if (typeof ExtractionPromptApiBackend === 'undefined' || !ExtractionPromptApiBackend.availability) {
      currentPromptApiAvailability = { status: 'unavailable', available: false, api: 'none' };
    } else {
      currentPromptApiAvailability = await ExtractionPromptApiBackend.availability();
    }
    populateExtractionModels();
    renderPromptApiAvailability();
    return currentPromptApiAvailability;
  }

  async function effectiveExtractionPreset(preset) {
    if (!preset || preset.backendType !== 'prompt-api') return preset;
    var availability = await refreshPromptApiAvailability();
    if (availability.status === 'available') return preset;
    log('warn', 'options.extraction.prompt_api.fallback', { availability: availability.status, api: availability.api });
    return extractionModelPreset('qwen2.5-0.5b-q4');
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
      extractionModel: 'qwen2.5-0.5b-q4',
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

  function formatDurationMs(value) {
    return formatNumber(Math.round(Number(value || 0))) + 'ms';
  }

  function wrappedFilename() {
    return 'rakuzaichi_wrapped_' + new Date().toISOString().slice(0, 10) + '.png';
  }

  function setWrappedMetric(valueEl, detailEl, value, detail) {
    if (valueEl) valueEl.textContent = value;
    if (detailEl) detailEl.textContent = detail;
  }

  function renderWrappedStats(summary, durationMs) {
    if (!els.wrappedStats) return;
    summary = summary || (typeof OptionsWrappedStats !== 'undefined' ? OptionsWrappedStats.summarize([], []) : null);
    latestWrappedStats = summary;
    var platform = summary && summary.mostActivePlatform;
    var day = summary && summary.busiestDay;
    var longest = summary && summary.longestChat;
    setWrappedMetric(
      els.wrappedMostActivePlatform,
      els.wrappedMostActivePlatformDetail,
      platform ? platform.label : 'None',
      platform ? formatNumber(platform.messages) + ' messages / ' + formatNumber(platform.chats) + ' chats' : '0 messages'
    );
    setWrappedMetric(
      els.wrappedBusiestDay,
      els.wrappedBusiestDayDetail,
      day ? day.label : 'None',
      day ? formatNumber(day.chats) + ' chats / ' + formatNumber(day.messages) + ' messages' : '0 chats'
    );
    setWrappedMetric(
      els.wrappedLongestChat,
      els.wrappedLongestChatDetail,
      longest ? longest.title : 'None',
      longest ? formatNumber(longest.messageCount) + ' messages' : '0 messages'
    );
    if (els.wrappedTopTopics) {
      els.wrappedTopTopics.innerHTML = '';
      var topics = summary && Array.isArray(summary.topTopics) ? summary.topTopics : [];
      if (!topics.length) {
        var empty = document.createElement('span');
        empty.className = 'wrapped-topic empty';
        empty.textContent = 'None';
        els.wrappedTopTopics.appendChild(empty);
      }
      topics.forEach(function(topic) {
        var chip = document.createElement('span');
        chip.className = 'wrapped-topic';
        chip.textContent = topic.label + ' ' + formatNumber(topic.count);
        els.wrappedTopTopics.appendChild(chip);
      });
    }
    if (els.wrappedRenderTime) {
      els.wrappedRenderTime.textContent = 'Rendered in ' + formatDurationMs(durationMs) + ' from ' + formatNumber(summary ? summary.totalChats : 0) + ' chats.';
    }
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

  async function refreshWrappedStats() {
    if (!els.wrappedStats || typeof OptionsWrappedStats === 'undefined') return;
    var start = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    try {
      if (typeof VaultDAO === 'undefined' || !VaultDAO.listChats) throw new Error('Vault DAO is unavailable');
      var chats = await VaultDAO.listChats();
      var threads = VaultDAO.listOpenThreads ? await VaultDAO.listOpenThreads() : [];
      var summary = OptionsWrappedStats.summarize(chats, threads);
      var end = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      renderWrappedStats(summary, end - start);
      if (els.wrappedStatus) els.wrappedStatus.textContent = '';
    } catch (error) {
      renderWrappedStats(OptionsWrappedStats.summarize([], []), 0);
      if (els.wrappedStatus) els.wrappedStatus.textContent = 'Stats unavailable.';
      log('error', 'options.wrapped_stats.refresh.failed', { error: serializeError(error) });
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
      await refreshWrappedStats();
    } catch (error) {
      log('error', 'options.stats.refresh.failed', { error: serializeError(error) });
      renderStats(defaultStats(), { usageMB: 0 });
      await refreshWrappedStats();
    }
  }

  function setRagStatus(message) {
    if (els.ragStatus) els.ragStatus.textContent = message;
  }

  function syncRagStopButton(running) {
    if (!els.ragStopIndex) return;
    els.ragStopIndex.hidden = !running;
    els.ragStopIndex.disabled = !running;
    if (!running) els.ragStopIndex.textContent = 'Stop';
  }

  function renderRagResults(results, onOpenChunk) {
    if (!els.ragResults) return;
    els.ragResults.innerHTML = '';
    results = Array.isArray(results) ? results : [];
    if (!results.length) {
      var empty = document.createElement('p');
      empty.className = 'rag-empty';
      empty.textContent = els.ragSearch && els.ragSearch.value.trim() ? 'No semantic matches.' : '';
      els.ragResults.appendChild(empty);
      return;
    }
    results.forEach(function(result) {
      var chunk = result.chunk || {};
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'rag-result';
      button.dataset.chatId = chunk.chatId || '';
      button.dataset.messageId = chunk.messageId || '';

      var copy = document.createElement('div');
      var title = document.createElement('strong');
      title.textContent = chunk.title || 'Untitled source';
      copy.appendChild(title);

      var meta = document.createElement('span');
      meta.textContent = [chunk.platform || 'unknown', chunk.timestamp || '', chunk.messageId || ''].filter(Boolean).join(' | ');
      copy.appendChild(meta);
      button.appendChild(copy);

      var score = document.createElement('span');
      score.className = 'rag-score';
      score.textContent = Math.round((result.score || 0) * 100) + '%';
      button.appendChild(score);

      var excerpt = document.createElement('p');
      excerpt.textContent = chunk.excerpt || chunk.text || '';
      button.appendChild(excerpt);

      button.addEventListener('click', function() {
        Promise.resolve(onOpenChunk(chunk)).catch(function(error) {
          setRagStatus('Unable to open source.');
          log('error', 'options.rag.open_source.failed', { error: serializeError(error), chatId: chunk.chatId, messageId: chunk.messageId });
        });
      });
      els.ragResults.appendChild(button);
    });
  }

  async function buildRagIndex(rag) {
    if (!rag || !els.ragBuildIndex || els.ragBuildIndex.disabled) return null;
    var previous = els.ragBuildIndex.textContent;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    currentRagController = controller;
    els.ragBuildIndex.disabled = true;
    if (els.ragRunSearch) els.ragRunSearch.disabled = true;
    syncRagStopButton(!!controller);
    els.ragBuildIndex.textContent = 'Indexing';
    setRagStatus('Indexing...');
    try {
      var result = await rag.build({
        signal: controller && controller.signal,
        onProgress: function(event) {
          if (event.status === 'embedding') {
            setRagStatus('Indexed ' + event.indexed + '/' + event.total + ' chunks');
          }
        }
      });
      setRagStatus('Indexed ' + result.chunkCount + ' chunks.');
      log('info', 'options.rag.index.success', result);
      return result;
    } catch (error) {
      if (controller && controller.signal && controller.signal.aborted) {
        setRagStatus('Indexing stopped.');
        log('warn', 'options.rag.index.cancelled', {});
      } else {
        setRagStatus('Semantic index failed.');
        log('error', 'options.rag.index.failed', { error: serializeError(error) });
      }
      return null;
    } finally {
      currentRagController = null;
      els.ragBuildIndex.disabled = false;
      els.ragBuildIndex.textContent = previous;
      if (els.ragRunSearch) els.ragRunSearch.disabled = false;
      syncRagStopButton(false);
    }
  }

  async function downloadRagModel(rag) {
    if (!rag || !els.ragDownloadModel || els.ragDownloadModel.disabled) return null;
    var previous = els.ragDownloadModel.textContent;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    currentRagController = controller;
    els.ragDownloadModel.disabled = true;
    syncRagStopButton(!!controller);
    els.ragDownloadModel.textContent = 'Downloading';
    setRagStatus('Downloading model...');
    try {
      var result = await rag.downloadModel({
        signal: controller && controller.signal,
        onProgress: function(event) {
          var status = event && event.status ? String(event.status) : 'downloading';
          if (event && typeof event.progress === 'number') status += ' ' + Math.round(event.progress) + '%';
          setRagStatus('Model ' + status);
        }
      });
      setRagStatus('Model ready.');
      log('info', 'options.rag.model_download.success', { modelId: result.modelId, dtype: result.dtype, backend: result.backend });
      return result;
    } catch (error) {
      if (controller && controller.signal && controller.signal.aborted) {
        setRagStatus('Model download stopped.');
        log('warn', 'options.rag.model_download.cancelled', {});
      } else {
        setRagStatus('Model download failed.');
        log('error', 'options.rag.model_download.failed', { error: serializeError(error) });
      }
      return null;
    } finally {
      currentRagController = null;
      els.ragDownloadModel.disabled = false;
      els.ragDownloadModel.textContent = previous;
      syncRagStopButton(false);
    }
  }

  async function clearRagModelCache(rag) {
    if (!rag || !els.ragClearModelCache || els.ragClearModelCache.disabled) return;
    var previous = els.ragClearModelCache.textContent;
    els.ragClearModelCache.disabled = true;
    els.ragClearModelCache.textContent = 'Clearing';
    setRagStatus('Clearing model cache...');
    try {
      var result = await rag.clearModelCache();
      setRagStatus(result.clearedCaches ? 'Model cache cleared.' : 'Model cache clear requested.');
      log('info', 'options.rag.model_cache.clear.success', result);
    } catch (error) {
      setRagStatus('Model cache clear failed.');
      log('error', 'options.rag.model_cache.clear.failed', { error: serializeError(error) });
    } finally {
      els.ragClearModelCache.disabled = false;
      els.ragClearModelCache.textContent = previous;
    }
  }

  async function runRagSearch(rag, onOpenChunk) {
    if (!rag || !els.ragSearch) return;
    var query = els.ragSearch.value.trim();
    if (!query) {
      renderRagResults([], onOpenChunk);
      setRagStatus(rag.isReady && rag.isReady() ? 'Index ready.' : 'Index not built.');
      return;
    }
    if (els.ragRunSearch) els.ragRunSearch.disabled = true;
    setRagStatus(rag.isReady && rag.isReady() ? 'Searching...' : 'Indexing...');
    try {
      var results = await rag.search(query, {
        onProgress: function(event) {
          if (event.status === 'embedding') setRagStatus('Indexed ' + event.indexed + '/' + event.total + ' chunks');
        }
      });
      renderRagResults(results, onOpenChunk);
      setRagStatus(results.length + (results.length === 1 ? ' semantic match.' : ' semantic matches.'));
      log('info', 'options.rag.search.success', { query: query, results: results.length });
    } catch (error) {
      setRagStatus('Semantic search failed.');
      log('error', 'options.rag.search.failed', { error: serializeError(error), query: query });
    } finally {
      if (els.ragRunSearch) els.ragRunSearch.disabled = false;
    }
  }

  function extractionProgressLabel(event) {
    event = event || {};
    if (event.status === 'model-load' || event.status === 'model-progress') return 'Model load';
    if (event.status === 'chunk-processing') return 'Chunk ' + String((event.index || 0) + 1) + '/' + String(event.total || 1);
    if (event.status === 'cancelled') return 'Stopped';
    if (event.status === 'done') return 'Done';
    return String(event.status || 'Running');
  }

  function syncStopButton(button, running) {
    if (!button) return;
    button.hidden = !running;
    button.disabled = !running;
  }

  async function runExtractionForChat(chat, messages, onProgress, runOptions) {
    runOptions = runOptions || {};
    if (typeof ExtractionRunner === 'undefined' || !ExtractionRunner.runChatExtraction) throw new Error('Extraction runner is unavailable');
    if (typeof VaultDAO === 'undefined') throw new Error('Vault DAO is unavailable');
    var preset = await effectiveExtractionPreset(extractionModelPreset(currentExtractionModel));
    var options = {
      dao: VaultDAO,
      modelId: preset.modelId,
      modelName: preset.modelName || preset.label,
      modelVersion: preset.modelVersion || preset.quantization,
      quantization: preset.quantization,
      backend: preset.backend,
      backendType: preset.backendType,
      task: preset.task,
      useExternalDataFormat: preset.useExternalDataFormat,
      signal: runOptions.signal,
      onProgress: onProgress
    };
    if (preset.backendType === 'prompt-api' && typeof ExtractionPromptApiBackend !== 'undefined') {
      options.modelLoader = ExtractionPromptApiBackend;
    }
    return ExtractionRunner.runChatExtraction(chat, messages, options);
  }

  async function runExtractionAll(refreshVault) {
    if (!els.runExtractionAll || els.runExtractionAll.disabled) return;
    var previous = els.runExtractionAll.textContent;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    currentBatchExtractionController = controller;
    els.runExtractionAll.disabled = true;
    els.runExtractionAll.textContent = 'Model load';
    syncStopButton(els.stopExtractionAll, !!controller);
    if (els.extractionStatus) els.extractionStatus.textContent = 'Model load';
    try {
      if (typeof VaultDAO === 'undefined' || !VaultDAO.listChats || !VaultDAO.listMessages) throw new Error('Vault DAO is unavailable');
      var chats = await VaultDAO.listChats();
      var totalThreads = 0;
      for (var i = 0; i < chats.length; i++) {
        if (controller && controller.signal.aborted) break;
        var chat = chats[i];
        if (els.extractionStatus) els.extractionStatus.textContent = String(i + 1) + '/' + String(chats.length) + ': ' + (chat.title || chat.chatId);
        var messages = await VaultDAO.listMessages(chat.chatId);
        var result = await runExtractionForChat(chat, messages, function(event) {
          var label = extractionProgressLabel(event);
          els.runExtractionAll.textContent = label;
          if (els.extractionStatus) els.extractionStatus.textContent = String(i + 1) + '/' + String(chats.length) + ': ' + label;
        }, { signal: controller && controller.signal });
        totalThreads += result.threadCount || 0;
        if (result.cancelled) break;
      }
      if (els.extractionStatus) {
        els.extractionStatus.textContent = controller && controller.signal.aborted ? 'Stopped: ' + String(totalThreads) + ' threads' : 'Done: ' + String(totalThreads) + ' threads';
      }
      await refreshExtractionRuns();
      if (refreshVault) await refreshVault(true);
      else await refreshVaultStats();
    } catch (error) {
      if (els.extractionStatus) els.extractionStatus.textContent = 'Extraction failed';
      log('error', 'options.extraction.run_all.failed', { error: serializeError(error) });
    } finally {
      els.runExtractionAll.disabled = false;
      els.runExtractionAll.textContent = previous;
      currentBatchExtractionController = null;
      if (els.stopExtractionAll) els.stopExtractionAll.textContent = 'Stop';
      syncStopButton(els.stopExtractionAll, false);
    }
  }

  function makeBlobDownload(filename, content, mime) {
    var blob = content && typeof content.arrayBuffer === 'function' && typeof content.type === 'string'
      ? content
      : new Blob([content], { type: mime || 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(function() {
      URL.revokeObjectURL(url);
    }, 1200);
  }

  function normalizeBulkExportFormat(format) {
    if (typeof FormatConverter === 'undefined' || !FormatConverter.formats) return 'markdown';
    return FormatConverter.formats[format] ? format : 'markdown';
  }

  function bulkExportFilename(format) {
    var formatInfo = FormatConverter.formats[format];
    if (typeof FilenameBuilder !== 'undefined') {
      return FilenameBuilder.build('rakuzaichi_bulk_{date}.{ext}', {
        platform: 'multiple',
        title: 'bulk',
        format: format,
        ext: formatInfo.ext
      });
    }
    return 'rakuzaichi_bulk_' + new Date().toISOString().slice(0, 10) + '.' + formatInfo.ext;
  }

  function updateBulkExportSelection(selectedChats) {
    selectedChats = Array.isArray(selectedChats) ? selectedChats : [];
    if (els.bulkExportSummary) els.bulkExportSummary.textContent = selectedChats.length + ' selected';
    if (els.bulkExportSelected) els.bulkExportSelected.disabled = !selectedChats.length;
  }

  function bulkMessage(chat, message, index) {
    message = message || {};
    var copied = Object.assign({}, message);
    copied.chatId = copied.chatId || chat.chatId || '';
    copied.chatTitle = copied.chatTitle || chat.title || chat.chatTitle || 'Untitled chat';
    copied.platform = copied.platform || chat.platform || 'unknown';
    copied.model = copied.model || chat.model || '';
    copied.index = typeof copied.index === 'number' ? copied.index : index;
    return copied;
  }

  function chatExportEnvelope(chat, messages, openThreads) {
    messages = Array.isArray(messages) ? messages : [];
    return {
      exportVersion: '2.1',
      exportedAt: new Date().toISOString(),
      chatId: chat.chatId || '',
      platform: chat.platform || 'unknown',
      chatTitle: chat.title || chat.chatTitle || 'Untitled chat',
      title: chat.title || chat.chatTitle || 'Untitled chat',
      url: chat.url || chat.sourceUrl || '',
      model: chat.model || '',
      messageCount: messages.length,
      messages: messages,
      openThreads: Array.isArray(openThreads) ? openThreads : [],
      capturedAt: chat.capturedAt || '',
      lastUpdatedAt: chat.lastUpdatedAt || '',
      tags: Array.isArray(chat.tags) ? chat.tags.slice() : []
    };
  }

  async function loadBulkExportEnvelopes(chats) {
    if (typeof VaultDAO === 'undefined' || !VaultDAO.listMessages) throw new Error('Vault DAO is unavailable');
    var envelopes = [];
    for (var i = 0; i < chats.length; i++) {
      var chat = chats[i];
      var messages = await VaultDAO.listMessages(chat.chatId);
      var openThreads = [];
      if (VaultDAO.listOpenThreads) openThreads = await VaultDAO.listOpenThreads({ chatId: chat.chatId });
      envelopes.push(chatExportEnvelope(chat, messages, openThreads));
    }
    return envelopes;
  }

  function mergedBulkEnvelope(envelopes) {
    var messages = [];
    var openThreads = [];
    envelopes.forEach(function(envelope) {
      (envelope.messages || []).forEach(function(message, index) {
        messages.push(bulkMessage(envelope, message, index));
      });
      (envelope.openThreads || []).forEach(function(thread) {
        var copied = Object.assign({}, thread);
        copied.chatId = copied.chatId || envelope.chatId || '';
        copied.chatTitle = copied.chatTitle || envelope.chatTitle || envelope.title || 'Untitled chat';
        openThreads.push(copied);
      });
    });
    return {
      exportVersion: '2.1',
      exportedAt: new Date().toISOString(),
      chatId: 'bulk',
      platform: 'multiple',
      chatTitle: 'Bulk export',
      title: 'Bulk export',
      messageCount: messages.length,
      messages: messages,
      openThreads: openThreads
    };
  }

  function convertBulkExport(format, envelopes) {
    if (format === 'markdown') return FormatConverter.toMarkdownBulk(envelopes);
    if (format === 'json') return JSON.stringify(envelopes, null, 2);
    var merged = mergedBulkEnvelope(envelopes);
    if (format === 'csv') return FormatConverter.toCSV(merged);
    if (format === 'tsv') return FormatConverter.toTSV(merged);
    if (format === 'html' || format === 'pdf') return FormatConverter.toHTML(merged);
    throw new Error('Unsupported format: ' + format);
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

  async function printBulkExport(html) {
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
      var printWindow = await loadPrintFrame(iframe, html);
      if (!printWindow || typeof printWindow.print !== 'function') throw new Error('Print API is unavailable');
      if (printWindow.focus) printWindow.focus();
      printWindow.print();
    } finally {
      setTimeout(function() {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1200);
    }
  }

  async function runBulkExport(list) {
    if (!list || !els.bulkExportSelected || els.bulkExportSelected.disabled) return;
    var selectedChats = list.getSelectedChats ? list.getSelectedChats() : [];
    if (!selectedChats.length) return;
    var previous = els.bulkExportSelected.textContent;
    var format = 'markdown';
    els.bulkExportSelected.disabled = true;
    els.bulkExportSelected.textContent = 'Exporting';
    try {
      if (typeof FormatConverter === 'undefined') throw new Error('Format converter is unavailable');
      format = normalizeBulkExportFormat(els.bulkExportFormat && els.bulkExportFormat.value);
      var envelopes = await loadBulkExportEnvelopes(selectedChats);
      var output = convertBulkExport(format, envelopes);
      var filename = bulkExportFilename(format);
      if (format === 'pdf') await printBulkExport(output);
      else makeBlobDownload(filename, output, FormatConverter.formats[format].mime + ';charset=utf-8');
      if (typeof ExportHistory !== 'undefined' && ExportHistory.add) {
        await ExportHistory.add({
          platform: 'multiple',
          format: format,
          messageCount: mergedBulkEnvelope(envelopes).messageCount,
          chatTitle: 'Bulk export',
          filename: filename
        });
        await refreshHistorySummary();
      }
      if (els.bulkExportSummary) els.bulkExportSummary.textContent = 'Exported ' + envelopes.length + (envelopes.length === 1 ? ' chat' : ' chats');
      if (list.clearSelection) list.clearSelection();
      log('info', 'options.bulk_export.success', { format: format, chats: envelopes.length, filename: filename });
    } catch (error) {
      log('error', 'options.bulk_export.failed', { error: serializeError(error), format: format });
      if (els.bulkExportSummary) els.bulkExportSummary.textContent = 'Export failed';
    } finally {
      els.bulkExportSelected.textContent = previous;
      updateBulkExportSelection(list.getSelectedChats ? list.getSelectedChats() : []);
    }
  }

  function bindBulkExportControls(list) {
    updateBulkExportSelection([]);
    if (els.bulkExportFormat) {
      els.bulkExportFormat.addEventListener('change', function() {
        els.bulkExportFormat.value = normalizeBulkExportFormat(els.bulkExportFormat.value);
      });
    }
    if (els.bulkExportSelected) {
      els.bulkExportSelected.addEventListener('click', function() {
        runBulkExport(list);
      });
    }
  }

  async function downloadWrappedStatsPng() {
    if (!els.wrappedSharePng || typeof OptionsWrappedStats === 'undefined') return;
    var previous = els.wrappedSharePng.textContent;
    els.wrappedSharePng.disabled = true;
    els.wrappedSharePng.textContent = 'Rendering';
    if (els.wrappedStatus) els.wrappedStatus.textContent = 'Rendering PNG...';
    try {
      if (!latestWrappedStats) await refreshWrappedStats();
      var blob = await OptionsWrappedStats.toPngBlob(latestWrappedStats, { document: document, window: window });
      makeBlobDownload(wrappedFilename(), blob, 'image/png');
      if (els.wrappedStatus) els.wrappedStatus.textContent = 'PNG saved.';
      log('info', 'options.wrapped_stats.png.success', { filename: wrappedFilename() });
    } catch (error) {
      if (els.wrappedStatus) els.wrappedStatus.textContent = 'PNG failed.';
      log('error', 'options.wrapped_stats.png.failed', { error: serializeError(error) });
    } finally {
      els.wrappedSharePng.textContent = previous;
      els.wrappedSharePng.disabled = false;
    }
  }

  function setObsidianSyncStatus(message) {
    if (els.obsidianSyncStatus) els.obsidianSyncStatus.textContent = message;
  }

  function setObsidianFallbackMode(enabled) {
    if (els.obsidianFallbackNote) els.obsidianFallbackNote.hidden = !enabled;
    if (els.chooseObsidianVault) els.chooseObsidianVault.hidden = !!enabled;
    if (els.syncObsidianVault) els.syncObsidianVault.textContent = enabled ? 'Download ZIP' : 'Sync now';
  }

  function hasObsidianSyncSupport() {
    return typeof ObsidianSync !== 'undefined' && ObsidianSync.isSupported(window);
  }

  async function refreshObsidianSyncStatus() {
    if (!els.obsidianSyncStatus) return;
    if (!hasObsidianSyncSupport()) {
      setObsidianFallbackMode(true);
      if (els.chooseObsidianVault) els.chooseObsidianVault.disabled = true;
      var fallbackReady = typeof VaultDAO !== 'undefined' && VaultDAO.listChats && VaultDAO.listMessages && typeof ObsidianSync !== 'undefined' && typeof ZipWriter !== 'undefined';
      if (els.syncObsidianVault) els.syncObsidianVault.disabled = !fallbackReady;
      setObsidianSyncStatus(fallbackReady ? 'ZIP fallback ready.' : 'ZIP fallback unavailable.');
      return;
    }
    setObsidianFallbackMode(false);
    if (typeof VaultDAO === 'undefined' || !VaultDAO.getMeta || !VaultDAO.setMeta) {
      if (els.chooseObsidianVault) els.chooseObsidianVault.disabled = true;
      if (els.syncObsidianVault) els.syncObsidianVault.disabled = true;
      setObsidianSyncStatus('Vault store unavailable.');
      return;
    }
    if (els.chooseObsidianVault) els.chooseObsidianVault.disabled = false;
    try {
      var handle = await ObsidianSync.storedVault(VaultDAO);
      if (els.syncObsidianVault) els.syncObsidianVault.disabled = !handle;
      setObsidianSyncStatus(handle ? 'Vault selected: ' + (handle.name || 'selected directory') : 'No Obsidian vault selected.');
    } catch (error) {
      if (els.syncObsidianVault) els.syncObsidianVault.disabled = true;
      setObsidianSyncStatus('Unable to load saved vault.');
      log('warn', 'options.obsidian.status.failed', { error: serializeError(error) });
    }
  }

  async function pickObsidianVault() {
    if (!els.chooseObsidianVault || !hasObsidianSyncSupport()) return;
    var previous = els.chooseObsidianVault.textContent;
    var finalStatus = '';
    els.chooseObsidianVault.disabled = true;
    if (els.syncObsidianVault) els.syncObsidianVault.disabled = true;
    els.chooseObsidianVault.textContent = 'Choosing';
    setObsidianSyncStatus('Choosing vault...');
    try {
      var handle = await ObsidianSync.chooseVault({ dao: VaultDAO, window: window });
      setObsidianSyncStatus('Vault selected: ' + (handle.name || 'selected directory'));
      log('info', 'options.obsidian.vault_selected', { name: handle.name || '' });
    } catch (error) {
      var cancelled = error && (error.name === 'AbortError' || error.message === 'The user aborted a request.');
      finalStatus = cancelled ? 'Vault selection cancelled.' : 'Vault selection failed.';
      setObsidianSyncStatus(finalStatus);
      log(cancelled ? 'warn' : 'error', 'options.obsidian.vault_select.failed', { error: serializeError(error) });
    } finally {
      els.chooseObsidianVault.textContent = previous;
      await refreshObsidianSyncStatus();
      if (finalStatus) setObsidianSyncStatus(finalStatus);
    }
  }

  async function runObsidianSync() {
    if (!els.syncObsidianVault || els.syncObsidianVault.disabled) return;
    var previous = els.syncObsidianVault.textContent;
    var fallback = !hasObsidianSyncSupport();
    els.syncObsidianVault.disabled = true;
    els.syncObsidianVault.textContent = fallback ? 'Preparing ZIP' : 'Syncing';
    setObsidianSyncStatus(fallback ? 'Preparing ZIP...' : 'Syncing...');
    try {
      if (typeof ObsidianSync === 'undefined') throw new Error('Obsidian sync is unavailable');
      var result = fallback
        ? await ObsidianSync.createZip({ dao: VaultDAO, converter: FormatConverter })
        : await ObsidianSync.syncAll({ dao: VaultDAO, converter: FormatConverter });
      if (fallback) makeBlobDownload(result.filename, result.blob, 'application/zip');
      if (typeof ExportHistory !== 'undefined' && ExportHistory.add) {
        await ExportHistory.add({
          platform: 'multiple',
          format: fallback ? 'zip' : 'markdown',
          messageCount: result.messageCount,
          chatTitle: fallback ? 'Obsidian ZIP fallback' : 'Obsidian sync',
          filename: fallback ? result.filename : result.subfolderName
        });
        await refreshHistorySummary();
      }
      setObsidianSyncStatus((fallback ? 'Downloaded ZIP with ' : 'Synced ') + result.chatCount + (result.chatCount === 1 ? ' chat' : ' chats') + (fallback ? '.' : ' to ' + result.subfolderName + '.'));
      log('info', fallback ? 'options.obsidian.zip.success' : 'options.obsidian.sync.success', { chats: result.chatCount, messages: result.messageCount, folder: result.subfolderName });
    } catch (error) {
      setObsidianSyncStatus(fallback ? 'ZIP download failed.' : 'Sync failed.');
      log('error', fallback ? 'options.obsidian.zip.failed' : 'options.obsidian.sync.failed', { error: serializeError(error) });
    } finally {
      els.syncObsidianVault.textContent = previous;
      els.syncObsidianVault.disabled = false;
    }
  }

  function docsImportFileArray(files) {
    return Array.prototype.slice.call(files || []).filter(Boolean);
  }

  function setDocsImportStatus(message) {
    if (els.docsImportStatus) els.docsImportStatus.textContent = message;
  }

  function setDocsImportDisabled(disabled) {
    [els.importDocsFiles, els.importDocsFolder].forEach(function(button) {
      if (button) button.disabled = !!disabled;
    });
  }

  async function importGoogleDocsExports(files, refreshVault) {
    files = docsImportFileArray(files);
    if (!files.length) return;
    setDocsImportDisabled(true);
    setDocsImportStatus('Importing...');
    try {
      if (typeof GoogleDocsImporter === 'undefined') throw new Error('Google Docs importer is unavailable');
      var result = await GoogleDocsImporter.importFiles({
        files: files,
        dao: typeof VaultDAO !== 'undefined' ? VaultDAO : null,
        scanner: typeof ThreadScanner !== 'undefined' ? ThreadScanner : null
      });
      if (refreshVault) await refreshVault(true);
      else await refreshVaultStats();
      await refreshExtractionRuns();
      setDocsImportStatus('Imported ' + result.chats.length + (result.chats.length === 1 ? ' document.' : ' documents.'));
      log('info', 'options.google_docs_import.success', {
        chats: result.chats.length,
        messages: result.messages.length,
        threads: result.openThreads.length
      });
    } catch (error) {
      setDocsImportStatus('Docs import failed.');
      log('error', 'options.google_docs_import.failed', { error: serializeError(error) });
    } finally {
      setDocsImportDisabled(false);
      if (els.docsImportFiles) els.docsImportFiles.value = '';
      if (els.docsImportFolderFiles) els.docsImportFolderFiles.value = '';
      if (els.docsImportDrop) els.docsImportDrop.classList.remove('drag-active');
    }
  }

  function setChatImportStatus(message) {
    if (els.chatImportStatus) els.chatImportStatus.textContent = message;
  }

  function setChatImportDisabled(disabled) {
    [els.importSlackZip, els.importSlackFolder, els.importDiscordZip, els.importDiscordFolder].forEach(function(button) {
      if (button) button.disabled = !!disabled;
    });
    if (els.cancelChatImport) els.cancelChatImport.disabled = !disabled;
  }

  function clearChatImportInputs() {
    [els.slackImportZipFile, els.slackImportFolderFiles, els.discordImportZipFile, els.discordImportFolderFiles].forEach(function(input) {
      if (input) input.value = '';
    });
  }

  function chatImportProgress(adapter, event) {
    var label = adapter === 'slack' ? 'Slack' : 'Discord';
    var counts = event.itemCounts || {};
    var total = event.total || 0;
    var progress = total ? ' ' + String(counts.imported || counts.parsed || 0) + '/' + String(total) : '';
    setChatImportStatus(label + ' import: ' + (event.phase || 'working') + progress + '.');
  }

  async function importChatExport(adapter, mode, files, refreshVault) {
    files = docsImportFileArray(files);
    if (!files.length) return;
    setChatImportDisabled(true);
    currentChatImportController = new AbortController();
    setChatImportStatus((adapter === 'slack' ? 'Slack' : 'Discord') + ' import starting.');
    try {
      if (typeof ChatExportImporter === 'undefined') throw new Error('Chat export importer is unavailable');
      var options = {
        adapterId: adapter,
        dao: typeof VaultDAO !== 'undefined' ? VaultDAO : null,
        scanner: typeof ThreadScanner !== 'undefined' ? ThreadScanner : null,
        signal: currentChatImportController.signal,
        onProgress: function(event) {
          chatImportProgress(adapter, event);
        }
      };
      if (mode === 'zip') options.zipFile = files[0];
      else options.files = files;
      var result = await ChatExportImporter.importExport(options);
      if (refreshVault) await refreshVault(true);
      else await refreshVaultStats();
      await refreshExtractionRuns();
      if (result.cancelled) {
        setChatImportStatus('Chat export import cancelled.');
      } else {
        setChatImportStatus('Imported ' + result.chats.length + (result.chats.length === 1 ? ' conversation.' : ' conversations.'));
      }
      log('info', 'options.chat_export_import.success', {
        adapter: adapter,
        chats: result.chats.length,
        messages: result.messages.length,
        threads: result.openThreads.length,
        cancelled: result.cancelled
      });
    } catch (error) {
      setChatImportStatus('Chat export import failed.');
      log('error', 'options.chat_export_import.failed', { adapter: adapter, error: serializeError(error) });
    } finally {
      currentChatImportController = null;
      setChatImportDisabled(false);
      clearChatImportInputs();
    }
  }

  function setEmailImportStatus(message) {
    if (els.emailImportStatus) els.emailImportStatus.textContent = message;
  }

  function setEmailImportDisabled(disabled) {
    [els.importEmailFiles, els.importEmailFolder].forEach(function(button) {
      if (button) button.disabled = !!disabled;
    });
    if (els.cancelEmailImport) els.cancelEmailImport.disabled = !disabled;
  }

  function clearEmailImportInputs() {
    [els.emailImportFiles, els.emailImportFolderFiles].forEach(function(input) {
      if (input) input.value = '';
    });
  }

  function emailImportProgress(event) {
    var counts = event.itemCounts || {};
    var total = event.total || 0;
    var progress = total ? ' ' + String(counts.imported || counts.parsed || 0) + '/' + String(total) : '';
    setEmailImportStatus('Email import: ' + (event.phase || 'working') + progress + '.');
  }

  function emailImportFileArray(files) {
    return docsImportFileArray(files).filter(function(file) {
      var path = String((file && (file.webkitRelativePath || file.name)) || '').toLowerCase();
      return /\.mbox$/.test(path);
    });
  }

  async function importEmailMbox(files, refreshVault) {
    files = emailImportFileArray(files);
    if (!files.length) return;
    setEmailImportDisabled(true);
    currentEmailImportController = new AbortController();
    setEmailImportStatus('Email import starting.');
    try {
      if (typeof EmailImporter === 'undefined') throw new Error('Email importer is unavailable');
      var result = await EmailImporter.importFiles({
        files: files,
        dao: typeof VaultDAO !== 'undefined' ? VaultDAO : null,
        scanner: typeof ThreadScanner !== 'undefined' ? ThreadScanner : null,
        signal: currentEmailImportController.signal,
        onProgress: emailImportProgress
      });
      if (refreshVault) await refreshVault(true);
      else await refreshVaultStats();
      await refreshExtractionRuns();
      if (result.cancelled) {
        setEmailImportStatus('Email import cancelled.');
      } else {
        setEmailImportStatus('Imported ' + result.chats.length + (result.chats.length === 1 ? ' email thread.' : ' email threads.'));
      }
      log('info', 'options.email_import.success', {
        chats: result.chats.length,
        messages: result.messages.length,
        threads: result.openThreads.length,
        cancelled: result.cancelled
      });
    } catch (error) {
      setEmailImportStatus('Email import failed.');
      log('error', 'options.email_import.failed', { error: serializeError(error) });
    } finally {
      currentEmailImportController = null;
      setEmailImportDisabled(false);
      clearEmailImportInputs();
    }
  }

  function backupPassword() {
    return els.backupPassword ? els.backupPassword.value || '' : '';
  }

  function setBackupStatus(message) {
    if (els.backupStatus) els.backupStatus.textContent = message;
  }

  async function exportVaultBackup() {
    if (!els.exportBackup || els.exportBackup.disabled) return;
    var previous = els.exportBackup.textContent;
    els.exportBackup.disabled = true;
    els.exportBackup.textContent = 'Exporting';
    setBackupStatus('Exporting...');
    try {
      if (typeof VaultBackup === 'undefined') throw new Error('Backup module is unavailable');
      var settings = typeof StorageManager !== 'undefined' && StorageManager.getAll ? await StorageManager.getAll() : {};
      var result = await VaultBackup.create({ dao: VaultDAO, settings: settings, password: backupPassword() });
      makeBlobDownload(result.filename, result.blob, 'application/zip');
      if (typeof ExportHistory !== 'undefined' && ExportHistory.add) {
        await ExportHistory.add({
          platform: 'vault',
          format: result.encrypted ? 'encrypted-backup' : 'backup',
          messageCount: result.snapshot && result.snapshot.messages ? result.snapshot.messages.length : 0,
          chatTitle: 'Vault backup',
          filename: result.filename
        });
        await refreshHistorySummary();
      }
      setBackupStatus('Exported ' + result.filename + '.');
      log('info', 'options.backup.export.success', { filename: result.filename, encrypted: result.encrypted });
    } catch (error) {
      setBackupStatus('Backup export failed.');
      log('error', 'options.backup.export.failed', { error: serializeError(error) });
    } finally {
      els.exportBackup.textContent = previous;
      els.exportBackup.disabled = false;
    }
  }

  async function importVaultBackup(file, refreshVault) {
    if (!file || !els.importBackup || els.importBackup.disabled) return;
    var previous = els.importBackup.textContent;
    els.importBackup.disabled = true;
    els.importBackup.textContent = 'Importing';
    setBackupStatus('Importing...');
    try {
      if (typeof VaultBackup === 'undefined') throw new Error('Backup module is unavailable');
      var data = await VaultBackup.read(file, backupPassword());
      var result = await VaultBackup.restore(data, { dao: VaultDAO, storageManager: StorageManager });
      if (data.settings) renderSettings(data.settings);
      if (refreshVault) await refreshVault(true);
      await refreshVaultStats();
      await refreshHistorySummary();
      setBackupStatus('Imported ' + result.chats + (result.chats === 1 ? ' chat' : ' chats') + '.');
      log('info', 'options.backup.import.success', result);
    } catch (error) {
      setBackupStatus('Backup import failed.');
      log('error', 'options.backup.import.failed', { error: serializeError(error) });
    } finally {
      els.importBackup.textContent = previous;
      els.importBackup.disabled = false;
      if (els.backupFile) els.backupFile.value = '';
    }
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

  function renderExtractionRuns(runs) {
    if (!els.extractionRunsList) return;
    els.extractionRunsList.innerHTML = '';
    if (!runs.length) {
      var empty = document.createElement('li');
      empty.textContent = 'No extraction runs yet.';
      els.extractionRunsList.appendChild(empty);
      return;
    }

    runs.slice(0, 25).forEach(function(run) {
      var item = document.createElement('li');
      var meta = document.createElement('div');
      meta.className = 'log-meta';

      var model = document.createElement('strong');
      model.textContent = run.modelName || 'unknown model';
      meta.appendChild(model);

      var version = document.createElement('span');
      version.textContent = run.modelVersion || 'unknown version';
      meta.appendChild(version);

      var when = document.createElement('span');
      when.textContent = run.completedAt ? new Date(run.completedAt).toLocaleString() : '';
      meta.appendChild(when);
      item.appendChild(meta);

      var details = document.createElement('div');
      details.textContent = [
        run.chatId || 'unknown chat',
        String(run.threadCount || 0) + ' threads',
        String(run.durationMs || 0) + 'ms'
      ].join(' | ');
      item.appendChild(details);
      els.extractionRunsList.appendChild(item);
    });
  }

  async function refreshExtractionRuns() {
    try {
      var runs = typeof VaultDAO !== 'undefined' && VaultDAO.listExtractionRuns ? await VaultDAO.listExtractionRuns() : [];
      renderExtractionRuns(runs);
    } catch (error) {
      log('error', 'options.extraction_runs.refresh.failed', { error: serializeError(error) });
      renderExtractionRuns([]);
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
        extractionModel: normalizeExtractionModel(els.extractionModel ? els.extractionModel.value : currentExtractionModel),
        showPreview: !!els.showPreview.checked,
        autoExportInterval: parseInt(els.autoExportInterval.value, 10) || 0
      };

      await StorageManager.setAll(payload);
      currentExtractionModel = payload.extractionModel;
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

  function bindRagControls(rag, onOpenChunk) {
    if (!rag || !els.ragSearch) return;
    renderRagResults([], onOpenChunk);
    if (els.ragDownloadModel) {
      els.ragDownloadModel.addEventListener('click', function() {
        downloadRagModel(rag);
      });
    }
    if (els.ragBuildIndex) {
      els.ragBuildIndex.addEventListener('click', function() {
        buildRagIndex(rag);
      });
    }
    if (els.ragClearIndex) {
      els.ragClearIndex.addEventListener('click', function() {
        rag.clear();
        renderRagResults([], onOpenChunk);
        setRagStatus('Index cleared.');
      });
    }
    if (els.ragClearModelCache) {
      els.ragClearModelCache.addEventListener('click', function() {
        clearRagModelCache(rag);
      });
    }
    if (els.ragRunSearch) {
      els.ragRunSearch.addEventListener('click', function() {
        runRagSearch(rag, onOpenChunk);
      });
    }
    if (els.ragStopIndex) {
      els.ragStopIndex.addEventListener('click', function() {
        if (!currentRagController) return;
        currentRagController.abort();
        els.ragStopIndex.disabled = true;
        els.ragStopIndex.textContent = 'Stopping';
        setRagStatus('Stopping...');
      });
    }
    els.ragSearch.addEventListener('keydown', function(event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      runRagSearch(rag, onOpenChunk);
    });
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
    if (els.runExtractionAll) {
      els.runExtractionAll.addEventListener('click', function() {
        runExtractionAll(refreshVault);
      });
    }
    if (els.wrappedSharePng) els.wrappedSharePng.addEventListener('click', downloadWrappedStatsPng);
    if (els.stopExtractionAll) {
      els.stopExtractionAll.addEventListener('click', function() {
        if (els.stopExtractionAll.disabled) return;
        els.stopExtractionAll.disabled = true;
        els.stopExtractionAll.textContent = 'Stopping';
        if (currentBatchExtractionController) currentBatchExtractionController.abort();
        if (els.extractionStatus) els.extractionStatus.textContent = 'Stopping';
      });
    }
    if (els.chooseObsidianVault) els.chooseObsidianVault.addEventListener('click', pickObsidianVault);
    if (els.syncObsidianVault) els.syncObsidianVault.addEventListener('click', runObsidianSync);
    if (els.importDocsFiles && els.docsImportFiles) {
      els.importDocsFiles.addEventListener('click', function() {
        els.docsImportFiles.click();
      });
      els.docsImportFiles.addEventListener('change', function() {
        importGoogleDocsExports(els.docsImportFiles.files, refreshVault);
      });
    }
    if (els.importDocsFolder && els.docsImportFolderFiles) {
      els.importDocsFolder.addEventListener('click', function() {
        els.docsImportFolderFiles.click();
      });
      els.docsImportFolderFiles.addEventListener('change', function() {
        importGoogleDocsExports(els.docsImportFolderFiles.files, refreshVault);
      });
    }
    if (els.docsImportDrop) {
      ['dragenter', 'dragover'].forEach(function(type) {
        els.docsImportDrop.addEventListener(type, function(event) {
          event.preventDefault();
          els.docsImportDrop.classList.add('drag-active');
        });
      });
      ['dragleave', 'drop'].forEach(function(type) {
        els.docsImportDrop.addEventListener(type, function(event) {
          event.preventDefault();
          els.docsImportDrop.classList.remove('drag-active');
        });
      });
      els.docsImportDrop.addEventListener('drop', function(event) {
        importGoogleDocsExports(event.dataTransfer && event.dataTransfer.files, refreshVault);
      });
      els.docsImportDrop.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (els.docsImportFiles) els.docsImportFiles.click();
      });
    }
    if (els.importSlackZip && els.slackImportZipFile) {
      els.importSlackZip.addEventListener('click', function() {
        els.slackImportZipFile.click();
      });
      els.slackImportZipFile.addEventListener('change', function() {
        importChatExport('slack', 'zip', els.slackImportZipFile.files, refreshVault);
      });
    }
    if (els.importSlackFolder && els.slackImportFolderFiles) {
      els.importSlackFolder.addEventListener('click', function() {
        els.slackImportFolderFiles.click();
      });
      els.slackImportFolderFiles.addEventListener('change', function() {
        importChatExport('slack', 'folder', els.slackImportFolderFiles.files, refreshVault);
      });
    }
    if (els.importDiscordZip && els.discordImportZipFile) {
      els.importDiscordZip.addEventListener('click', function() {
        els.discordImportZipFile.click();
      });
      els.discordImportZipFile.addEventListener('change', function() {
        importChatExport('discord', 'zip', els.discordImportZipFile.files, refreshVault);
      });
    }
    if (els.importDiscordFolder && els.discordImportFolderFiles) {
      els.importDiscordFolder.addEventListener('click', function() {
        els.discordImportFolderFiles.click();
      });
      els.discordImportFolderFiles.addEventListener('change', function() {
        importChatExport('discord', 'folder', els.discordImportFolderFiles.files, refreshVault);
      });
    }
    if (els.cancelChatImport) {
      els.cancelChatImport.addEventListener('click', function() {
        if (currentChatImportController) currentChatImportController.abort();
        setChatImportStatus('Stopping chat export import.');
        els.cancelChatImport.disabled = true;
      });
    }
    if (els.importEmailFiles && els.emailImportFiles) {
      els.importEmailFiles.addEventListener('click', function() {
        els.emailImportFiles.click();
      });
      els.emailImportFiles.addEventListener('change', function() {
        importEmailMbox(els.emailImportFiles.files, refreshVault);
      });
    }
    if (els.importEmailFolder && els.emailImportFolderFiles) {
      els.importEmailFolder.addEventListener('click', function() {
        els.emailImportFolderFiles.click();
      });
      els.emailImportFolderFiles.addEventListener('change', function() {
        importEmailMbox(els.emailImportFolderFiles.files, refreshVault);
      });
    }
    if (els.cancelEmailImport) {
      els.cancelEmailImport.addEventListener('click', function() {
        if (currentEmailImportController) currentEmailImportController.abort();
        setEmailImportStatus('Stopping email import.');
        els.cancelEmailImport.disabled = true;
      });
    }
    if (els.exportBackup) els.exportBackup.addEventListener('click', exportVaultBackup);
    if (els.importBackup && els.backupFile) {
      els.importBackup.addEventListener('click', function() {
        els.backupFile.click();
      });
      els.backupFile.addEventListener('change', function() {
        importVaultBackup(els.backupFile.files && els.backupFile.files[0], refreshVault);
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
    if (els.extractionModel) {
      els.extractionModel.addEventListener('change', function() {
        currentExtractionModel = normalizeExtractionModel(els.extractionModel.value);
        els.extractionModel.value = currentExtractionModel;
      });
    }
  }

  function renderSettings(settings) {
    populateColorschemes();
    populateExtractionModels();

    if (els.defaultFormat) els.defaultFormat.value = normalizeDefaultFormat(settings.defaultFormat);
    if (els.filenameTemplate) els.filenameTemplate.value = settings.filenameTemplate;
    if (els.darkMode) els.darkMode.value = settings.darkMode;
    if (els.colorscheme) els.colorscheme.value = normalizeColorscheme(settings.colorscheme);
    currentExtractionModel = normalizeExtractionModel(settings.extractionModel);
    if (els.extractionModel) els.extractionModel.value = currentExtractionModel;
    renderCustomThreadTags(settings.customThreadTags);
    renderThreadTagPriority(settings.threadTagPriority);
    if (els.showPreview) els.showPreview.checked = !!settings.showPreview;
    if (els.autoExportInterval) els.autoExportInterval.value = settings.autoExportInterval;
    applyAppearance();
    renderPromptApiAvailability();

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
        extractionButton: els.runExtractionChat,
        stopExtractionButton: els.stopExtractionChat,
        extractionStatus: els.detailExtractionStatus,
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
        },
        onRunExtraction: async function(chat, messages, onProgress, runOptions) {
          var result = await runExtractionForChat(chat, messages, onProgress, runOptions);
          await refreshExtractionRuns();
          await refreshVault(true);
          return result;
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

    if (els.ragSearch) {
      if (typeof LocalRAG !== 'undefined' && typeof VaultDAO !== 'undefined') {
        var rag = LocalRAG.create({
          dao: VaultDAO,
          modelLoader: typeof ExtractionModelLoader !== 'undefined' ? ExtractionModelLoader : null
        });
        bindRagControls(rag, async function(chunk) {
          if (!detail) throw new Error('Chat detail view is unavailable');
          if (!chunk || !chunk.chatId) throw new Error('RAG result is missing chatId');
          var sourceChat = VaultDAO.getChat ? await VaultDAO.getChat(chunk.chatId) : null;
          if (!sourceChat) throw new Error('Source chat not found');
          await detail.load(sourceChat, { messageId: chunk.messageId });
          setRagStatus('Opened cited source.');
        });
      } else {
        setRagStatus('Semantic search unavailable.');
      }
    }

    if (!els.chatList || typeof OptionsChatList === 'undefined') return refreshVault;
    var list = OptionsChatList.create({
      root: els.chatList,
      summaryEl: els.chatListSummary,
      countEl: els.vaultCount,
      onSelect: function(chat) {
        if (detail) detail.load(chat);
      },
      onSelectionChange: updateBulkExportSelection,
      onPinToggle: async function(chat, pinned) {
        if (typeof VaultDAO === 'undefined' || !VaultDAO.setChatPinned) return null;
        var updated = await VaultDAO.setChatPinned(chat.chatId, pinned);
        await refreshVault(true);
        return updated;
      }
    });
    bindBulkExportControls(list);
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
      await refreshPromptApiAvailability();
      await refreshDiagnostics();
      await refreshExtractionRuns();
      await refreshHistorySummary();
      await refreshObsidianSyncStatus();
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
        await refreshPromptApiAvailability();
        renderDiagnostics([]);
        renderExtractionRuns([]);
        if (els.historySummary) els.historySummary.textContent = 'No exports captured yet.';
        await refreshObsidianSyncStatus();
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
