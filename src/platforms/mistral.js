var _platforms = (typeof _platforms !== 'undefined') ? _platforms : [];
_platforms.push({
  id: 'mistral',
  name: 'Mistral Le Chat',
  hostPatterns: ['*://chat.mistral.ai/*'],
  detect() {
    return !!DomUtils.querySafe(document, [
      '[class*="conversation"]',
      '[class*="ChatMessage"]',
      'main [class*="message"]'
    ]);
  },
  extract() {
    var messages = [];
    var container = DomUtils.querySafe(document, [
      '[class*="conversation"]',
      'main'
    ]);
    if (!container) return { messages: messages, chatTitle: document.title, model: 'mistral' };
    var els = DomUtils.querySafeAll(container, [
      '[class*="ChatMessage"]',
      '[class*="message"]',
      '[data-role]'
    ]);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var role = DomUtils.normalizeRole(el.getAttribute('data-role'), DomUtils.inferRole(el, i % 2 === 0 ? 'user' : 'assistant'));
      messages.push(MessageSchema.create({
        role: role,
        content: DomUtils.readText(el),
        id: DomUtils.buildMessageId('mistral', el, i),
        timestamp: DomUtils.readTimestamp(el),
        platform: 'mistral',
        model: 'mistral',
        index: i
      }));
    }
    return { messages: messages, chatTitle: document.title, model: 'mistral' };
  }
});
