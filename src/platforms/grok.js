var _platforms = (typeof _platforms !== 'undefined') ? _platforms : [];
_platforms.push({
  id: 'grok',
  name: 'Grok',
  hostPatterns: ['*://grok.com/*'],
  detect() {
    return !!DomUtils.querySafe(document, [
      '[class*="conversation"]',
      '[class*="chat-messages"]',
      'main [role="log"]'
    ]);
  },
  extract() {
    var messages = [];
    var container = DomUtils.querySafe(document, [
      '[class*="conversation"]',
      '[class*="chat-messages"]',
      'main'
    ]);
    if (!container) return { messages: messages, chatTitle: document.title, model: 'grok' };
    var els = DomUtils.querySafeAll(container, [
      '[class*="message"]',
      '[data-role]',
      '[class*="MessageContent"]'
    ]);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var role = DomUtils.normalizeRole(el.getAttribute('data-role'), DomUtils.inferRole(el, i % 2 === 0 ? 'user' : 'assistant'));
      messages.push(MessageSchema.create({
        role: role,
        content: DomUtils.readText(el),
        id: DomUtils.buildMessageId('grok', el, i),
        timestamp: DomUtils.readTimestamp(el),
        platform: 'grok',
        model: 'grok',
        index: i
      }));
    }
    return { messages: messages, chatTitle: document.title, model: 'grok' };
  }
});
