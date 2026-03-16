var _platforms = (typeof _platforms !== 'undefined') ? _platforms : [];
_platforms.push({
  id: 'copilot',
  name: 'Copilot',
  hostPatterns: ['*://copilot.microsoft.com/*'],
  detect() {
    return !!DomUtils.querySafe(document, [
      'cib-serp',
      '[class*="copilot"]',
      '#b_sydConvCont'
    ]);
  },
  extract() {
    var messages = [];
    var els = DomUtils.queryShadow(document, ['cib-serp', 'cib-conversation'], 'cib-chat-turn'); // shadow DOM path
    if (!els.length) {
      var container = DomUtils.querySafe(document, [
        '#b_sydConvCont',
        '[class*="copilot"]',
        'main'
      ]);
      if (container) {
        els = DomUtils.querySafeAll(container, [
          '[class*="message"]',
          '[class*="turn"]'
        ]);
      }
    }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      messages.push(MessageSchema.create({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: (el.innerText || el.textContent || '').trim(),
        id: el.id || 'msg-' + i,
        platform: 'copilot',
        index: i
      }));
    }
    return { messages: messages, chatTitle: document.title, model: 'copilot' };
  }
});
