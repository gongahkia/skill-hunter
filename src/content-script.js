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

  static extractChatGPTMessages() {
    console.log('extracting chatgpt messages');
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
    console.log('extracting claude messages');
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
        template.content = el.innerText.trim();
        const url = window.location.href;
        template.id = url.replace('https://claude.ai/chat/', '');
        console.log(template);
        messageArray.push(template);
      });
    }
    console.log(messageArray);
    return messageArray;
  }

  static extractGeminiMessages() {
    console.log('extracting gemini messages');
    let messageArray = [];
    const chatElement = document.querySelector('#chat-history');
    if (chatElement != null) {
      const messages = chatElement.querySelectorAll('.conversation-container.message-actions-hover-boundary.tts-removed.ng-star-inserted');
      for (let i = 0; i < messages.length; i++) {
        const currentElement = messages[i];
        let template = {
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: currentElement.innerText?.trim() || '',
          id: '' | currentElement.id || `msg-${Date.now()}-${i}`
        };
        console.log(template);
        messageArray.push(template);
      }
    }
    console.log(messageArray);
    return messageArray;
  }

  static extractPerplexityMessages() {
    console.log('extracting perplexity messages');
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
        console.log(template);
        messageArray.push(template);
      }
    }
    console.log(messageArray);
    return messageArray;
  }

  static extractDeepSeekMessages() {
    console.log('extracting deepseek messages');
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
        console.log(template);
      }
    }
    console.log(messageArray);
    return messageArray;
  }

  static getCurrentPlatform() {
    return Object.keys(this.detectors).find(platform => 
      this.detectors[platform]()
    );
  }

}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractChat") {
    const platform = ChatExporter.getCurrentPlatform();
    if (!platform) {
      sendResponse({ error: "No supported chat platform detected" });
      return true;
    } else {
      console.log(`Detected platform: ${platform}`);
    }
    try {
      const messages = ChatExporter.extractors[platform]();
      console.log(messages);
      sendResponse({ data: messages, platform });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }
  return true; 
});