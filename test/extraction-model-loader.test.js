import { describe, expect, it, vi } from 'vitest';
import { loadSrc } from './helpers.js';

function loadLoader() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('extraction/model-loader.js'));
  fn(module, module.exports);
  return module.exports;
}

function fakeTransformers(pipelineImpl) {
  return {
    env: { backends: { onnx: { wasm: {} } } },
    pipeline: vi.fn(pipelineImpl || (async () => ({ ok: true })))
  };
}

function envStub() {
  return {
    runtime: {
      getURL(path) {
        return 'chrome-extension://ext/' + path;
      }
    }
  };
}

describe('ExtractionModelLoader', () => {
  it('exposes swappable extraction model presets', () => {
    const loader = loadLoader();
    const presets = loader.modelPresets();

    expect(presets.map((preset) => preset.id)).toEqual(['qwen2.5-0.5b-q4', 'phi-3.5-mini-q4', 'gemma-3-1b-q4']);
    expect(presets[0]).toMatchObject({
      label: 'Qwen2.5-0.5B-Instruct-Q4',
      modelId: 'Qwen/Qwen2.5-0.5B-Instruct',
      quantization: 'q4'
    });
    expect(loader.modelPreset('phi-3.5-mini-q4')).toMatchObject({
      modelId: 'onnx-community/Phi-3.5-mini-instruct-onnx-web',
      quantization: 'q4f16',
      backend: 'webgpu',
      useExternalDataFormat: true
    });
    expect(loader.modelPreset('missing').id).toBe('qwen2.5-0.5b-q4');
  });

  it('maps the Qwen source repo to the Transformers.js ONNX repo', () => {
    const loader = loadLoader();
    const request = loader.normalizeLoadRequest('Qwen/Qwen2.5-0.5B-Instruct', { quantization: 'q4', backend: 'wasm' });

    expect(request.requestedModelId).toBe('Qwen/Qwen2.5-0.5B-Instruct');
    expect(request.modelId).toBe('onnx-community/Qwen2.5-0.5B-Instruct');
    expect(request.dtype).toBe('q4');
    expect(request.device).toBe('wasm');
  });

  it('normalizes non-default model runtime options', () => {
    const loader = loadLoader();
    const request = loader.normalizeLoadRequest('phi-3.5-mini-q4', {
      quantization: 'q4f16',
      backend: 'webgpu',
      useExternalDataFormat: true
    });

    expect(request.requestedModelId).toBe('phi-3.5-mini-q4');
    expect(request.modelId).toBe('onnx-community/Phi-3.5-mini-instruct-onnx-web');
    expect(request.dtype).toBe('q4f16');
    expect(request.device).toBe('webgpu');
    expect(request.useExternalDataFormat).toBe(true);
  });

  it('configures packaged runtime files and forwards progress events', async () => {
    const loader = loadLoader();
    const events = [];
    const transformers = fakeTransformers(async (task, model, options) => {
      options.progress_callback({ status: 'progress_total', progress: 50, loaded: 5, total: 10 });
      return { task, model, options };
    });

    const pipe = await loader.loadModel('Qwen/Qwen2.5-0.5B-Instruct', {
      quantization: 'q4',
      backend: 'wasm',
      transformersModule: transformers,
      env: envStub(),
      onProgress(event) {
        events.push(event);
      }
    });

    expect(transformers.env.allowRemoteModels).toBe(true);
    expect(transformers.env.allowLocalModels).toBe(false);
    expect(transformers.env.useBrowserCache).toBe(true);
    expect(transformers.env.cacheKey).toBe('rakuzaichi-transformers-cache');
    expect(transformers.env.backends.onnx.wasm.wasmPaths).toEqual({
      mjs: 'chrome-extension://ext/vendor/transformers/ort-wasm-simd-threaded.jsep.mjs',
      wasm: 'chrome-extension://ext/vendor/transformers/ort-wasm-simd-threaded.jsep.wasm'
    });
    expect(transformers.pipeline).toHaveBeenCalledWith(
      'text-generation',
      'onnx-community/Qwen2.5-0.5B-Instruct',
      expect.objectContaining({
        dtype: 'q4',
        device: 'wasm',
        subfolder: 'onnx',
        local_files_only: false
      })
    );
    expect(pipe.model).toBe('onnx-community/Qwen2.5-0.5B-Instruct');
    expect(events.map((event) => event.status)).toEqual(['loading-runtime', 'runtime-ready', 'progress_total', 'ready']);
    expect(events[2]).toMatchObject({
      modelId: 'onnx-community/Qwen2.5-0.5B-Instruct',
      requestedModelId: 'Qwen/Qwen2.5-0.5B-Instruct',
      dtype: 'q4',
      progress: 50
    });
  });

  it('passes external data format flag to Transformers.js', async () => {
    const loader = loadLoader();
    const transformers = fakeTransformers(async (task, model, options) => ({ task, model, options }));

    await loader.loadModel('onnx-community/Phi-3.5-mini-instruct-onnx-web', {
      quantization: 'q4f16',
      backend: 'webgpu',
      useExternalDataFormat: true,
      transformersModule: transformers,
      env: envStub()
    });

    expect(transformers.pipeline).toHaveBeenCalledWith(
      'text-generation',
      'onnx-community/Phi-3.5-mini-instruct-onnx-web',
      expect.objectContaining({
        dtype: 'q4f16',
        device: 'webgpu',
        use_external_data_format: true
      })
    );
  });

  it('memoizes loaded pipelines by model/runtime key', async () => {
    const loader = loadLoader();
    const transformers = fakeTransformers(async () => ({ id: Math.random() }));

    const first = loader.loadModel('Qwen/Qwen2.5-0.5B-Instruct', {
      quantization: 'q4',
      backend: 'wasm',
      transformersModule: transformers,
      env: envStub()
    });
    const second = loader.loadModel('Qwen/Qwen2.5-0.5B-Instruct', {
      quantization: 'q4',
      backend: 'wasm',
      transformersModule: transformers,
      env: envStub()
    });
    const [a, b] = await Promise.all([first, second]);
    const c = await loader.loadModel('Qwen/Qwen2.5-0.5B-Instruct', {
      quantization: 'q4',
      backend: 'wasm',
      transformersModule: transformers,
      env: envStub()
    });

    expect(a).toBe(b);
    expect(c).toBe(a);
    expect(transformers.pipeline).toHaveBeenCalledTimes(1);
  });

  it('does not keep failed loads in the memoized cache', async () => {
    const loader = loadLoader();
    var calls = 0;
    const transformers = fakeTransformers(async () => {
      calls += 1;
      if (calls === 1) throw new Error('download failed');
      return { ok: true };
    });
    const options = {
      quantization: 'q4',
      backend: 'wasm',
      transformersModule: transformers,
      env: envStub()
    };

    await expect(loader.loadModel('Qwen/Qwen2.5-0.5B-Instruct', options)).rejects.toThrow('download failed');
    await expect(loader.loadModel('Qwen/Qwen2.5-0.5B-Instruct', options)).resolves.toEqual({ ok: true });
    expect(transformers.pipeline).toHaveBeenCalledTimes(2);
  });

  it('imports the packaged web runtime by extension URL', async () => {
    const loader = loadLoader();
    const transformers = fakeTransformers();
    const imported = await loader.importTransformers({
      env: envStub(),
      importModule: vi.fn(async (url) => {
        expect(url).toBe('chrome-extension://ext/vendor/transformers/transformers.bundle.js');
        return transformers;
      })
    });

    expect(imported).toBe(transformers);
  });
});
