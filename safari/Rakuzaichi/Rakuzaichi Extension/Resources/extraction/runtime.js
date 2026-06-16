var ExtractionRuntime = (function() {
  var DEFAULT_TIMEOUT_MS = 45;
  var WASM_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  var ESTIMATED_TOK_SEC = {
    webgpu: 18,
    wasm: 2,
    unsupported: 0
  };

  function runtimeEnv(env) {
    env = env || {};
    var globalRef = typeof globalThis !== 'undefined' ? globalThis : {};
    return {
      navigator: env.navigator || globalRef.navigator || {},
      WebAssembly: Object.prototype.hasOwnProperty.call(env, 'WebAssembly') ? env.WebAssembly : globalRef.WebAssembly,
      setTimeout: env.setTimeout || globalRef.setTimeout || (typeof setTimeout === 'function' ? setTimeout : function(callback) { callback(); return 0; }),
      clearTimeout: env.clearTimeout || globalRef.clearTimeout || (typeof clearTimeout === 'function' ? clearTimeout : function() {})
    };
  }

  function result(backend) {
    return {
      backend: backend,
      estimatedTokSec: ESTIMATED_TOK_SEC[backend] || 0
    };
  }

  function hasWasm(env) {
    var wasm = env.WebAssembly;
    if (!wasm || typeof wasm.validate !== 'function') return false;
    try {
      return !!wasm.validate(WASM_PROBE);
    } catch (error) {
      return false;
    }
  }

  function timeoutPromise(env, timeoutMs) {
    return new Promise(function(resolve) {
      var timer = env.setTimeout(function() {
        resolve(null);
      }, timeoutMs);
      if (timer && timer.unref) timer.unref();
    });
  }

  async function getWebGPUAdapter(env, timeoutMs) {
    if (!env.navigator || !env.navigator.gpu || typeof env.navigator.gpu.requestAdapter !== 'function') return null;
    try {
      var request = Promise.resolve(env.navigator.gpu.requestAdapter());
      return await Promise.race([request, timeoutPromise(env, timeoutMs)]);
    } catch (error) {
      return null;
    }
  }

  async function detectRuntimeCapabilities(options) {
    options = options || {};
    var env = runtimeEnv(options.env);
    var timeoutMs = typeof options.timeoutMs === 'number' ? Math.max(0, options.timeoutMs) : DEFAULT_TIMEOUT_MS;
    var adapter = await getWebGPUAdapter(env, timeoutMs);
    if (adapter) return result('webgpu');
    if (hasWasm(env)) return result('wasm');
    return result('unsupported');
  }

  return {
    DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
    ESTIMATED_TOK_SEC: Object.assign({}, ESTIMATED_TOK_SEC),
    detectRuntimeCapabilities: detectRuntimeCapabilities,
    hasWasm: function(env) {
      return hasWasm(runtimeEnv(env));
    }
  };
})();

if (typeof module !== 'undefined') module.exports = ExtractionRuntime;
