var ExtractionModelLoader = (function() {
  var REQUESTED_QWEN_MODEL_ID = 'Qwen/Qwen2.5-0.5B-Instruct';
  var DEFAULT_MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
  var DEFAULT_TASK = 'text-generation';
  var DEFAULT_QUANTIZATION = 'q4';
  var DEFAULT_CACHE_KEY = 'rakuzaichi-transformers-cache';
  var RUNTIME_PATH = 'vendor/transformers/transformers.bundle.js';
  var WASM_MJS_PATH = 'vendor/transformers/ort-wasm-simd-threaded.jsep.mjs';
  var WASM_BINARY_PATH = 'vendor/transformers/ort-wasm-simd-threaded.jsep.wasm';
  var VALID_DTYPES = ['fp32', 'fp16', 'q8', 'int8', 'uint8', 'q4', 'bnb4', 'q4f16'];
  var MODEL_PRESETS = [
    {
      id: 'qwen2.5-0.5b-q4',
      label: 'Qwen2.5-0.5B-Instruct-Q4',
      modelId: REQUESTED_QWEN_MODEL_ID,
      quantization: 'q4'
    },
    {
      id: 'phi-3.5-mini-q4',
      label: 'Phi-3.5-mini-Q4',
      modelId: 'onnx-community/Phi-3.5-mini-instruct-onnx-web',
      quantization: 'q4f16',
      backend: 'webgpu',
      useExternalDataFormat: true
    },
    {
      id: 'gemma-3-1b-q4',
      label: 'Gemma-3-1B-Q4',
      modelId: 'onnx-community/gemma-3-1b-it-ONNX',
      quantization: 'q4'
    }
  ];
  var MODEL_ALIASES = {};
  var loadedPipelines = {};
  var transformersModulePromise = null;

  MODEL_ALIASES[REQUESTED_QWEN_MODEL_ID] = DEFAULT_MODEL_ID;
  MODEL_PRESETS.forEach(function(preset) {
    MODEL_ALIASES[preset.id] = preset.modelId;
  });

  function globalRef() {
    return typeof globalThis !== 'undefined' ? globalThis : {};
  }

  function runtimeApi(env) {
    env = env || {};
    var root = globalRef();
    return env.runtime ||
      (root.chrome && root.chrome.runtime) ||
      (root.browser && root.browser.runtime) ||
      null;
  }

  function resolveExtensionUrl(path, env) {
    env = env || {};
    if (env.resolveUrl) return env.resolveUrl(path);
    var runtime = runtimeApi(env);
    if (runtime && typeof runtime.getURL === 'function') return runtime.getURL(path);
    if (env.baseUrl) return new URL(path, env.baseUrl).href;
    if (typeof location !== 'undefined' && location.href) return new URL(path, location.href).href;
    return path;
  }

  function resolveModelId(modelId) {
    return MODEL_ALIASES[modelId] || modelId;
  }

  function modelPresets() {
    return MODEL_PRESETS.map(function(preset) {
      return Object.assign({}, preset);
    });
  }

  function modelPreset(id) {
    return modelPresets().filter(function(preset) {
      return preset.id === id;
    })[0] || modelPresets()[0];
  }

  function assertValidDtype(dtype) {
    if (VALID_DTYPES.indexOf(dtype) === -1) {
      throw new Error('Unsupported extraction model dtype: ' + dtype);
    }
  }

  function normalizeLoadRequest(modelId, options) {
    if (modelId && typeof modelId === 'object') {
      options = modelId;
      modelId = options.modelId;
    }
    options = options || {};
    var requestedModelId = modelId || options.modelId || REQUESTED_QWEN_MODEL_ID;
    var resolvedModelId = options.resolvedModelId || resolveModelId(requestedModelId);
    var dtype = options.dtype || options.quantization || DEFAULT_QUANTIZATION;
    assertValidDtype(dtype);
    var device = options.device || options.backend || null;
    if (device && ['webgpu', 'wasm'].indexOf(device) === -1) {
      throw new Error('Unsupported extraction runtime backend: ' + device);
    }
    return {
      task: options.task || DEFAULT_TASK,
      requestedModelId: requestedModelId,
      modelId: resolvedModelId,
      dtype: dtype,
      quantization: options.quantization || dtype,
      device: device,
      revision: options.revision || 'main',
      subfolder: options.subfolder || 'onnx',
      useExternalDataFormat: !!(options.use_external_data_format || options.useExternalDataFormat),
      localFilesOnly: !!options.local_files_only,
      cacheKey: options.cacheKey || DEFAULT_CACHE_KEY
    };
  }

  function configureTransformers(transformers, options) {
    options = options || {};
    if (!transformers || typeof transformers.pipeline !== 'function' || !transformers.env) {
      throw new Error('Transformers.js runtime did not expose pipeline/env');
    }
    var env = transformers.env;
    env.allowRemoteModels = options.allowRemoteModels !== false;
    env.allowLocalModels = false;
    env.useBrowserCache = options.useBrowserCache !== false;
    env.useWasmCache = options.useWasmCache !== false;
    env.cacheKey = options.cacheKey || DEFAULT_CACHE_KEY;
    env.backends = env.backends || {};
    env.backends.onnx = env.backends.onnx || {};
    env.backends.onnx.wasm = env.backends.onnx.wasm || {};
    env.backends.onnx.wasm.wasmPaths = {
      mjs: resolveExtensionUrl(WASM_MJS_PATH, options.env),
      wasm: resolveExtensionUrl(WASM_BINARY_PATH, options.env)
    };
    return {
      cacheKey: env.cacheKey,
      wasmPaths: env.backends.onnx.wasm.wasmPaths
    };
  }

  async function importTransformers(options) {
    options = options || {};
    if (options.transformersModule) return options.transformersModule;
    if (!transformersModulePromise) {
      var runtimeUrl = options.runtimeUrl || resolveExtensionUrl(RUNTIME_PATH, options.env);
      var importer = options.importModule || function(url) { return import(url); };
      transformersModulePromise = Promise.resolve(importer(runtimeUrl)).catch(function(error) {
        transformersModulePromise = null;
        throw error;
      });
    }
    return transformersModulePromise;
  }

  function emitProgress(callback, request, event) {
    if (typeof callback !== 'function') return;
    callback(Object.assign({}, event || {}, {
      modelId: request.modelId,
      requestedModelId: request.requestedModelId,
      dtype: request.dtype,
      quantization: request.quantization
    }));
  }

  function pipelineCacheKey(request) {
    return [
      request.task,
      request.modelId,
      request.dtype,
      request.device || 'auto',
      request.revision,
      request.localFilesOnly ? 'local' : 'remote'
    ].join('|');
  }

  async function startLoad(request, options) {
    emitProgress(options.onProgress, request, { status: 'loading-runtime' });
    var transformers = await importTransformers(options);
    configureTransformers(transformers, {
      env: options.env,
      cacheKey: request.cacheKey,
      allowRemoteModels: options.allowRemoteModels,
      useBrowserCache: options.useBrowserCache,
      useWasmCache: options.useWasmCache
    });
    emitProgress(options.onProgress, request, { status: 'runtime-ready' });
    var pipelineOptions = {
      dtype: request.dtype,
      revision: request.revision,
      subfolder: request.subfolder,
      local_files_only: request.localFilesOnly,
      progress_callback: function(event) {
        emitProgress(options.onProgress, request, event);
      }
    };
    if (request.device) pipelineOptions.device = request.device;
    if (request.useExternalDataFormat) pipelineOptions.use_external_data_format = true;
    var pipe = await transformers.pipeline(request.task, request.modelId, pipelineOptions);
    emitProgress(options.onProgress, request, { status: 'ready', task: request.task, model: request.modelId });
    return pipe;
  }

  function loadModel(modelId, options) {
    options = options || {};
    var request = normalizeLoadRequest(modelId, options);
    var key = pipelineCacheKey(request);
    if (!loadedPipelines[key]) {
      loadedPipelines[key] = startLoad(request, options).catch(function(error) {
        delete loadedPipelines[key];
        throw error;
      });
    }
    return loadedPipelines[key];
  }

  function clearLoadedModels() {
    loadedPipelines = {};
    transformersModulePromise = null;
  }

  return {
    REQUESTED_QWEN_MODEL_ID: REQUESTED_QWEN_MODEL_ID,
    DEFAULT_MODEL_ID: DEFAULT_MODEL_ID,
    DEFAULT_TASK: DEFAULT_TASK,
    DEFAULT_QUANTIZATION: DEFAULT_QUANTIZATION,
    DEFAULT_CACHE_KEY: DEFAULT_CACHE_KEY,
    paths: {
      runtime: RUNTIME_PATH,
      wasmMjs: WASM_MJS_PATH,
      wasmBinary: WASM_BINARY_PATH
    },
    resolveExtensionUrl: resolveExtensionUrl,
    resolveModelId: resolveModelId,
    modelPresets: modelPresets,
    modelPreset: modelPreset,
    normalizeLoadRequest: normalizeLoadRequest,
    configureTransformers: configureTransformers,
    importTransformers: importTransformers,
    loadModel: loadModel,
    clearLoadedModels: clearLoadedModels
  };
})();

if (typeof module !== 'undefined') module.exports = ExtractionModelLoader;
