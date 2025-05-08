class ChatExporter {
  static detectors = {
    chatgpt: () => document.querySelector('.group'),
    claude: () => document.querySelector('.flex.flex-col.items-center'),
    gemini: () => document.querySelector('.chat-container')
  };

  static extractors = {
    chatgpt: () => Array.from(document.querySelectorAll('.group')).map(el => ({
      role: el.querySelector('.dark\:bg-gray-800') ? 'user' : 'assistant',
      content: el.querySelector('.whitespace-pre-wrap').innerText,
      timestamp: el.querySelector('time')?.dateTime || new Date().toISOString()
    })),
    claude: () => { /* Claude-specific extraction */ },
    gemini: () => { /* Gemini-specific extraction */ }
  };

  static injectUI() {
    const btn = document.createElement('button');
    btn.id = 'rakuzaichi-export';
    btn.textContent = 'Export Chat';
    btn.addEventListener('click', this.showFormatSelector);
    document.body.appendChild(btn);
  }

  static async showFormatSelector() {
    const response = await fetch(chrome.runtime.getURL('formats.html'));
    const html = await response.text();
    const parser = new DOMParser();
    const formatDoc = parser.parseFromString(html, 'text/html');
    document.body.appendChild(formatDoc.querySelector('.format-selector'));
  }
}

Object.keys(ChatExporter.detectors).some(platform => {
  if (ChatExporter.detectors[platform]()) {
    ChatExporter.injectUI();
    return true;
  }
});