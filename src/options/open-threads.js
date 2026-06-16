var OptionsOpenThreads = (function() {
  var DEFAULT_TAG_PRIORITY = ['FIXME', 'TODO', 'UNRESOLVED', 'FOLLOWUP', 'REV', 'REF', 'PROMPT'];
  var TAG_PRIORITY = {
    FIXME: 1,
    TODO: 2,
    UNRESOLVED: 3,
    FOLLOWUP: 4,
    REV: 5,
    REF: 6,
    PROMPT: 7
  };
  var PLATFORM_LABELS = {
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    gemini: 'Gemini',
    perplexity: 'Perplexity',
    deepseek: 'DeepSeek',
    grok: 'Grok',
    copilot: 'Copilot',
    mistral: 'Mistral',
    huggingchat: 'HuggingChat',
    poe: 'Poe',
    kimi: 'Kimi',
    qwen: 'Qwen',
    chatglm: 'ChatGLM',
    doubao: 'Doubao',
    notebooklm: 'NotebookLM'
  };

  function text(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback || '';
    return String(value);
  }

  function normalizeTagPriority(priority) {
    var seen = {};
    var result = [];
    (Array.isArray(priority) ? priority : []).forEach(function(tag) {
      tag = text(tag).toUpperCase().replace(/[^A-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
      if (!tag || seen[tag]) return;
      seen[tag] = true;
      result.push(tag);
    });
    DEFAULT_TAG_PRIORITY.forEach(function(tag) {
      if (seen[tag]) return;
      seen[tag] = true;
      result.push(tag);
    });
    return result;
  }

  function priority(tag, tagPriority) {
    var index = (Array.isArray(tagPriority) ? tagPriority : DEFAULT_TAG_PRIORITY).indexOf(text(tag).toUpperCase());
    return index === -1 ? 99 : index + 1;
  }

  function platformLabel(platform) {
    platform = text(platform, 'unknown');
    return PLATFORM_LABELS[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
  }

  function indexChats(chats) {
    var byId = {};
    (Array.isArray(chats) ? chats : []).forEach(function(chat) {
      byId[chat.chatId] = chat;
    });
    return byId;
  }

  function enrichThreads(threads, chats) {
    var chatById = indexChats(chats);
    return (Array.isArray(threads) ? threads : []).map(function(thread) {
      var chat = chatById[thread.chatId] || null;
      return Object.assign({}, thread, {
        chat: chat,
        chatTitle: chat ? text(chat.title, chat.chatId) : text(thread.chatId, 'Unknown chat'),
        platform: chat ? text(chat.platform, 'unknown') : 'unknown'
      });
    });
  }

  function optionValue(select, fallback) {
    return select ? select.value : fallback || '';
  }

  function matches(row, filters) {
    if (filters.tag && row.tag !== filters.tag) return false;
    if (filters.platform && row.platform !== filters.platform) return false;
    if (filters.status === 'open' && filters.showDone) {
      if (row.status !== 'open' && row.status !== 'done') return false;
    } else if (filters.status && row.status !== filters.status) return false;
    if (filters.source && row.source !== filters.source) return false;
    if (filters.subSource && text(row.subSource) !== filters.subSource) return false;
    if (filters.chat) {
      var query = filters.chat.toLowerCase();
      var haystack = [row.chatId, row.chatTitle].join(' ').toLowerCase();
      if (haystack.indexOf(query) === -1) return false;
    }
    return true;
  }

  function sortRows(rows, sort, tagPriority) {
    var order = normalizeTagPriority(tagPriority);
    return rows.slice().sort(function(a, b) {
      if (sort === 'newest') return text(b.createdAt).localeCompare(text(a.createdAt));
      if (sort === 'oldest') return text(a.createdAt).localeCompare(text(b.createdAt));
      if (sort === 'chat') return text(a.chatTitle).localeCompare(text(b.chatTitle)) || priority(a.tag, order) - priority(b.tag, order);
      return priority(a.tag, order) - priority(b.tag, order) || text(a.createdAt).localeCompare(text(b.createdAt));
    });
  }

  function appendCell(row, value, className) {
    var cell = row.ownerDocument.createElement('span');
    cell.setAttribute('role', 'cell');
    if (className) cell.className = className;
    cell.textContent = value;
    row.appendChild(cell);
    return cell;
  }

  function confidenceValue(row) {
    var value = Number(row && row.confidence);
    if (!isFinite(value)) return null;
    return Math.max(0, Math.min(1, value));
  }

  function makeSourceCell(document, row) {
    var cell = document.createElement('span');
    cell.setAttribute('role', 'cell');
    cell.className = 'thread-source';
    if (row.source === 'extracted') {
      var badge = document.createElement('span');
      badge.className = 'thread-source-icon';
      badge.setAttribute('aria-label', 'AI extracted');
      badge.textContent = 'AI';
      cell.appendChild(badge);
    }
    var label = document.createElement('span');
    label.textContent = [text(row.source, 'explicit'), text(row.subSource)].filter(Boolean).join(' / ');
    cell.appendChild(label);
    return cell;
  }

  function makeConfidenceCell(document, row) {
    var cell = document.createElement('span');
    cell.setAttribute('role', 'cell');
    cell.className = 'thread-confidence';
    var confidence = confidenceValue(row);
    if (confidence === null) {
      cell.textContent = '-';
      return cell;
    }
    var bar = document.createElement('span');
    bar.className = 'thread-confidence-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Extraction confidence');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(Math.round(confidence * 100)));
    var fill = document.createElement('span');
    fill.style.width = String(Math.round(confidence * 100)) + '%';
    bar.appendChild(fill);
    cell.appendChild(bar);
    return cell;
  }

  function makeHeader(document) {
    var header = document.createElement('div');
    header.className = 'thread-row thread-row-head';
    header.setAttribute('role', 'row');
    ['Select', 'Tag', 'Status', 'Source', 'Confidence', 'Chat', 'Text', 'Actions'].forEach(function(label) {
      appendCell(header, label);
    });
    return header;
  }

  function makeActions(document, row, setStatus) {
    var actions = document.createElement('span');
    actions.className = 'thread-actions';
    actions.setAttribute('role', 'cell');

    function add(label, status) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-ghost';
      button.textContent = label;
      button.addEventListener('click', function(event) {
        event.stopPropagation();
        setStatus(row, status);
      });
      actions.appendChild(button);
    }

    if (row.status === 'done') add('Reopen', 'open');
    else add('Done', 'done');
    if (row.status !== 'archived') add('Archive', 'archived');
    return actions;
  }

  function makeSelectCell(document, row, selected, syncSelection) {
    var cell = document.createElement('span');
    cell.setAttribute('role', 'cell');
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'thread-select';
    checkbox.checked = !!selected[row.threadId];
    checkbox.setAttribute('aria-label', 'Select thread');
    checkbox.addEventListener('click', function(event) {
      event.stopPropagation();
    });
    checkbox.addEventListener('change', function() {
      if (checkbox.checked) selected[row.threadId] = true;
      else delete selected[row.threadId];
      syncSelection();
    });
    cell.appendChild(checkbox);
    return cell;
  }

  function makeRow(document, row, onSelect, setStatus, selected, syncSelection) {
    var item = document.createElement('div');
    item.className = 'thread-row thread-row-data';
    if (row.source === 'extracted') item.className += ' thread-row-extracted';
    if (row.source === 'extracted' && confidenceValue(row) !== null && confidenceValue(row) < 0.5) item.className += ' thread-row-low-confidence';
    item.setAttribute('role', 'row');
    item.tabIndex = 0;
    item.dataset.threadId = row.threadId || '';
    item.addEventListener('click', function() {
      onSelect(row);
    });
    item.addEventListener('keydown', function(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onSelect(row);
    });
    item.appendChild(makeSelectCell(document, row, selected, syncSelection));
    appendCell(item, text(row.tag, 'THREAD'), 'thread-tag');
    appendCell(item, text(row.status, 'open'));
    item.appendChild(makeSourceCell(document, row));
    item.appendChild(makeConfidenceCell(document, row));
    appendCell(item, platformLabel(row.platform) + ' | ' + text(row.chatTitle, row.chatId));
    appendCell(item, text(row.text, '(empty)'), 'thread-text');
    item.appendChild(makeActions(document, row, setStatus));
    return item;
  }

  function create(options) {
    options = options || {};
    var root = options.root;
    if (!root) throw new Error('open threads root is required');

    var document = root.ownerDocument;
    var state = {
      root: root,
      summaryEl: options.summaryEl || null,
      filters: options.filters || {},
      archiveButton: options.archiveButton || null,
      dao: options.dao || (typeof VaultDAO !== 'undefined' ? VaultDAO : null),
      onSelect: typeof options.onSelect === 'function' ? options.onSelect : function() {},
      rows: [],
      filteredRows: [],
      selected: {},
      tagPriority: normalizeTagPriority(options.tagPriority)
    };

    function filterState() {
      return {
        tag: optionValue(state.filters.tag, ''),
        chat: state.filters.chat ? state.filters.chat.value.trim() : '',
        platform: optionValue(state.filters.platform, ''),
        status: optionValue(state.filters.status, 'open'),
        source: optionValue(state.filters.source, ''),
        subSource: optionValue(state.filters.subSource, ''),
        showDone: !!(state.filters.showDone && state.filters.showDone.checked),
        sort: optionValue(state.filters.sort, 'priority')
      };
    }

    function updateSummary() {
      if (!state.summaryEl) return;
      var count = state.filteredRows.length;
      state.summaryEl.textContent = count + (count === 1 ? ' thread' : ' threads');
      if (state.archiveButton) {
        state.archiveButton.disabled = !state.rows.some(function(row) {
          return state.selected[row.threadId] && row.status === 'done';
        });
      }
    }

    function render() {
      var filters = filterState();
      state.filteredRows = sortRows(state.rows.filter(function(row) {
        return matches(row, filters);
      }), filters.sort, state.tagPriority);
      root.innerHTML = '';
      root.appendChild(makeHeader(document));
      if (!state.filteredRows.length) {
        var empty = document.createElement('div');
        empty.className = 'thread-empty';
        empty.setAttribute('role', 'row');
        empty.textContent = 'No open threads.';
        root.appendChild(empty);
        updateSummary();
        return;
      }
      state.filteredRows.forEach(function(row) {
        root.appendChild(makeRow(document, row, state.onSelect, setStatus, state.selected, updateSummary));
      });
      updateSummary();
    }

    function bindFilters() {
      Object.keys(state.filters).forEach(function(key) {
        var element = state.filters[key];
        if (!element) return;
        var eventName = element.tagName && element.tagName.toLowerCase() === 'input' && element.type !== 'checkbox' ? 'input' : 'change';
        element.addEventListener(eventName, render);
      });
    }

    async function setStatus(row, status) {
      if (!state.dao || !state.dao.setThreadStatus) return;
      await state.dao.setThreadStatus(row.threadId, status);
      delete state.selected[row.threadId];
      await load();
      if (typeof options.onChange === 'function') options.onChange(row, status);
    }

    async function archiveSelected() {
      if (!state.dao || !state.dao.setThreadStatus) return;
      var rows = state.rows.filter(function(row) {
        return state.selected[row.threadId] && row.status === 'done';
      });
      for (var i = 0; i < rows.length; i++) {
        await state.dao.setThreadStatus(rows[i].threadId, 'archived');
        delete state.selected[rows[i].threadId];
      }
      await load();
      if (rows.length && typeof options.onChange === 'function') options.onChange(null, 'archived');
    }

    async function load() {
      if (!state.dao || !state.dao.listOpenThreads || !state.dao.listChats) {
        state.rows = [];
        render();
        return state.rows;
      }
      var results = await Promise.all([
        state.dao.listOpenThreads(),
        state.dao.listChats()
      ]);
      state.rows = enrichThreads(results[0], results[1]);
      render();
      return state.rows;
    }

    root.classList.add('thread-table');
    root.setAttribute('role', 'table');
    root.setAttribute('aria-label', root.getAttribute('aria-label') || 'Open threads');
    bindFilters();
    if (state.archiveButton) {
      state.archiveButton.addEventListener('click', archiveSelected);
      state.archiveButton.disabled = true;
    }
    render();

    return {
      load: load,
      setRows: function(threads, chats) {
        state.rows = enrichThreads(threads, chats);
        render();
        return state.filteredRows;
      },
      getRows: function() {
        return state.filteredRows.slice();
      },
      setTagPriority: function(priority) {
        state.tagPriority = normalizeTagPriority(priority);
        render();
        return state.filteredRows.slice();
      }
    };
  }

  return {
    DEFAULT_TAG_PRIORITY: DEFAULT_TAG_PRIORITY.slice(),
    TAG_PRIORITY: TAG_PRIORITY,
    create: create
  };
})();

if (typeof module !== 'undefined') module.exports = OptionsOpenThreads;
