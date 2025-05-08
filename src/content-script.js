class ChatExporter {
  static detectors = {
    chatgpt: () => document.querySelector('.flex.basis-auto.flex-col'),
    claude: () => document.querySelector('.flex-1.flex.flex-col.gap-3.px-4.max-w-3xl.mx-auto.w-full.pt-1'),
    gemini: () => document.querySelector('#chat-history'),
    perplexity: () => document.querySelector('.chat-container'),
    deepseek: () => document.querySelector('.chat-container.divider')
  };

  static extractors = {
    chatgpt: () => this.extractChatGPTMessages(),
    claude: () => this.extractClaudeMessages(),
    gemini: () => this.extractGeminiMessages(),
    perplexity: () => this.extractPerplexityMessages(),
    deepseek: () => this.extractDeepSeekMessages()
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

  static extractChatGPTMessages() {
    let messageArray = [];
    const chatElement = document.querySelector('.flex.basis-auto.flex-col');
    if (chatElement != null) {
      const messagesArray = chatElement.querySelectorAll('.min-h-8.text-message.relative.flex.w-full.flex-col.items-end');
      for (let i = 0; i < messagesArray.length; i++) {
        const currentElement = messagesArray[i];
        let template = {
          role: '',
          content: '',
          id: ''
        };
        const roleAttribute = currentElement.getAttribute('data-message-author-role');
        template.role = roleAttribute === 'assistant' ? 'assistant' 
                      : roleAttribute === 'user' ? 'user' 
                      : 'unknown';
        template.content = currentElement.innerText.trim();
        template.id = currentElement.getAttribute('data-message-id') || '';
        messageArray.push(template);
      }
    }
    return messageArray;
  }

  static extractClaudeMessages() {
    let messageArray = [];
    const chatElement = document.querySelector('.flex-1.flex.flex-col.gap-3.px-4.max-w-3xl.mx-auto.w-full.pt-1');
    if (chatElement != null) {
      const elements = chatElement.querySelectorAll('[data-test-render-count="1"]');
      elements.forEach((el, index) => {
        let template = {
          role: '',
          content: '',
          id: ''
        };
        template.role = index % 2 === 0 ? 'user' : 'assistant';
        template.content = innerText.trim();
        const url = window.location.href;
        template.id = url.replace('https://claude.ai/chat/', '');
        messageArray.push(template);
      });
    }
    return messageArray;
  }

  static extractGeminiMessages() {
    let messageArray = [];
    const chatElement = document.querySelector('#chat-history');
    if (chatElement != null) {
      const messages = chatElement.querySelectorAll('.conversation-container.message-actions-hover-boundary.tts-removed.ng-star-inserted');
      for (let i = 0; i < messages.length; i++) {
        const currentElement = messages[i];
        let template = {
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: currentElement.innerText?.trim() || '',
          id: currentElement.id || `msg-${Date.now()}-${i}`
        };
        messageArray.push(template);
      }
    }
    return messageArray;
  }

  static extractPerplexityMessages() {
    const messageArray = [];
    const chatElement = document.querySelector('.chat-container');
    if (chatElement != null) {
      const messages = chatElement.querySelectorAll('.message');
      for (let i = 0; i < messages.length; i++) {
        const currentElement = messages[i];
        let template = {
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: currentElement.innerText?.trim() || '',
          id: currentElement.id || `msg-${Date.now()}-${i}`
        };
        messageArray.push(template);
      }
    }
    return messageArray;
  }

  static extractDeepSeekMessages() {
    const messageArray = [];
    const chatElement = document.querySelector('.chat-container.divider');
    if (chatElement != null) {
      const messages = chatElement.querySelectorAll('.message');
      for (let i = 0; i < messages.length; i++) {
        const currentElement = messages[i];
        let template = {
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: currentElement.innerText?.trim() || '',
          id: currentElement.id || `msg-${Date.now()}-${i}`
        };
        messageArray.push(template);
      }
    }
    return messageArray;
  }

}

Object.keys(ChatExporter.detectors).some(platform => {
  if (ChatExporter.detectors[platform]()) {
    ChatExporter.injectUI();
    return true;
  }
});

