var _platforms = (typeof _platforms !== 'undefined') ? _platforms : [];
_platforms.push({
  id: 'claude',
  name: 'Claude',
  hostPatterns: ['*://claude.ai/*'],
  detect() {
    return !!DomUtils.querySafe(document, [
      '.flex-1.flex.flex-col.gap-3.px-4.max-w-3xl.mx-auto.w-full.pt-1',
      '[data-test-render-count]',
      '.font-claude-message'
    ]);
  },
  extract() {
    var messages = [];
    var container = DomUtils.querySafe(document, [
      '.flex-1.flex.flex-col.gap-3.px-4.max-w-3xl.mx-auto.w-full.pt-1',
      'main .mx-auto'
    ]);
    if (!container) return { messages: messages, chatTitle: document.title, model: '' };
    var els = DomUtils.querySafeAll(container, [
      '[data-test-render-count]',
      '.font-claude-message'
    ]);
    var modelEl = DomUtils.querySafe(document, [
      '[data-testid="model-selector"] span',
      'button[class*="model"] span',
      '.text-text-500'
    ]);
    var model = modelEl ? modelEl.textContent.trim() : '';
    var chatId = window.location.href.replace('https://claude.ai/chat/', '');
    for (var i = 0; i < els.length; i++) {
      messages.push(MessageSchema.create({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: els[i].innerText.trim(),
        id: chatId,
        platform: 'claude',
        model: model,
        index: i
      }));
    }
    return { messages: messages, chatTitle: document.title, model: model };
  }
});
