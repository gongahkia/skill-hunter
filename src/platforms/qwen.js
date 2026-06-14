var _platforms = (typeof _platforms !== 'undefined') ? _platforms : [];
_platforms.push({
  id: 'qwen',
  name: 'Qwen Chat',
  hostPatterns: ['*://chat.qwen.ai/*', '*://tongyi.aliyun.com/*'],
  detect() {
    return /(^chat\.qwen\.ai$|^tongyi\.aliyun\.com$)/.test(window.location.hostname) && !!DomUtils.querySafe(document, [
      '[data-testid="chat-message"]',
      '[data-testid="message"]',
      '.chat-message',
      '.message-item',
      '[class*="MessageItem"]'
    ]);
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
    var modelEl = DomUtils.querySafe(document, [
      '[data-testid="model-name"]',
      '[class*="model"]',
      'button[aria-label*="model" i]'
    ]);
    var model = modelEl ? DomUtils.readText(modelEl) : '';
    var chatId = window.location.pathname.split('/').filter(Boolean).pop() || 'qwen';

    for (var i = 0; i < els.length; i++) {
      messages.push(MessageSchema.create({
        role: DomUtils.inferRole(els[i], i % 2 === 0 ? 'user' : 'assistant'),
        content: DomUtils.readText(els[i]),
        id: DomUtils.buildMessageId('qwen', els[i], i, chatId),
        timestamp: DomUtils.readTimestamp(els[i]),
        platform: 'qwen',
        model: model,
        index: i
      }));
    }

    return { messages: messages, chatTitle: document.title, model: model };
  }
});
