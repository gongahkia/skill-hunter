chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    const blob = new Blob([request.content], { type: request.mime });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: url,
      filename: `chat_export_${Date.now()}.${request.extension}`,
      saveAs: true
    });
  }
});