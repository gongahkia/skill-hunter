var OptionsChatDetail = (function() {
  var BUILT_IN_THREAD_TAGS = ['TODO', 'FIXME', 'REV', 'REF', 'FOLLOWUP', 'UNRESOLVED', 'PROMPT'];
  var NEW_CHAT_URLS = {
    chatgpt: 'https://chatgpt.com/',
    claude: 'https://claude.ai/new',
    gemini: 'https://gemini.google.com/app',
    perplexity: 'https://www.perplexity.ai/',
    deepseek: 'https://chat.deepseek.com/',
    grok: 'https://grok.com/',
    copilot: 'https://copilot.microsoft.com/',
    mistral: 'https://chat.mistral.ai/chat',
    huggingchat: 'https://huggingface.co/chat/',
    poe: 'https://poe.com/',
    kimi: 'https://kimi.com/',
    qwen: 'https://chat.qwen.ai/',
    chatglm: 'https://chatglm.cn/main',
    doubao: 'https://www.doubao.com/chat/',
    notebooklm: 'https://notebooklm.google.com/'
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
    qwen: 'Qwen Chat',
    chatglm: 'ChatGLM',
    doubao: 'Doubao',
    notebooklm: 'NotebookLM'
  };
  var DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  function text(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback || '';
    return String(value);
  }

  function formatTimestamp(value) {
    if (!value) return 'Unknown time';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return text(value).slice(0, 24);
    return DATE_TIME_FORMATTER.format(date);
  }

  function roleClass(role) {
    return text(role, 'unknown').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  }

  function roleLabel(role) {
    role = text(role, 'unknown');
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  function platformLabel(platform) {
    return PLATFORM_LABELS[platform] || text(platform, 'unknown');
  }

  function newChatUrl(platform) {
    return NEW_CHAT_URLS[platform] || 'https://chatgpt.com/';
  }

  function defaultOpenUrl(win, url) {
    if (win.open) win.open(url, '_blank', 'noopener');
  }

  function createId(prefix) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return prefix + ':' + crypto.randomUUID();
    return prefix + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 10);
  }

  function excerpt(value) {
    value = text(value).replace(/\s+/g, ' ').trim();
    return value.length > 240 ? value.slice(0, 237) + '...' : value;
  }

  function getMessageId(message) {
    return message.messageId || message.id || '';
  }

  function activeThreads(threads) {
    return (Array.isArray(threads) ? threads : []).filter(function(thread) {
      return thread && thread.status !== 'archived';
    });
  }

  function shortcutTag(key) {
    var value = text(key).toLowerCase();
    if (value === 't') return 'TODO';
    if (value === 'f') return 'FIXME';
    if (value === 'r') return 'REF';
    if (value === 'v') return 'REV';
    if (value === 'u') return 'UNRESOLVED';
    if (value === 'p') return 'PROMPT';
    if (value === 'l') return 'FOLLOWUP';
    return '';
  }

  function isEditableTarget(target) {
    if (!target || !target.tagName) return false;
    var tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  function normalizeTagName(value) {
    if (typeof ThreadScanner !== 'undefined' && ThreadScanner.normalizeTagName) return ThreadScanner.normalizeTagName(value);
    return text(value).trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function normalizeCustomTags(customTags) {
    var seen = {};
    var result = [];
    (Array.isArray(customTags) ? customTags : []).forEach(function(entry) {
      var tag = normalizeTagName(entry && typeof entry === 'object' ? entry.tag : entry);
      if (!tag || seen[tag] || BUILT_IN_THREAD_TAGS.indexOf(tag) !== -1) return;
      seen[tag] = true;
      var color = text(entry && entry.color, '#888888');
      result.push({ tag: tag, color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#888888' });
    });
    return result;
  }

  function customTagColor(customTags, tag) {
    tag = normalizeTagName(tag);
    var match = normalizeCustomTags(customTags).filter(function(entry) {
      return entry.tag === tag;
    })[0];
    return match ? match.color : '';
  }

  function threadTags(customTags) {
    return BUILT_IN_THREAD_TAGS.concat(normalizeCustomTags(customTags).map(function(entry) { return entry.tag; }));
  }

  function threadsByMessageId(threads) {
    var grouped = {};
    activeThreads(threads).forEach(function(thread) {
      if (!thread.messageId) return;
      if (!grouped[thread.messageId]) grouped[thread.messageId] = [];
      grouped[thread.messageId].push(thread);
    });
    return grouped;
  }

  function findMessageCard(root, messageId) {
    var cards = root.querySelectorAll('.message-card');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].dataset.messageId === messageId) return cards[i];
    }
    return null;
  }

  function tagPrefixPattern(customTags) {
    return new RegExp('(^|\\n)([ \\t]*)(' + threadTags(customTags).map(function(tag) {
      return tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|') + ')(\\s*:)', 'gi');
  }

  function appendMessageContent(document, root, value, customTags) {
    var content = text(value, '(empty)');
    var pattern = tagPrefixPattern(customTags);
    var index = 0;
    var match;
    while ((match = pattern.exec(content))) {
      var tagStart = match.index + match[1].length + match[2].length;
      var tagEnd = tagStart + match[3].length;
      if (tagStart > index) root.appendChild(document.createTextNode(content.slice(index, tagStart)));
      var tag = document.createElement('span');
      tag.className = 'message-tag-prefix';
      tag.dataset.tag = normalizeTagName(match[3]);
      var customColor = customTagColor(customTags, tag.dataset.tag);
      if (customColor) tag.style.color = customColor;
      tag.textContent = content.slice(tagStart, tagEnd);
      root.appendChild(tag);
      index = tagEnd;
    }
    if (index < content.length || !root.childNodes.length) {
      root.appendChild(document.createTextNode(content.slice(index)));
    }
  }

  function setOriginalLink(link, chat) {
    if (!link) return;
    if (chat && chat.url) {
      link.href = chat.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-disabled', 'false');
      link.removeAttribute('tabindex');
      return;
    }
    link.href = '#';
    link.removeAttribute('target');
    link.removeAttribute('rel');
    link.setAttribute('aria-disabled', 'true');
    link.tabIndex = -1;
  }

  function defaultCopy(document, win, value) {
    if (win.navigator && win.navigator.clipboard && win.navigator.clipboard.writeText) {
      return win.navigator.clipboard.writeText(value);
    }

    var input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    var ok = document.execCommand && document.execCommand('copy');
    document.body.removeChild(input);
    return ok ? Promise.resolve() : Promise.reject(new Error('Clipboard API is unavailable'));
  }

  function makeThreadRecord(document, thread) {
    var record = document.createElement('div');
    record.className = 'thread-record';
    record.tabIndex = -1;

    var header = document.createElement('div');
    header.className = 'thread-record-header';
    var tag = document.createElement('strong');
    tag.textContent = thread.tag || 'THREAD';
    header.appendChild(tag);
    var status = document.createElement('span');
    status.textContent = text(thread.status, 'open');
    header.appendChild(status);
    record.appendChild(header);

    var meta = document.createElement('p');
    meta.textContent = [text(thread.source, 'explicit'), text(thread.subSource, '')].filter(Boolean).join(' / ');
    record.appendChild(meta);

    var body = document.createElement('div');
    body.className = 'thread-record-body';
    body.textContent = text(thread.text, '(empty)');
    record.appendChild(body);
    return record;
  }

  function makeThreadSidebar(document, threads, jumpToThread) {
    var sidebar = document.createElement('aside');
    sidebar.className = 'chat-thread-sidebar';
    var heading = document.createElement('h4');
    heading.textContent = 'Open threads';
    sidebar.appendChild(heading);

    if (!threads.length) {
      var empty = document.createElement('p');
      empty.className = 'panel-note';
      empty.textContent = 'No open threads.';
      sidebar.appendChild(empty);
      return sidebar;
    }

    var list = document.createElement('div');
    list.className = 'chat-thread-list';
    threads.forEach(function(thread) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'chat-thread-link';
      button.dataset.threadId = thread.threadId || '';
      button.dataset.messageId = thread.messageId || '';
      button.innerHTML = '';
      var tag = document.createElement('strong');
      tag.textContent = thread.tag || 'THREAD';
      button.appendChild(tag);
      var body = document.createElement('span');
      body.textContent = text(thread.text, '(empty)');
      button.appendChild(body);
      button.addEventListener('click', function() {
        jumpToThread(thread);
      });
      list.appendChild(button);
    });
    sidebar.appendChild(list);
    return sidebar;
  }

  function makeMessage(document, win, chat, message, threads, copyText, createThread, openThread, archiveThread, customTags) {
    var card = document.createElement('article');
    card.className = 'message-card ' + roleClass(message.role);
    card.dataset.messageId = getMessageId(message);
    card.tabIndex = 0;

    var meta = document.createElement('div');
    meta.className = 'message-meta';

    var role = document.createElement('strong');
    role.textContent = roleLabel(message.role);
    meta.appendChild(role);

    var timestamp = document.createElement('span');
    timestamp.textContent = formatTimestamp(message.timestamp);
    meta.appendChild(timestamp);

    var actions = document.createElement('div');
    actions.className = 'message-actions';

    var tagButton = document.createElement('button');
    tagButton.className = 'btn btn-ghost tag-message';
    tagButton.type = 'button';
    tagButton.textContent = 'Tag this';
    actions.appendChild(tagButton);

    var copy = document.createElement('button');
    copy.className = 'btn btn-ghost copy-message';
    copy.type = 'button';
    copy.textContent = 'Copy';
    copy.addEventListener('click', async function(event) {
      event.stopPropagation();
      try {
        await copyText(text(message.content));
        copy.textContent = 'Copied';
        win.setTimeout(function() {
          copy.textContent = 'Copy';
        }, 1400);
      } catch (error) {
        copy.textContent = 'Copy failed';
      }
    });
    actions.appendChild(copy);
    meta.appendChild(actions);

    var body = document.createElement('div');
    body.className = 'message-content';
    appendMessageContent(document, body, message.content, customTags);

    card.appendChild(meta);

    if (threads.length) {
      var chips = document.createElement('div');
      chips.className = 'message-thread-chips';
      threads.forEach(function(thread) {
        var wrap = document.createElement('span');
        wrap.className = 'thread-chip-wrap';
        wrap.dataset.tag = thread.tag || '';
        var chipColor = customTagColor(customTags, thread.tag);
        if (chipColor) wrap.style.borderColor = chipColor;

        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'thread-chip';
        chip.dataset.threadId = thread.threadId || '';
        chip.dataset.tag = thread.tag || '';
        chip.textContent = thread.tag || 'THREAD';
        chip.title = 'Open thread record';
        chip.setAttribute('aria-expanded', 'false');
        chip.addEventListener('click', function(event) {
          event.stopPropagation();
          var record = card.querySelector('.thread-record-slot');
          record.innerHTML = '';
          record.appendChild(makeThreadRecord(document, thread));
          record.hidden = false;
          chips.querySelectorAll('.thread-chip').forEach(function(item) {
            item.setAttribute('aria-expanded', String(item === chip));
          });
          openThread(thread);
        });
        wrap.appendChild(chip);

        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'thread-chip-remove';
        remove.textContent = 'x';
        remove.title = 'Remove tag';
        remove.setAttribute('aria-label', 'Remove ' + (thread.tag || 'thread') + ' thread');
        remove.addEventListener('click', async function(event) {
          event.stopPropagation();
          try {
            await archiveThread(thread);
          } catch (error) {
            remove.textContent = '!';
          }
        });
        wrap.appendChild(remove);
        chips.appendChild(wrap);
      });
      card.appendChild(chips);
    }

    card.appendChild(body);

    var popover = document.createElement('div');
    popover.className = 'thread-popover';
    popover.hidden = true;

    var note = document.createElement('input');
    note.type = 'text';
    note.placeholder = 'Optional note';
    popover.appendChild(note);

    var tagGrid = document.createElement('div');
    tagGrid.className = 'thread-tag-grid';
    async function applyTag(tag) {
      try {
        await createThread(chat, message, tag, note.value);
        popover.hidden = true;
        note.value = '';
        tagButton.textContent = 'Tagged';
        win.setTimeout(function() {
          tagButton.textContent = 'Tag this';
        }, 1400);
      } catch (error) {
        tagButton.textContent = 'Tag failed';
      }
    }
    threadTags(customTags).forEach(function(tag) {
      var button = document.createElement('button');
      button.type = 'button';
      button.dataset.tag = tag;
      button.textContent = tag;
      var buttonColor = customTagColor(customTags, tag);
      if (buttonColor) button.style.borderColor = buttonColor;
      button.addEventListener('click', async function() {
        await applyTag(tag);
      });
      tagGrid.appendChild(button);
    });
    popover.appendChild(tagGrid);
    card.appendChild(popover);

    var recordSlot = document.createElement('div');
    recordSlot.className = 'thread-record-slot';
    recordSlot.hidden = true;
    card.appendChild(recordSlot);

    tagButton.addEventListener('click', function(event) {
      event.stopPropagation();
      popover.hidden = !popover.hidden;
      if (!popover.hidden) note.focus();
    });

    card.addEventListener('keydown', async function(event) {
      if (isEditableTarget(event.target)) return;
      var key = text(event.key).toLowerCase();
      if (key === 't' && popover.hidden) {
        event.preventDefault();
        popover.hidden = false;
        return;
      }
      if (popover.hidden) return;
      var tag = shortcutTag(key);
      if (!tag) return;
      event.preventDefault();
      await applyTag(tag);
    });

    return card;
  }

  function buildPrimer(chat, messages) {
    var lines = [
      '# Continue this saved chat',
      '',
      'Source title: ' + text(chat.title, 'Untitled chat'),
      'Source platform: ' + platformLabel(chat.platform),
      'Source URL: ' + text(chat.url, 'n/a'),
      'Source model: ' + text(chat.model, 'n/a'),
      'Messages: ' + String(messages.length || chat.messageCount || 0)
    ];
    if (chat.lastUpdatedAt) lines.push('Last updated: ' + formatTimestamp(chat.lastUpdatedAt));
    lines.push('');
    lines.push('Use this transcript as context. Continue from it without assuming access to the original page.');
    lines.push('');
    lines.push('Transcript:');

    messages.forEach(function(message, index) {
      lines.push('');
      lines.push('[' + String(index + 1) + '] ' + roleLabel(message.role) + ' | ' + formatTimestamp(message.timestamp));
      lines.push(text(message.content, '(empty)'));
    });

    return lines.join('\n');
  }

  function oneLine(value, fallback) {
    return text(value, fallback).replace(/\s+/g, ' ').trim();
  }

  function buildMarkdown(chat, messages) {
    var lines = [
      '# ' + oneLine(chat.title, 'Untitled chat'),
      '',
      '- Platform: ' + platformLabel(chat.platform),
      '- Source URL: ' + text(chat.url, 'n/a'),
      '- Model: ' + text(chat.model, 'n/a'),
      '- Message count: ' + String(messages.length || chat.messageCount || 0)
    ];
    if (chat.lastUpdatedAt) lines.push('- Last updated: ' + formatTimestamp(chat.lastUpdatedAt));
    lines.push('');

    messages.forEach(function(message) {
      lines.push('## ' + roleLabel(message.role));
      if (message.timestamp) lines.push('`' + message.timestamp + '`');
      lines.push('');
      lines.push(text(message.content, '(empty)'));
      lines.push('');
    });

    return lines.join('\n').trim() + '\n';
  }

  function create(options) {
    options = options || {};
    var root = options.root;
    if (!root) throw new Error('chat detail root is required');

    var document = root.ownerDocument;
    var fallbackWindow = typeof window !== 'undefined' ? window : { setTimeout: setTimeout, clearTimeout: clearTimeout };
    var win = options.window || document.defaultView || fallbackWindow;
    var dao = options.dao || (typeof VaultDAO !== 'undefined' ? VaultDAO : null);
    var onTagsChanged = typeof options.onTagsChanged === 'function' ? options.onTagsChanged : function() {};
    var onPinChanged = typeof options.onPinChanged === 'function' ? options.onPinChanged : function() {};
    var onThreadCreated = typeof options.onThreadCreated === 'function' ? options.onThreadCreated : function() {};
    var onThreadOpen = typeof options.onThreadOpen === 'function' ? options.onThreadOpen : function() {};
    var pinButton = options.pinButton || null;
    var sendButton = options.sendButton || null;
    var restoreButton = options.restoreButton || null;
    var extractionButton = options.extractionButton || null;
    var extractionStatus = options.extractionStatus || null;
    var onRunExtraction = typeof options.onRunExtraction === 'function' ? options.onRunExtraction : null;
    var currentChat = null;
    var currentMessages = [];
    var currentThreads = [];
    var extractionRunning = false;
    function configuredCustomTags() {
      return normalizeCustomTags(typeof options.getCustomThreadTags === 'function' ? options.getCustomThreadTags() : options.customThreadTags);
    }
    var currentCustomTags = configuredCustomTags();
    var copyText = options.copyText || function(value) {
      return defaultCopy(document, win, value);
    };
    var openUrl = options.openUrl || function(url) {
      return defaultOpenUrl(win, url);
    };
    var openLink = options.openLink || null;

    function makeEmpty(title, message) {
      var empty = document.createElement('div');
      empty.className = 'detail-empty';
      var heading = document.createElement('h3');
      heading.textContent = title;
      var copy = document.createElement('p');
      copy.textContent = message;
      empty.appendChild(heading);
      empty.appendChild(copy);
      return empty;
    }

    function syncPinButton(chat) {
      if (!pinButton) return;
      if (!chat || !chat.chatId) {
        pinButton.disabled = true;
        pinButton.textContent = '☆';
        pinButton.setAttribute('aria-label', 'Pin chat');
        return;
      }
      pinButton.disabled = false;
      pinButton.textContent = chat.pinned ? '★' : '☆';
      pinButton.setAttribute('aria-label', chat.pinned ? 'Unpin chat' : 'Pin chat');
    }

    function syncSendButton(chat) {
      if (!sendButton) return;
      sendButton.disabled = !(chat && chat.chatId);
      sendButton.textContent = 'Send to new chat';
    }

    function syncRestoreButton(chat) {
      if (!restoreButton) return;
      restoreButton.disabled = !(chat && chat.chatId);
      restoreButton.textContent = 'Restore to clipboard';
    }

    function syncExtractionButton(chat) {
      if (!extractionButton) return;
      extractionButton.disabled = extractionRunning || !(chat && chat.chatId) || !onRunExtraction;
      if (!extractionRunning) extractionButton.textContent = 'Run extraction';
    }

    function setExtractionStatus(value) {
      if (extractionStatus) extractionStatus.textContent = value || '';
    }

    function extractionProgressLabel(event) {
      event = event || {};
      if (event.status === 'model-load' || event.status === 'model-progress') return 'Model load';
      if (event.status === 'chunk-processing') return 'Chunk ' + String((event.index || 0) + 1) + '/' + String(event.total || 1);
      if (event.status === 'done') return 'Done';
      return text(event.status, 'Running');
    }

    async function runCurrentExtraction() {
      if (!currentChat || !currentChat.chatId || !onRunExtraction || extractionRunning) return;
      extractionRunning = true;
      syncExtractionButton(currentChat);
      if (extractionButton) extractionButton.textContent = 'Model load';
      setExtractionStatus('Model load');
      try {
        var result = await onRunExtraction(currentChat, currentMessages, function(event) {
          var label = extractionProgressLabel(event);
          if (extractionButton) extractionButton.textContent = label;
          setExtractionStatus(label);
        });
        setExtractionStatus('Done: ' + String(result && typeof result.threadCount === 'number' ? result.threadCount : 0) + ' threads');
        await load(currentChat);
      } catch (error) {
        setExtractionStatus('Extraction failed');
        if (typeof AppLogger !== 'undefined') {
          AppLogger.error('options.chat_detail.extraction.failed', { error: AppLogger.serializeError(error), chatId: currentChat.chatId });
        }
      } finally {
        extractionRunning = false;
        syncExtractionButton(currentChat);
      }
    }

    async function createThread(chat, message, tag, note) {
      if (!dao || typeof dao.putOpenThreads !== 'function') throw new Error('open thread store is unavailable');
      var thread = {
        threadId: createId('thread'),
        chatId: chat.chatId,
        messageId: message.messageId || message.id || '',
        tag: tag,
        text: text(note).trim() || excerpt(message.content),
        source: 'explicit',
        subSource: 'user',
        status: 'open',
        createdAt: new Date().toISOString()
      };
      await dao.putOpenThreads([thread]);
      currentThreads = activeThreads(currentThreads.concat(thread));
      render(chat, currentMessages, currentThreads);
      onThreadCreated(thread);
      return thread;
    }

    async function archiveThread(thread) {
      if (!thread || !thread.threadId) throw new Error('threadId is required');
      if (!dao || typeof dao.setThreadStatus !== 'function') throw new Error('thread status store is unavailable');
      var updated = await dao.setThreadStatus(thread.threadId, 'archived');
      currentThreads = activeThreads(currentThreads.filter(function(row) {
        return row.threadId !== thread.threadId;
      }));
      render(currentChat, currentMessages, currentThreads);
      return updated;
    }

    async function saveTags(chat, tags, messages) {
      if (!dao || typeof dao.setChatTags !== 'function') return;
      var updated = await dao.setChatTags(chat.chatId, tags);
      if (!updated) return;
      chat.tags = updated.tags || [];
      render(chat, messages, currentThreads);
      onTagsChanged(chat);
    }

    function makeTagEditor(chat, messages) {
      var editor = document.createElement('section');
      editor.className = 'tag-editor';

      var chips = document.createElement('div');
      chips.className = 'tag-chips';
      (Array.isArray(chat.tags) ? chat.tags : []).forEach(function(tag) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'tag-chip';
        chip.textContent = tag;
        chip.title = 'Remove tag';
        chip.addEventListener('click', function() {
          saveTags(chat, chat.tags.filter(function(value) { return value !== tag; }), messages);
        });
        chips.appendChild(chip);
      });
      if (!chips.childNodes.length) {
        var empty = document.createElement('span');
        empty.className = 'panel-note';
        empty.textContent = 'No tags.';
        chips.appendChild(empty);
      }
      editor.appendChild(chips);

      var add = document.createElement('div');
      add.className = 'tag-add';
      var input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Add tag';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-secondary';
      button.textContent = 'Add';
      function submit() {
        var tag = input.value.trim();
        if (!tag) return;
        var tags = Array.isArray(chat.tags) ? chat.tags.slice() : [];
        if (tags.indexOf(tag) === -1) tags.push(tag);
        input.value = '';
        saveTags(chat, tags, messages);
      }
      button.addEventListener('click', submit);
      input.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        submit();
      });
      add.appendChild(input);
      add.appendChild(button);
      editor.appendChild(add);
      return editor;
    }

    function jumpToThread(thread) {
      var target = findMessageCard(root, thread.messageId || '');
      if (!target) return;
      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      target.classList.add('message-highlight');
      win.setTimeout(function() {
        target.classList.remove('message-highlight');
      }, 1800);
      target.focus();
      onThreadOpen(thread);
    }

    function renderEmpty(title, message) {
      root.innerHTML = '';
      currentChat = null;
      currentMessages = [];
      currentThreads = [];
      syncPinButton(null);
      syncSendButton(null);
      syncRestoreButton(null);
      syncExtractionButton(null);
      setExtractionStatus('');
      var empty = makeEmpty(title, message);
      root.appendChild(empty);
    }

    function render(chat, messages, threads) {
      root.innerHTML = '';
      currentChat = chat;
      currentMessages = Array.isArray(messages) ? messages : [];
      currentThreads = activeThreads(threads);
      currentCustomTags = configuredCustomTags();
      var groupedThreads = threadsByMessageId(currentThreads);
      setOriginalLink(openLink, chat);
      syncPinButton(chat);
      syncSendButton(chat);
      syncRestoreButton(chat);
      syncExtractionButton(chat);

      var summary = document.createElement('section');
      summary.className = 'detail-summary';
      var title = document.createElement('h3');
      title.textContent = text(chat.title, 'Untitled chat');
      summary.appendChild(title);

      var meta = document.createElement('p');
      meta.textContent = [
        text(chat.platform, 'unknown'),
        text(chat.messageCount, currentMessages.length) + ' messages',
        chat.lastUpdatedAt ? 'updated ' + formatTimestamp(chat.lastUpdatedAt) : ''
      ].filter(Boolean).join(' | ');
      summary.appendChild(meta);
      root.appendChild(summary);
      root.appendChild(makeTagEditor(chat, currentMessages));

      if (!currentMessages.length) {
        root.appendChild(makeEmpty('No messages', 'No messages captured for this chat.'));
        return;
      }

      var layout = document.createElement('div');
      layout.className = 'detail-thread-layout';
      layout.appendChild(makeThreadSidebar(document, currentThreads, jumpToThread));

      var list = document.createElement('div');
      list.className = 'message-list';
      for (var i = 0; i < currentMessages.length; i++) {
        list.appendChild(makeMessage(document, win, chat, currentMessages[i], groupedThreads[getMessageId(currentMessages[i])] || [], copyText, createThread, onThreadOpen, archiveThread, currentCustomTags));
      }
      layout.appendChild(list);
      root.appendChild(layout);
    }

    async function load(chat) {
      if (!chat || !chat.chatId) {
        setOriginalLink(openLink, null);
        renderEmpty('Select a chat', 'No captured chat selected.');
        return [];
      }

      try {
        var results = await Promise.all([
          dao && typeof dao.listMessages === 'function' ? dao.listMessages(chat.chatId) : Promise.resolve([]),
          dao && typeof dao.listOpenThreads === 'function' ? dao.listOpenThreads({ chatId: chat.chatId }) : Promise.resolve([])
        ]);
        var messages = Array.isArray(results[0]) ? results[0] : [];
        render(chat, messages, Array.isArray(results[1]) ? results[1] : []);
        return messages;
      } catch (error) {
        setOriginalLink(openLink, chat);
        renderEmpty('Unable to load chat', text(error && error.message, 'Message load failed.'));
        if (typeof AppLogger !== 'undefined') {
          AppLogger.error('options.chat_detail.load.failed', { error: AppLogger.serializeError(error), chatId: chat.chatId });
        }
        return [];
      }
    }

    if (pinButton) {
      pinButton.addEventListener('click', async function() {
        if (!currentChat || !dao || typeof dao.setChatPinned !== 'function') return;
        var updated = await dao.setChatPinned(currentChat.chatId, !currentChat.pinned);
        if (!updated) return;
        currentChat.pinned = !!updated.pinned;
        syncPinButton(currentChat);
        onPinChanged(currentChat);
      });
    }

    if (sendButton) {
      sendButton.addEventListener('click', async function() {
        if (!currentChat) return;
        var previous = sendButton.textContent;
        try {
          await copyText(buildPrimer(currentChat, currentMessages));
          openUrl(newChatUrl(currentChat.platform));
          sendButton.textContent = 'Sent';
          win.setTimeout(function() {
            sendButton.textContent = previous;
          }, 1600);
        } catch (error) {
          sendButton.textContent = 'Send failed';
        }
      });
    }

    if (restoreButton) {
      restoreButton.addEventListener('click', async function() {
        if (!currentChat) return;
        var previous = restoreButton.textContent;
        try {
          await copyText(buildMarkdown(currentChat, currentMessages));
          restoreButton.textContent = 'Copied';
          win.setTimeout(function() {
            restoreButton.textContent = previous;
          }, 1600);
        } catch (error) {
          restoreButton.textContent = 'Copy failed';
        }
      });
    }

    if (extractionButton) {
      extractionButton.addEventListener('click', function() {
        runCurrentExtraction();
      });
    }

    setOriginalLink(openLink, null);
    renderEmpty('Select a chat', 'No captured chat selected.');

    return {
      load: load
    };
  }

  return {
    create: create,
    buildMarkdown: buildMarkdown,
    newChatUrl: newChatUrl
  };
})();

if (typeof module !== 'undefined') module.exports = OptionsChatDetail;
