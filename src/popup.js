document.querySelectorAll('.format-grid button').forEach(btn => {
  btn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const format = btn.getAttribute('data-format');
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-script.js']
    }, () => {
      chrome.tabs.sendMessage(tab.id, { action: "extractChat", format }, (response) => {
        if (chrome.runtime.lastError) {
          alert("Could not extract chat. Are you on a supported chat page?");
          return;
        } else {
          console.log(response.data);
          console.log(response.platform);
          chrome.runtime.sendMessage({
            action: "download",
            content: response.data,
            mime: response.mime,
            extension: format
          });
          // continue debugging port forwarding from here
        }
      });
    });
  });
});