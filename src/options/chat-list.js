var OptionsChatList = (function() {
  var ROW_HEIGHT = 42;
  var OVERSCAN = 8;
  var DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
    notebooklm: 'NotebookLM',
    'google-docs': 'Google Docs'
  };

  function text(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback || '';
    return String(value);
  }

  function platformLabel(platform) {
    platform = text(platform, 'unknown');
    return PLATFORM_LABELS[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
  }

  function formatDate(value) {
    if (!value) return 'Unknown';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return text(value).slice(0, 16);
    return DATE_FORMATTER.format(date);
  }

  function appendCell(row, value) {
    var cell = row.ownerDocument.createElement('span');
    cell.setAttribute('role', 'cell');
    cell.textContent = value;
    row.appendChild(cell);
  }

  function appendSelectCell(row, chat, selectedIds, onToggleSelected) {
    var cell = row.ownerDocument.createElement('span');
    cell.setAttribute('role', 'cell');
    var input = row.ownerDocument.createElement('input');
    input.type = 'checkbox';
    input.className = 'chat-select';
    input.checked = !!selectedIds[chat.chatId];
    input.setAttribute('aria-label', 'Select ' + text(chat.title, 'chat'));
    input.addEventListener('click', function(event) {
      event.stopPropagation();
    });
    input.addEventListener('change', function(event) {
      event.stopPropagation();
      onToggleSelected(chat, input.checked);
    });
    cell.appendChild(input);
    row.appendChild(cell);
  }

  function appendPinCell(row, chat, onPinToggle) {
    var cell = row.ownerDocument.createElement('span');
    cell.setAttribute('role', 'cell');
    var button = row.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'pin-toggle';
    button.textContent = chat.pinned ? '★' : '☆';
    button.setAttribute('aria-label', chat.pinned ? 'Unpin chat' : 'Pin chat');
    button.addEventListener('click', function(event) {
      event.stopPropagation();
      onPinToggle(chat);
    });
    cell.appendChild(button);
    row.appendChild(cell);
  }

  function makeHeader(document) {
    var header = document.createElement('div');
    header.className = 'chat-row chat-row-head';
    header.setAttribute('role', 'row');
    ['Select', 'Pin', 'Date', 'Platform', 'Title', 'Messages', 'Tags'].forEach(function(label) {
      appendCell(header, label);
    });
    return header;
  }

  function makeRow(document, chat, index, top, selectedChatId, selectedIds, onSelect, onPinToggle, onToggleSelected, draggable) {
    var row = document.createElement('div');
    row.className = 'chat-row chat-row-data' + (chat.chatId === selectedChatId ? ' selected' : '') + (selectedIds[chat.chatId] ? ' bulk-selected' : '');
    row.setAttribute('role', 'row');
    row.tabIndex = 0;
    row.draggable = draggable;
    row.dataset.chatId = chat.chatId || '';
    row.style.transform = 'translateY(' + top + 'px)';
    row.addEventListener('click', function() {
      onSelect(chat);
    });
    row.addEventListener('keydown', function(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onSelect(chat);
    });
    row.addEventListener('dragstart', function(event) {
      if (!draggable || !event.dataTransfer) return;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', chat.chatId || '');
      event.dataTransfer.setData('application/x-rakuzaichi-chat-id', chat.chatId || '');
    });

    appendSelectCell(row, chat, selectedIds, onToggleSelected);
    appendPinCell(row, chat, onPinToggle);
    appendCell(row, formatDate(chat.lastUpdatedAt || chat.capturedAt));
    appendCell(row, platformLabel(chat.platform));
    appendCell(row, text(chat.title, 'Untitled chat'));
    appendCell(row, text(chat.messageCount, '0'));
    appendCell(row, Array.isArray(chat.tags) && chat.tags.length ? chat.tags.join(', ') : 'none');
    return row;
  }

  function create(options) {
    options = options || {};
    var root = options.root;
    if (!root) throw new Error('chat list root is required');

    var document = root.ownerDocument;
    var fallbackWindow = typeof window !== 'undefined' ? window : { setTimeout: setTimeout, clearTimeout: clearTimeout };
    var win = options.window || document.defaultView || fallbackWindow;
    var state = {
      root: root,
      summaryEl: options.summaryEl || null,
      countEl: options.countEl || null,
      dao: options.dao || (typeof VaultDAO !== 'undefined' ? VaultDAO : null),
      onSelect: typeof options.onSelect === 'function' ? options.onSelect : function() {},
      onSelectionChange: typeof options.onSelectionChange === 'function' ? options.onSelectionChange : function() {},
      onPinToggle: typeof options.onPinToggle === 'function' ? options.onPinToggle : function() {},
      draggable: options.draggable !== false,
      chats: [],
      selectedIds: {},
      selectedChatId: '',
      frame: 0,
      start: -1,
      end: -1,
      body: null,
      empty: null,
      spacer: null,
      window: null
    };
    var requestFrame = win.requestAnimationFrame || function(callback) { return win.setTimeout(callback, 16); };
    var cancelFrame = win.cancelAnimationFrame || win.clearTimeout;
    function handleScroll() {
      requestRender(false);
    }

    function updateSummary() {
      var count = state.chats.length;
      if (state.summaryEl) state.summaryEl.textContent = count + (count === 1 ? ' captured' : ' captured');
      if (state.countEl) state.countEl.textContent = String(count);
    }

    function rowCountForViewport() {
      var height = state.root.clientHeight || 480;
      return Math.ceil(height / ROW_HEIGHT) + OVERSCAN * 2;
    }

    function render(force) {
      state.frame = 0;
      updateSummary();
      var total = state.chats.length;
      state.spacer.style.height = total * ROW_HEIGHT + 'px';

      if (!total) {
        state.empty.hidden = false;
        state.window.innerHTML = '';
        state.start = -1;
        state.end = -1;
        return;
      }

      state.empty.hidden = true;
      var headerHeight = state.root.querySelector('.chat-row-head').offsetHeight || 36;
      var scrollTop = Math.max(state.root.scrollTop - headerHeight, 0);
      var start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
      var end = Math.min(total, start + rowCountForViewport());
      if (!force && start === state.start && end === state.end) return;

      state.start = start;
      state.end = end;
      state.window.innerHTML = '';
      state.window.style.transform = 'translateY(' + start * ROW_HEIGHT + 'px)';

      var fragment = document.createDocumentFragment();
      for (var i = start; i < end; i++) {
        fragment.appendChild(makeRow(document, state.chats[i], i, (i - start) * ROW_HEIGHT, state.selectedChatId, state.selectedIds, select, togglePinned, toggleSelected, state.draggable));
      }
      state.window.appendChild(fragment);
    }

    function requestRender(force) {
      if (state.frame) return;
      state.frame = requestFrame(function() {
        render(!!force);
      });
    }

    function select(chat) {
      state.selectedChatId = chat.chatId || '';
      state.onSelect(chat);
      render(true);
    }

    async function togglePinned(chat) {
      var updated = await state.onPinToggle(chat, !chat.pinned);
      chat.pinned = updated && typeof updated.pinned === 'boolean' ? updated.pinned : !chat.pinned;
      render(true);
    }

    function selectedChats() {
      return state.chats.filter(function(chat) {
        return !!state.selectedIds[chat.chatId];
      });
    }

    function emitSelectionChange() {
      state.onSelectionChange(selectedChats());
    }

    function toggleSelected(chat, selected) {
      if (!chat || !chat.chatId) return;
      if (selected) state.selectedIds[chat.chatId] = true;
      else delete state.selectedIds[chat.chatId];
      emitSelectionChange();
      render(true);
    }

    function reconcileSelection() {
      var keep = {};
      state.chats.forEach(function(chat) {
        if (state.selectedIds[chat.chatId]) keep[chat.chatId] = true;
      });
      state.selectedIds = keep;
      emitSelectionChange();
    }

    function setChats(chats) {
      state.chats = Array.isArray(chats) ? chats.slice() : [];
      reconcileSelection();
      state.empty.textContent = 'No captured chats yet.';
      state.root.scrollTop = 0;
      render(true);
      return state.chats;
    }

    function setError() {
      state.chats = [];
      updateSummary();
      state.spacer.style.height = '0px';
      state.window.innerHTML = '';
      state.empty.hidden = false;
      state.empty.textContent = 'Unable to load chats.';
    }

    async function load() {
      if (!state.dao || typeof state.dao.listChats !== 'function') {
        setChats([]);
        return state.chats;
      }

      try {
        return setChats(await state.dao.listChats());
      } catch (error) {
        setError(error);
        if (typeof AppLogger !== 'undefined') {
          AppLogger.error('options.chat_list.load.failed', { error: AppLogger.serializeError(error) });
        }
        return state.chats;
      }
    }

    function destroy() {
      if (state.frame) cancelFrame(state.frame);
      state.root.removeEventListener('scroll', handleScroll);
    }

    root.innerHTML = '';
    root.classList.add('chat-table');
    root.setAttribute('role', 'table');
    root.setAttribute('aria-label', root.getAttribute('aria-label') || 'Captured chats');
    root.appendChild(makeHeader(document));

    state.body = document.createElement('div');
    state.body.className = 'chat-list-body';
    state.body.setAttribute('role', 'rowgroup');

    state.spacer = document.createElement('div');
    state.spacer.className = 'chat-list-spacer';
    state.body.appendChild(state.spacer);

    state.window = document.createElement('div');
    state.window.className = 'chat-list-window';
    state.body.appendChild(state.window);

    state.empty = document.createElement('div');
    state.empty.className = 'chat-empty';
    state.empty.setAttribute('role', 'row');
    state.empty.textContent = 'No captured chats yet.';
    state.body.appendChild(state.empty);

    root.appendChild(state.body);
    root.addEventListener('scroll', handleScroll);
    render(true);

    return {
      load: load,
      setChats: setChats,
      destroy: destroy,
      getVisibleRange: function() {
        return { start: state.start, end: state.end };
      },
      getChats: function() {
        return state.chats.slice();
      },
      getSelectedChats: selectedChats,
      clearSelection: function() {
        state.selectedIds = {};
        emitSelectionChange();
        render(true);
      }
    };
  }

  return {
    ROW_HEIGHT: ROW_HEIGHT,
    OVERSCAN: OVERSCAN,
    create: create
  };
})();

if (typeof module !== 'undefined') module.exports = OptionsChatList;
