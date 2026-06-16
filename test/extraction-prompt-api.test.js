import { describe, expect, it, vi } from 'vitest';
import { loadSrc } from './helpers.js';

function loadBackend() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'window', loadSrc('extraction/prompt-api.js'));
  fn(module, module.exports, undefined);
  return module.exports;
}

describe('ExtractionPromptApiBackend', () => {
  it('reports unavailable when Chrome exposes no built-in Prompt API', async () => {
    const backend = loadBackend();

    await expect(backend.availability({ env: { root: {} } })).resolves.toMatchObject({
      modelId: 'gemini-nano-builtin',
      status: 'unavailable',
      available: false,
      api: 'none'
    });
  });

  it('detects current LanguageModel availability', async () => {
    const backend = loadBackend();
    const root = {
      LanguageModel: {
        availability: vi.fn(async () => 'available'),
        create: vi.fn()
      }
    };

    const status = await backend.availability({ env: { root } });

    expect(root.LanguageModel.availability).toHaveBeenCalledWith({});
    expect(status).toMatchObject({
      status: 'available',
      available: true,
      api: 'language-model'
    });
  });

  it('loads Gemini Nano through LanguageModel without Transformers.js', async () => {
    const backend = loadBackend();
    const prompts = [];
    const destroyed = vi.fn();
    const session = {
      prompt: vi.fn(async (prompt) => {
        prompts.push(prompt);
        return '[{"tag":"TODO","text":"Use built-in model","messageId":"m-1","confidence":0.7}]';
      }),
      destroy: destroyed
    };
    const root = {
      LanguageModel: {
        availability: vi.fn(async () => 'available'),
        create: vi.fn(async () => session)
      }
    };
    const progress = [];

    const generator = await backend.loadModel('gemini-nano-builtin', {
      env: { root },
      onProgress: (event) => progress.push(event)
    });
    const output = await generator([{ role: 'user', content: 'extract m-1' }], {});

    expect(root.LanguageModel.create).toHaveBeenCalledTimes(1);
    expect(prompts[0]).toEqual([{ role: 'user', content: 'extract m-1' }]);
    expect(output).toContain('Use built-in model');
    expect(destroyed).toHaveBeenCalledTimes(1);
    expect(progress[0]).toMatchObject({
      modelId: 'gemini-nano-builtin',
      status: 'builtin-ready',
      availability: 'available'
    });
  });

  it('normalizes legacy window.ai text-session availability', async () => {
    const backend = loadBackend();
    const root = {
      ai: {
        canCreateTextSession: vi.fn(async () => 'readily'),
        createTextSession: vi.fn()
      }
    };

    await expect(backend.availability({ env: { root } })).resolves.toMatchObject({
      status: 'available',
      available: true,
      api: 'window-ai'
    });
  });
});
