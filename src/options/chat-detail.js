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

    function renderEmpty(title, message) {
      root.innerHTML = '';
      var empty = makeEmpty(title, message);
      root.appendChild(empty);
    }

    function render(chat, messages) {
      root.innerHTML = '';
      setOriginalLink(openLink, chat);

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
