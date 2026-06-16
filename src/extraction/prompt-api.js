var ExtractionPromptApiBackend = (function() {
  var MODEL_ID = 'gemini-nano-builtin';
  var MODEL_LABEL = 'Chrome Gemini Nano (built-in)';
  var AVAILABLE = 'available';
  var UNAVAILABLE = 'unavailable';

  function rootRef(env) {
    env = env || {};
    if (env.root) return env.root;
    if (typeof window !== 'undefined') return window;
    return typeof globalThis !== 'undefined' ? globalThis : {};
  }

  function resolveApi(env) {
    var root = rootRef(env);
    if (root.LanguageModel && typeof root.LanguageModel.create === 'function') {
      return { type: 'language-model', api: root.LanguageModel };
    }
    if (root.ai && root.ai.languageModel && typeof root.ai.languageModel.create === 'function') {
      return { type: 'language-model', api: root.ai.languageModel };
    }
    if (root.ai && typeof root.ai.createTextSession === 'function') {
      return { type: 'window-ai', api: root.ai };
    }
    return null;
  }

  function normalizeAvailability(value) {
    if (value === true || value === AVAILABLE || value === 'readily') return AVAILABLE;
    if (value === 'downloadable' || value === 'after-download') return 'downloadable';
    if (value === 'downloading') return 'downloading';
    return UNAVAILABLE;
  }

  function modelPreset() {
    return {
      id: MODEL_ID,
      label: MODEL_LABEL,
      modelId: MODEL_ID,
      modelName: MODEL_ID,
      modelVersion: 'builtin',
      backendType: 'prompt-api'
    };
  }

  async function availability(options) {
    options = options || {};
    var resolved = resolveApi(options.env);
    if (!resolved) return { modelId: MODEL_ID, status: UNAVAILABLE, available: false, api: 'none' };
    var status = AVAILABLE;
    if (resolved.type === 'language-model' && typeof resolved.api.availability === 'function') {
      status = normalizeAvailability(await resolved.api.availability(options.availabilityOptions || {}));
    } else if (resolved.type === 'window-ai' && typeof resolved.api.canCreateTextSession === 'function') {
      status = normalizeAvailability(await resolved.api.canCreateTextSession());
    }
    return {
      modelId: MODEL_ID,
      status: status,
      available: status === AVAILABLE,
      api: resolved.type
    };
  }

  function emitProgress(callback, event) {
    if (typeof callback === 'function') {
      callback(Object.assign({ modelId: MODEL_ID, requestedModelId: MODEL_ID }, event || {}));
    }
  }

  function createOptions(options) {
    options = options || {};
    var create = {};
    if (options.signal) create.signal = options.signal;
    create.monitor = function(monitor) {
      if (!monitor || typeof monitor.addEventListener !== 'function') return;
      monitor.addEventListener('downloadprogress', function(event) {
        emitProgress(options.onProgress, {
          status: 'downloadprogress',
          loaded: event.loaded,
          total: event.total,
          progress: event.total ? event.loaded / event.total : event.loaded
        });
      });
    };
    return create;
  }

  async function createSession(resolved, options) {
    if (resolved.type === 'language-model') return resolved.api.create(createOptions(options));
    return resolved.api.createTextSession(createOptions(options));
  }

  function promptText(prompt) {
    if (!Array.isArray(prompt)) return String(prompt || '');
    return prompt.map(function(message) {
      return String(message.role || 'user').toUpperCase() + ':\n' + String(message.content || '');
    }).join('\n\n');
  }

  async function promptSession(session, prompt, options, resolved) {
    if (!session || typeof session.prompt !== 'function') throw new Error('Chrome Prompt API session is unavailable');
    var input = resolved.type === 'window-ai' ? promptText(prompt) : prompt;
    return session.prompt(input, options && options.promptOptions ? options.promptOptions : undefined);
  }

  async function loadModel(modelId, options) {
    options = options || {};
    if ((modelId || MODEL_ID) !== MODEL_ID) throw new Error('Unsupported Prompt API model: ' + modelId);
    var resolved = resolveApi(options.env);
    if (!resolved) throw new Error('Chrome Prompt API is unavailable');
    var state = await availability(options);
    if (state.status === UNAVAILABLE) throw new Error('Chrome Prompt API model is unavailable');
    emitProgress(options.onProgress, { status: 'builtin-ready', api: state.api, availability: state.status });
    return async function(prompt, generationOptions) {
      var session = await createSession(resolved, options);
      try {
        return await promptSession(session, prompt, { promptOptions: options.promptOptions, generationOptions: generationOptions }, resolved);
      } finally {
        if (session && typeof session.destroy === 'function') session.destroy();
      }
    };
  }

  return {
    MODEL_ID: MODEL_ID,
    MODEL_LABEL: MODEL_LABEL,
    modelPreset: modelPreset,
    resolveApi: resolveApi,
    availability: availability,
    loadModel: loadModel
  };
})();

if (typeof module !== 'undefined') module.exports = ExtractionPromptApiBackend;
