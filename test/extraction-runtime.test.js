import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadRuntime() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('extraction/runtime.js'));
  fn(module, module.exports);
  return module.exports;
}

function timers() {
  return {
    setTimeout(callback) {
      callback();
      return 1;
    },
    clearTimeout() {}
  };
}

describe('ExtractionRuntime', () => {
  it('reports webgpu when a GPU adapter is available', async () => {
    const runtime = loadRuntime();
    const capabilities = await runtime.detectRuntimeCapabilities({
      env: {
        navigator: { gpu: { requestAdapter: async () => ({ name: 'test-adapter' }) } },
        WebAssembly
      }
    });

    expect(capabilities).toEqual({ backend: 'webgpu', estimatedTokSec: runtime.ESTIMATED_TOK_SEC.webgpu });
  });

  it('falls back to wasm when WebGPU is unavailable', async () => {
    const runtime = loadRuntime();
    const capabilities = await runtime.detectRuntimeCapabilities({
      env: {
        navigator: {},
        WebAssembly,
        ...timers()
      }
    });

    expect(capabilities).toEqual({ backend: 'wasm', estimatedTokSec: runtime.ESTIMATED_TOK_SEC.wasm });
  });

  it('returns unsupported without WebGPU or WASM', async () => {
    const runtime = loadRuntime();
    const capabilities = await runtime.detectRuntimeCapabilities({
      env: {
        navigator: {},
        WebAssembly: null,
        ...timers()
      }
    });

    expect(capabilities).toEqual({ backend: 'unsupported', estimatedTokSec: 0 });
  });

  it('falls back to wasm when WebGPU adapter detection times out', async () => {
    const runtime = loadRuntime();
    const capabilities = await runtime.detectRuntimeCapabilities({
      timeoutMs: 1,
      env: {
        navigator: { gpu: { requestAdapter: () => new Promise(() => {}) } },
        WebAssembly,
        ...timers()
      }
    });

    expect(capabilities.backend).toBe('wasm');
  });
});
