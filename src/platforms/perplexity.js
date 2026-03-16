var _platforms = (typeof _platforms !== 'undefined') ? _platforms : [];
_platforms.push({
  id: 'perplexity',
  name: 'Perplexity',
  hostPatterns: ['*://perplexity.ai/*', '*://www.perplexity.ai/*'],
  detect() {
    return !!DomUtils.querySafe(document, [
      '.chat-container',
      '[class*="ConversationMessages"]',
      'main [class*="ThreadMessage"]'
    ]);
  },
  extract() {
    var messages = [];
    var container = DomUtils.querySafe(document, ['.chat-container', 'main']);
    if (!container) return { messages: messages, chatTitle: document.title, model: '' };
    var els = DomUtils.querySafeAll(container, [
      '.message',
      '[class*="ThreadMessage"]',
      '[class*="Message"]'
    ]);
    for (var i = 0; i < els.length; i++) {
      messages.push(MessageSchema.create({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: (els[i].innerText || '').trim(),
        id: els[i].id || 'msg-' + i,
        platform: 'perplexity',
        index: i
      }));
    }
    return { messages: messages, chatTitle: document.title, model: '' };
  }
});
