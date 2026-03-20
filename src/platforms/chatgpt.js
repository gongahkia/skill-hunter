var _platforms = (typeof _platforms !== 'undefined') ? _platforms : [];
_platforms.push({
  id: 'chatgpt',
  name: 'ChatGPT',
  hostPatterns: ['*://chat.openai.com/*', '*://chatgpt.com/*'],
  detect() {
    return !!DomUtils.querySafe(document, [
      'main [data-message-author-role]',
      '.flex.basis-auto.flex-col',
      '[class*="ConversationColumn"]'
    ]);
  },
  extract() {
    var messages = [];
    var container = DomUtils.querySafe(document, [
      '.flex.basis-auto.flex-col',
      'main'
    ]);
    if (!container) return { messages: messages, chatTitle: document.title, model: '' };
    var els = DomUtils.querySafeAll(container, [
      '[data-message-author-role]',
      '.min-h-8.text-message'
    ]);
    var modelEl = DomUtils.querySafe(document, [
      '[class*="model-switcher"] span',
      'button[aria-label*="Model"] span',
      '.text-token-text-secondary span'
    ]);
    var model = modelEl ? modelEl.textContent.trim() : '';
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var role = DomUtils.normalizeRole(el.getAttribute('data-message-author-role'), DomUtils.inferRole(el, i % 2 === 0 ? 'user' : 'assistant'));
      messages.push(MessageSchema.create({
        role: role,
        content: DomUtils.readText(el),
        id: DomUtils.buildMessageId('chatgpt', el, i),
        timestamp: DomUtils.readTimestamp(el),
        platform: 'chatgpt',
        model: model,
        index: i
      }));
    }
    return { messages: messages, chatTitle: document.title, model: model };
  }
});
