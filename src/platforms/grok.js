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
      var role = el.getAttribute('data-role') || (i % 2 === 0 ? 'user' : 'assistant');
      messages.push(MessageSchema.create({
        role: role === 'assistant' || role === 'bot' ? 'assistant' : role === 'user' ? 'user' : 'unknown',
        content: (el.innerText || '').trim(),
        id: el.id || 'msg-' + i,
        platform: 'grok',
        model: 'grok',
        index: i
      }));
    }
    return { messages: messages, chatTitle: document.title, model: 'grok' };
  }
});
