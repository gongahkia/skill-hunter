api.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'extractChat') {
    try {
      var platform = PlatformRegistry.detect();
      if (!platform) {
        sendResponse({ error: 'No supported chat platform detected' });
        return true;
      }
      var result = platform.extract();
      var envelope = {
        exportVersion: '2.0',
        exportedAt: new Date().toISOString(),
        platform: platform.id,
        chatTitle: result.chatTitle || document.title,
        model: result.model || '',
        messageCount: result.messages.length,
        messages: result.messages
      };
      sendResponse({ data: envelope, platform: platform.id });
    } catch(e) {
      sendResponse({ error: e.message });
    }
    return true;
  }
});
