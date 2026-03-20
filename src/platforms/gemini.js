var _platforms = (typeof _platforms !== 'undefined') ? _platforms : [];
_platforms.push({
  id: 'gemini',
  name: 'Gemini',
  hostPatterns: ['*://gemini.google.com/*'],
  detect() {
    return !!DomUtils.querySafe(document, [
      '#chat-history',
      'chat-history',
      '.conversation-container'
    ]);
  },
  extract() {
    var messages = [];
    var container = DomUtils.querySafe(document, ['#chat-history', 'chat-history']);
    if (!container) return { messages: messages, chatTitle: document.title, model: '' };
    var els = DomUtils.querySafeAll(container, [
      '.conversation-container',
      'message-content',
      '.query-content, .response-content'
    ]);
    for (var i = 0; i < els.length; i++) {
      messages.push(MessageSchema.create({
        role: DomUtils.inferRole(els[i], i % 2 === 0 ? 'user' : 'assistant'),
        content: DomUtils.readText(els[i]),
        id: DomUtils.buildMessageId('gemini', els[i], i),
        timestamp: DomUtils.readTimestamp(els[i]),
        platform: 'gemini',
        index: i
      }));
    }
    return { messages: messages, chatTitle: document.title, model: '' };
  }
});
