var OptionsChatDetail = (function() {
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

  function makeMessage(document, win, message, copyText) {
    var card = document.createElement('article');
    card.className = 'message-card ' + roleClass(message.role);
    card.dataset.messageId = message.messageId || '';

    var meta = document.createElement('div');
    meta.className = 'message-meta';

    var role = document.createElement('strong');
    role.textContent = roleLabel(message.role);
    meta.appendChild(role);

    var timestamp = document.createElement('span');
    timestamp.textContent = formatTimestamp(message.timestamp);
    meta.appendChild(timestamp);

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
    meta.appendChild(copy);

    var body = document.createElement('div');
    body.className = 'message-content';
    body.textContent = text(message.content, '(empty)');

    card.appendChild(meta);
    card.appendChild(body);
    return card;
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
    var pinButton = options.pinButton || null;
    var currentChat = null;
    var copyText = options.copyText || function(value) {
      return defaultCopy(document, win, value);
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

    async function saveTags(chat, tags, messages) {
      if (!dao || typeof dao.setChatTags !== 'function') return;
      var updated = await dao.setChatTags(chat.chatId, tags);
      if (!updated) return;
      chat.tags = updated.tags || [];
      render(chat, messages);
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

    function renderEmpty(title, message) {
      root.innerHTML = '';
      currentChat = null;
      syncPinButton(null);
      var empty = makeEmpty(title, message);
      root.appendChild(empty);
    }

    function render(chat, messages) {
      root.innerHTML = '';
      currentChat = chat;
      setOriginalLink(openLink, chat);
      syncPinButton(chat);

      var summary = document.createElement('section');
      summary.className = 'detail-summary';
      var title = document.createElement('h3');
      title.textContent = text(chat.title, 'Untitled chat');
      summary.appendChild(title);

      var meta = document.createElement('p');
      meta.textContent = [
        text(chat.platform, 'unknown'),
        text(chat.messageCount, messages.length) + ' messages',
        chat.lastUpdatedAt ? 'updated ' + formatTimestamp(chat.lastUpdatedAt) : ''
      ].filter(Boolean).join(' | ');
      summary.appendChild(meta);
      root.appendChild(summary);
      root.appendChild(makeTagEditor(chat, messages));

      if (!messages.length) {
        root.appendChild(makeEmpty('No messages', 'No messages captured for this chat.'));
        return;
      }

      var list = document.createElement('div');
      list.className = 'message-list';
      for (var i = 0; i < messages.length; i++) {
        list.appendChild(makeMessage(document, win, messages[i], copyText));
      }
      root.appendChild(list);
    }

    async function load(chat) {
      if (!chat || !chat.chatId) {
        setOriginalLink(openLink, null);
        renderEmpty('Select a chat', 'No captured chat selected.');
        return [];
      }

      try {
        var messages = dao && typeof dao.listMessages === 'function' ? await dao.listMessages(chat.chatId) : [];
        render(chat, Array.isArray(messages) ? messages : []);
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

    setOriginalLink(openLink, null);
    renderEmpty('Select a chat', 'No captured chat selected.');

    return {
      load: load
    };
  }

  return {
    create: create
  };
})();

if (typeof module !== 'undefined') module.exports = OptionsChatDetail;
