var _platforms = (typeof _platforms !== 'undefined') ? _platforms : [];
_platforms.push({
  id: 'notebooklm',
  name: 'NotebookLM',
  hostPatterns: ['*://notebooklm.google.com/*'],
  detect() {
    return window.location.hostname === 'notebooklm.google.com' && !!DomUtils.querySafe(document, [
      '[data-testid="chat-message"]',
      '[data-testid="message"]',
      '.chat-message',
      '.message-item',
      '[class*="MessageItem"]'
    ]);
  },
  extractSources() {
    var sourceEls = DomUtils.querySafeAll(document, [
      '[data-testid="source-item"]',
      '.source-item',
      '[class*="SourceItem"]'
    ]);
    return sourceEls.map(function(source) {
      var link = DomUtils.querySafe(source, ['a[href]']);
      var href = link ? link.getAttribute('href') : '';
      return {
        title: DomUtils.readText(source),
        url: href ? new URL(href, window.location.href).href : ''
      };
    }).filter(function(source) {
      return source.title || source.url;
    });
  },
  extract() {
    var messages = [];
    var container = DomUtils.querySafe(document, ['main', '[role="main"]', '[data-testid="conversation"]', 'body']);
    var els = DomUtils.querySafeAll(container, [
      '[data-testid="chat-message"]',
      '[data-testid="message"]',
      '.chat-message',
      '.message-item',
      '[class*="MessageItem"]'
    ]);
    var chatId = window.location.pathname.split('/').filter(Boolean).pop() || 'notebooklm';

    for (var i = 0; i < els.length; i++) {
      messages.push(MessageSchema.create({
        role: DomUtils.inferRole(els[i], i % 2 === 0 ? 'user' : 'assistant'),
        content: DomUtils.readText(els[i]),
        id: DomUtils.buildMessageId('notebooklm', els[i], i, chatId),
        timestamp: DomUtils.readTimestamp(els[i]),
        platform: 'notebooklm',
        model: 'NotebookLM',
        index: i
      }));
    }

    return {
      messages: messages,
      chatTitle: document.title,
      model: 'NotebookLM',
      metadata: { sources: this.extractSources() }
    };
  }
});
