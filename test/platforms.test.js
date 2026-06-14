import { describe, expect, it } from 'vitest';
import { evalSrc, runPlatformExtraction } from './helpers.js';

const scenarios = [
  {
    id: 'chatgpt',
    file: 'platforms/chatgpt.js',
    url: 'https://chatgpt.com/c/abc',
    fixtures: ['fixtures/platforms/chatgpt-primary.html', 'fixtures/platforms/chatgpt-variant.html'],
    expectedModel: 'GPT-4o'
  },
  {
    id: 'claude',
    file: 'platforms/claude.js',
    url: 'https://claude.ai/chat/abc',
    fixtures: ['fixtures/platforms/claude-primary.html', 'fixtures/platforms/claude-variant.html'],
    expectedModel: 'Claude Sonnet 4'
  },
  {
    id: 'gemini',
    file: 'platforms/gemini.js',
    url: 'https://gemini.google.com/app/abc',
    fixtures: ['fixtures/platforms/gemini-primary.html', 'fixtures/platforms/gemini-variant.html']
  },
  {
    id: 'perplexity',
    file: 'platforms/perplexity.js',
    url: 'https://www.perplexity.ai/search/example',
    fixtures: ['fixtures/platforms/perplexity-primary.html', 'fixtures/platforms/perplexity-variant.html']
  },
  {
    id: 'deepseek',
    file: 'platforms/deepseek.js',
    url: 'https://chat.deepseek.com/a/chat/some-id',
    fixtures: ['fixtures/platforms/deepseek-primary.html', 'fixtures/platforms/deepseek-variant.html'],
    expectedModel: 'DeepSeek V3'
  },
  {
    id: 'grok',
    file: 'platforms/grok.js',
    url: 'https://grok.com/chat/example',
    fixtures: ['fixtures/platforms/grok-primary.html', 'fixtures/platforms/grok-variant.html'],
    expectedModel: 'grok'
  },
  {
    id: 'copilot',
    file: 'platforms/copilot.js',
    url: 'https://copilot.microsoft.com/chats/example',
    fixtures: ['fixtures/platforms/copilot-primary.html', 'fixtures/platforms/copilot-variant.html'],
    expectedModel: 'copilot'
  },
  {
    id: 'mistral',
    file: 'platforms/mistral.js',
    url: 'https://chat.mistral.ai/chat/example',
    fixtures: ['fixtures/platforms/mistral-primary.html', 'fixtures/platforms/mistral-variant.html'],
    expectedModel: 'mistral'
  },
  {
    id: 'huggingchat',
    file: 'platforms/huggingchat.js',
    url: 'https://huggingface.co/chat/conversation/example',
    fixtures: ['fixtures/platforms/huggingchat-primary.html', 'fixtures/platforms/huggingchat-variant.html'],
    expectedModel: 'Mixtral 8x7B'
  },
  {
    id: 'poe',
    file: 'platforms/poe.js',
    url: 'https://poe.com/chat/thread-123',
    fixtures: ['fixtures/platforms/poe-primary.html', 'fixtures/platforms/poe-variant.html'],
    expectedModel: 'Assistant Bot'
  },
  {
    id: 'kimi',
    file: 'platforms/kimi.js',
    url: 'https://kimi.com/chat/thread-123',
    fixtures: ['fixtures/platforms/kimi-primary.html', 'fixtures/platforms/kimi-variant.html'],
    expectedModel: 'Kimi K2.6'
  },
  {
    id: 'qwen',
    file: 'platforms/qwen.js',
    url: 'https://chat.qwen.ai/c/thread-123',
    fixtures: ['fixtures/platforms/qwen-primary.html', 'fixtures/platforms/qwen-variant.html'],
    expectedModel: 'Qwen3-Max'
  },
  {
    id: 'chatglm',
    file: 'platforms/chatglm.js',
    url: 'https://chatglm.cn/main/thread-123',
    fixtures: ['fixtures/platforms/chatglm-primary.html', 'fixtures/platforms/chatglm-variant.html'],
    expectedModel: 'GLM-4.6'
  },
  {
    id: 'doubao',
    file: 'platforms/doubao.js',
    url: 'https://www.doubao.com/chat/thread-123',
    fixtures: ['fixtures/platforms/doubao-primary.html', 'fixtures/platforms/doubao-variant.html'],
    expectedModel: 'Doubao 1.5 Pro'
  },
  {
    id: 'notebooklm',
    file: 'platforms/notebooklm.js',
    url: 'https://notebooklm.google.com/notebook/thread-123',
    fixtures: ['fixtures/platforms/notebooklm-primary.html', 'fixtures/platforms/notebooklm-variant.html'],
    expectedModel: 'NotebookLM'
  }
];

describe('platform extractors', () => {
  it('registry exports 15 platform metadata entries', () => {
    const files = ['dom-utils.js', 'schema.js']
      .concat(scenarios.map((scenario) => scenario.file))
      .concat(['platforms/registry.js']);
    const { PlatformRegistry } = evalSrc(...files);

    expect(PlatformRegistry.entries).toHaveLength(15);
    for (const entry of PlatformRegistry.entries) {
      expect(entry.id).toBeTruthy();
      expect(entry.displayName).toBeTruthy();
      expect(entry.urlPatterns.length).toBeGreaterThan(0);
      expect(entry.adapterModule).toBe(`platforms/${entry.id}.js`);
    }
  });

  for (const scenario of scenarios) {
    for (const fixture of scenario.fixtures) {
      it(`${scenario.id} extracts messages from ${fixture}`, () => {
        const result = runPlatformExtraction({
          fixture,
          url: scenario.url,
          platformFiles: [scenario.file]
        });
        expect(result.detectedId).toBe(scenario.id);
        expect(result.extracted).toBeTruthy();
        expect(result.extracted.messages).toHaveLength(2);
        expect(result.extracted.messages[0].role).toBe('user');
        expect(result.extracted.messages[1].role).toBe('assistant');
        expect(result.extracted.messages[0].content.length).toBeGreaterThan(0);
        expect(result.extracted.messages[1].content.length).toBeGreaterThan(0);
        expect(result.extracted.messages[0].id).not.toBe(result.extracted.messages[1].id);
        if (scenario.expectedModel) {
          expect(result.extracted.model).toBe(scenario.expectedModel);
        }
      });
    }
  }
});
