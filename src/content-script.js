class ChatExporter {
  static detectors = {
    chatgpt: () => document.querySelector('.group'),
    claude: () => document.querySelector('.flex.flex-col.items-center'),
    gemini: () => document.querySelector('.chat-container'),
    perplexity: () => document.querySelector('.chat-container'),
    deepseek: () => document.querySelector('.chat-container')
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
        template.role = index === 0 ? 'user' : 'assistant';
        template.content = el.innerText.trim();
        const url = window.location.href;
        template.id = url.replace('https://claude.ai/chat/', '');
        messageArray.push(template);
      });
    }
    return messageArray;
  }

  // Gemini Implementation
  // FUA to fix this logic
  static extractGeminiMessages() {
    const messages = [];
    const chatRows = document.querySelectorAll('.chat-container > div');
    
    chatRows.forEach(row => {
      const isUser = row.querySelector('div[data-role="user"]');
      const contentElement = isUser 
        ? row.querySelector('.user-message-content')
        : row.querySelector('.bot-response-content');
      
      messages.push({
        role: isUser ? 'user' : 'assistant',
        content: contentElement?.innerText?.trim() || '',
        timestamp: row.querySelector('time')?.dateTime || new Date().toISOString()
      });
    });
    
    return messages;
  }

  // Perplexity Implementation
  // FUA to fix this logic

  static extractPerplexityMessages() {
    const messages = [];
    const chatRows = document.querySelectorAll('.chat-container > div');
    
    chatRows.forEach(row => {
      const isUser = row.querySelector('div[data-role="user"]');
      const contentElement = isUser 
        ? row.querySelector('.user-message-content')
        : row.querySelector('.bot-response-content');
      
      messages.push({
        role: isUser ? 'user' : 'assistant',
        content: contentElement?.innerText?.trim() || '',
        timestamp: row.querySelector('time')?.dateTime || new Date().toISOString()
      });
    });
    
    return messages;
  }

  // DeepSeek Implementation
  // FUA to fix this logic

  static extractDeepSeekMessages() {
    const messages = [];
    const chatRows = document.querySelectorAll('.chat-container > div');
    
    chatRows.forEach(row => {
      const isUser = row.querySelector('div[data-role="user"]');
      const contentElement = isUser 
        ? row.querySelector('.user-message-content')
        : row.querySelector('.bot-response-content');
      
      messages.push({
        role: isUser ? 'user' : 'assistant',
        content: contentElement?.innerText?.trim() || '',
        timestamp: row.querySelector('time')?.dateTime || new Date().toISOString()
      });
    });
    
    return messages;
  }

}

Object.keys(ChatExporter.detectors).some(platform => {
  if (ChatExporter.detectors[platform]()) {
    ChatExporter.injectUI();
    return true;
  }
});

