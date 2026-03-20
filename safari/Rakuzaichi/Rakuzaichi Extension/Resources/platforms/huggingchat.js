var _platforms = (typeof _platforms !== 'undefined') ? _platforms : [];
_platforms.push({
  id: 'huggingchat',
  name: 'HuggingChat',
  hostPatterns: ['*://huggingface.co/chat/*'],
  detect() {
    return !!DomUtils.querySafe(document, [
      '[class*="conversation"]',
      '.chat-message',
      '[class*="ChatMessage"]'
    ]);
  },
  extract() {
    var messages = [];
    var container = DomUtils.querySafe(document, [
      '[class*="conversation"]',
      'main',
      '.overflow-y-auto'
    ]);
    if (!container) return { messages: messages, chatTitle: document.title, model: '' };
    var els = DomUtils.querySafeAll(container, [
      '.chat-message',
      '[class*="ChatMessage"]',
      '[class*="message"]'
    ]);
    var modelEl = DomUtils.querySafe(document, [
      '[class*="model-name"]',
      '.model-selector span'
    ]);
    var model = modelEl ? modelEl.textContent.trim() : '';
    for (var i = 0; i < els.length; i++) {
      messages.push(MessageSchema.create({
        role: DomUtils.inferRole(els[i], i % 2 === 0 ? 'user' : 'assistant'),
        content: DomUtils.readText(els[i]),
        id: DomUtils.buildMessageId('huggingchat', els[i], i),
        timestamp: DomUtils.readTimestamp(els[i]),
        platform: 'huggingchat',
        model: model,
        index: i
      }));
    }
    return { messages: messages, chatTitle: document.title, model: model };
  }
});
