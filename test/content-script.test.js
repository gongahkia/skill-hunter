import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadFixture, loadSrc } from './helpers.js';

const existingPlatforms = [
  { id: 'chatgpt', file: 'platforms/chatgpt.js', fixture: 'fixtures/platforms/chatgpt-primary.html', url: 'https://chatgpt.com/c/thread-123' },
  { id: 'claude', file: 'platforms/claude.js', fixture: 'fixtures/platforms/claude-primary.html', url: 'https://claude.ai/chat/thread-123' },
  { id: 'gemini', file: 'platforms/gemini.js', fixture: 'fixtures/platforms/gemini-primary.html', url: 'https://gemini.google.com/app/thread-123' },
  { id: 'perplexity', file: 'platforms/perplexity.js', fixture: 'fixtures/platforms/perplexity-primary.html', url: 'https://www.perplexity.ai/search/thread-123' },
  { id: 'deepseek', file: 'platforms/deepseek.js', fixture: 'fixtures/platforms/deepseek-primary.html', url: 'https://chat.deepseek.com/a/chat/thread-123' },
  { id: 'grok', file: 'platforms/grok.js', fixture: 'fixtures/platforms/grok-primary.html', url: 'https://grok.com/chat/thread-123' },
  { id: 'copilot', file: 'platforms/copilot.js', fixture: 'fixtures/platforms/copilot-primary.html', url: 'https://copilot.microsoft.com/chats/thread-123' },
  { id: 'mistral', file: 'platforms/mistral.js', fixture: 'fixtures/platforms/mistral-primary.html', url: 'https://chat.mistral.ai/chat/thread-123' },
  { id: 'huggingchat', file: 'platforms/huggingchat.js', fixture: 'fixtures/platforms/huggingchat-primary.html', url: 'https://huggingface.co/chat/conversation/thread-123' },
  { id: 'poe', file: 'platforms/poe.js', fixture: 'fixtures/platforms/poe-primary.html', url: 'https://poe.com/chat/thread-123' },
  { id: 'kimi', file: 'platforms/kimi.js', fixture: 'fixtures/platforms/kimi-primary.html', url: 'https://kimi.com/chat/thread-123' }
];

function runContentAction({ fixture, url, platformFiles, action }) {
  const dom = new JSDOM(loadFixture(fixture), { url });
  if (!Object.getOwnPropertyDescriptor(dom.window.HTMLElement.prototype, 'innerText')) {
    Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', {
      configurable: true,
      get() {
        return this.textContent;
      }
    });
  }

  const listeners = [];
  const apiStub = {
    runtime: {
      onMessage: {
        addListener(listener) {
          listeners.push(listener);
        }
      }
    }
  };

  let code = 'var browser = undefined;\nvar chrome = undefined;\nvar api = this._api;\nvar module = undefined;\n';
  const files = ['dom-utils.js', 'schema.js'].concat(platformFiles).concat(['platforms/registry.js', 'content-script.js']);
  for (const file of files) code += loadSrc(file) + '\n';
  const fn = new Function('window', 'document', code);
  fn.call({ _api: apiStub }, dom.window, dom.window.document);

  let response = null;
  const handled = listeners[0]({ action, traceId: 'trace-1' }, {}, (payload) => {
    response = payload;
  });

  return { handled, response };
}

describe('content script chat snapshots', () => {
  it.each(existingPlatforms)('extracts a normalized snapshot for $id', (scenario) => {
    const result = runContentAction({
      fixture: scenario.fixture,
      url: scenario.url,
      platformFiles: [scenario.file],
      action: 'extractChatSnapshot'
    });

    expect(result.handled).toBe(true);
    expect(result.response.error).toBeUndefined();
    expect(result.response.data.chatId).toBe(`${scenario.id}:thread-123`);
    expect(result.response.data.platform).toBe(scenario.id);
    expect(result.response.data.messages).toHaveLength(2);
    expect(result.response.data.messages[0].chatId).toBe(result.response.data.chatId);
  });

  it('extracts a normalized snapshot with stable chat and message ids', () => {
    const first = runContentAction({
      fixture: 'fixtures/platforms/chatgpt-primary.html',
      url: 'https://chatgpt.com/c/thread-123',
      platformFiles: ['platforms/chatgpt.js'],
      action: 'extractChatSnapshot'
    });
    const second = runContentAction({
      fixture: 'fixtures/platforms/chatgpt-primary.html',
      url: 'https://chatgpt.com/c/thread-123',
      platformFiles: ['platforms/chatgpt.js'],
      action: 'extractChatSnapshot'
    });

    expect(first.handled).toBe(true);
    expect(first.response.error).toBeUndefined();
    expect(first.response.data.chatId).toBe('chatgpt:thread-123');
    expect(second.response.data.chatId).toBe(first.response.data.chatId);
    expect(first.response.data.platform).toBe('chatgpt');
    expect(first.response.data.messageCount).toBe(2);
    expect(first.response.data.messages[0]).toMatchObject({
      chatId: 'chatgpt:thread-123',
      platform: 'chatgpt',
      index: 0
    });
    expect(first.response.data.messages[0].messageId).toBeTruthy();
  });

  it('keeps extractChat envelope compatibility while returning the snapshot', () => {
    const result = runContentAction({
      fixture: 'fixtures/platforms/claude-primary.html',
      url: 'https://claude.ai/chat/claude-thread',
      platformFiles: ['platforms/claude.js'],
      action: 'extractChat'
    });

    expect(result.handled).toBe(true);
    expect(result.response.error).toBeUndefined();
    expect(result.response.data.platform).toBe('claude');
    expect(result.response.data.chatTitle).toBeTruthy();
    expect(result.response.data.messages).toHaveLength(2);
    expect(result.response.snapshot.chatId).toBe('claude:claude-thread');
  });
});
