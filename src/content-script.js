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

  // ChatGPT Implementation
  // FUA to fix this logic
  static extractChatGPTMessages() {
    return Array.from(document.querySelectorAll('.group')).map(el => {
      const isUser = !!el.querySelector('.dark\\:bg-gray-800');
      const contentElement = el.querySelector('.whitespace-pre-wrap');
      const timeElement = el.querySelector('time');
      return {
        role: isUser ? 'user' : 'assistant',
        content: contentElement?.innerText?.trim() || '',
        timestamp: timeElement?.dateTime || new Date().toISOString()
      };
    });
  }

  // Claude Implementation
  // FUA to fix this logic
  static extractClaudeMessages() {
    const messages = [];
    const messageContainers = document.querySelectorAll('.flex.flex-col.items-center > div:not(:first-child)');
    
    messageContainers.forEach(container => {
      const isUser = !!container.querySelector('img[alt*="User"]');
      const contentElement = container.querySelector('.whitespace-pre-wrap');
      const timeElement = container.querySelector('time');
      
      messages.push({
        role: isUser ? 'user' : 'assistant',
        content: contentElement?.innerText?.trim() || '',
        timestamp: timeElement?.dateTime || new Date().toISOString()
      });
    });
    
    return messages;
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

