document.querySelectorAll('button[data-format]').forEach(button => {
  button.addEventListener('click', async () => {
    const format = button.dataset.format;
    try {
      const [tab] = await chrome.tabs.query({ 
        active: true, 
        currentWindow: true 
      });
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: "extractChat" 
      });
      if (!response) {
        throw new Error('No response from content script');
      }
      if (response.error) {
        throw new Error(response.error);
      }
      chrome.runtime.sendMessage({
        action: "convertAndDownload",
        format,
        data: response.data
      });
    } catch (error) {
      alert(`Export failed: ${error.message}`);
      console.error('Export error:', error);
    }
  });
});