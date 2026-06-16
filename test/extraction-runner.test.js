import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadRunner() {
  const module = { exports: {} };
  const code = [
    loadSrc('extraction/prompt.js'),
    loadSrc('extraction/candidates.js'),
    loadSrc('extraction/chunks.js'),
    loadSrc('extraction/runner.js')
  ].join('\n');
  const fn = new Function('module', 'exports', code);
  fn(module, module.exports);
  return module.exports;
}

function chat() {
  return {
    chatId: 'chat-1',
    platform: 'chatgpt',
    title: 'Extraction test'
  };
}

describe('ExtractionRunner', () => {
  it('runs candidate-window prompts and writes extracted open threads', async () => {
    const runner = loadRunner();
    const prompts = [];
    const written = [];
    const runs = [];
    const progress = [];
    const messages = [
      { messageId: 'm-1', role: 'user', content: 'Routine update.', index: 0 },
      { messageId: 'm-2', role: 'user', content: 'Can we confirm whether Firefox sync works?', index: 1 },
      { messageId: 'm-3', role: 'assistant', content: 'I can also add a zip fallback if you want.', index: 2 }
    ];
    const generator = async (prompt) => {
      prompts.push(prompt);
      return [{ generated_text: '[{"tag":"UNRESOLVED","text":"Confirm Firefox sync support","messageId":"m-2","confidence":0.82}]' }];
    };
    const dao = {
      listOpenThreads: async () => [],
      putOpenThreads: async (threads) => {
        written.push(...threads);
        return threads;
      },
      putExtractionRun: async (run) => {
        runs.push(run);
        return run;
      }
    };

    const result = await runner.runChatExtraction(chat(), messages, {
      generator,
      dao,
      modelName: 'test-model',
      modelVersion: 'q4-test',
      onProgress: (event) => progress.push(event.status)
    });

    expect(prompts).toHaveLength(1);
    expect(prompts[0][1].content).toContain('"messageId":"m-2"');
    expect(prompts[0][1].content).toContain('"messageId":"m-3"');
    expect(result.threadCount).toBe(1);
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      chatId: 'chat-1',
      messageId: 'm-2',
      tag: 'UNRESOLVED',
      text: 'Confirm Firefox sync support',
      source: 'extracted',
      subSource: 'llm',
      status: 'open',
      confidence: 0.82
    });
    expect(written[0].threadId).toMatch(/^extracted:chat-1:m-2:UNRESOLVED:/);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      chatId: 'chat-1',
      modelName: 'test-model',
      modelVersion: 'q4-test',
      threadCount: 1
    });
    expect(runs[0].runId).toMatch(/^extract:chat-1:/);
    expect(typeof runs[0].durationMs).toBe('number');
    expect(progress).toContain('chunk-processing');
    expect(progress).toContain('done');
  });

  it('skips model load and writes nothing when no candidate windows exist', async () => {
    const runner = loadRunner();
    let called = false;
    const runs = [];
    const result = await runner.runChatExtraction(chat(), [
      { messageId: 'm-1', role: 'user', content: 'Thanks, all set.', index: 0 }
    ], {
      generator: async () => {
        called = true;
        return '[]';
      },
      dao: {
        listOpenThreads: async () => [],
        putOpenThreads: async () => {
          throw new Error('should not write');
        },
        putExtractionRun: async (run) => {
          runs.push(run);
          return run;
        }
      }
    });

    expect(called).toBe(false);
    expect(result.threadCount).toBe(0);
    expect(result.windows).toEqual([]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ chatId: 'chat-1', threadCount: 0 });
  });

  it('forwards selected model options to the model loader', async () => {
    const runner = loadRunner();
    let captured = null;
    const modelLoader = {
      loadModel: async (modelId, options) => {
        captured = { modelId, options };
        return async () => '[]';
      }
    };

    await runner.runChatExtraction(chat(), [
      { messageId: 'm-1', role: 'user', content: 'Can we confirm model switching?', index: 0 }
    ], {
      modelLoader,
      modelId: 'onnx-community/Phi-3.5-mini-instruct-onnx-web',
      modelName: 'Phi-3.5-mini-Q4',
      modelVersion: 'q4f16',
      quantization: 'q4f16',
      backend: 'webgpu',
      useExternalDataFormat: true
    });

    expect(captured.modelId).toBe('onnx-community/Phi-3.5-mini-instruct-onnx-web');
    expect(captured.options).toMatchObject({
      quantization: 'q4f16',
      backend: 'webgpu',
      useExternalDataFormat: true
    });
    expect(typeof captured.options.onProgress).toBe('function');
  });
});
