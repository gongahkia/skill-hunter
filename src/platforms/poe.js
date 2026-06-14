var _platforms = (typeof _platforms !== 'undefined') ? _platforms : [];
_platforms.push({
  id: 'poe',
  name: 'Poe',
  hostPatterns: ['*://poe.com/*', '*://www.poe.com/*'],
  detect() {
    return /(^|\.)poe\.com$/.test(window.location.hostname) && !!DomUtils.querySafe(document, [
      '[data-testid="chat-message"]',
      '[data-testid="message"]',
      '.ChatMessage',
      '[class*="ChatMessage"]',
      'main article'
    ]);
  },
  extract() {
    var messages = [];
    var container = DomUtils.querySafe(document, ['main', '[role="main"]', '[data-testid="chat"]', 'body']);
    var els = DomUtils.querySafeAll(container, [
      '[data-testid="chat-message"]',
      '[data-testid="message"]',
      '.ChatMessage',
      '[class*="ChatMessage"]',
      'main article'
    ]);
    var botEl = DomUtils.querySafe(document, [
      '[data-testid="bot_name"]',
      '[data-testid="bot-header"]',
      'h1',
      'header a[href^="/"]'
    ]);
    var model = botEl ? DomUtils.readText(botEl) : '';
    var chatId = window.location.pathname.split('/').filter(Boolean).pop() || 'poe';

    for (var i = 0; i < els.length; i++) {
      var role = DomUtils.inferRole(els[i], i % 2 === 0 ? 'user' : 'assistant');
      messages.push(MessageSchema.create({
        role: role,
        content: DomUtils.readText(els[i]),
        id: DomUtils.buildMessageId('poe', els[i], i, chatId),
        timestamp: DomUtils.readTimestamp(els[i]),
        platform: 'poe',
        model: model,
        index: i
      }));
    }

    return { messages: messages, chatTitle: document.title, model: model };
  }
});
