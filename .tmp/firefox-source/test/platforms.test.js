import { describe, expect, it } from 'vitest';
import { runPlatformExtraction } from './helpers.js';

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
  }
];

describe('platform extractors', () => {
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
