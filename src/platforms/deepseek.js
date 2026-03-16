var _platforms = (typeof _platforms !== 'undefined') ? _platforms : [];
_platforms.push({
  id: 'deepseek',
  name: 'DeepSeek',
  hostPatterns: ['*://chat.deepseek.com/*'],
  detect() {
    return !!DomUtils.querySafe(document, [
      '.chat-container.divider',
      '#chat-container',
      '[class*="ChatContainer"]'
    ]);
  },
  extract() {
    var messages = [];
    var container = DomUtils.querySafe(document, ['.chat-container.divider', '#chat-container']);
    if (!container) return { messages: messages, chatTitle: document.title, model: '' };
    var els = DomUtils.querySafeAll(container, [
      '.message',
      '[class*="MessageItem"]'
    ]);
    var modelEl = DomUtils.querySafe(document, [
      '[class*="model-selector"]',
      '.model-name'
    ]);
    var model = modelEl ? modelEl.textContent.trim() : '';
    for (var i = 0; i < els.length; i++) {
      messages.push(MessageSchema.create({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: (els[i].innerText || '').trim(),
        id: els[i].id || 'msg-' + i,
        platform: 'deepseek',
        model: model,
        index: i
      }));
    }
    return { messages: messages, chatTitle: document.title, model: model };
  }
});
