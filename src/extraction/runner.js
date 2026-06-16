var ExtractionRunner = (function() {
  var DEFAULT_MODEL_ID = 'Qwen/Qwen2.5-0.5B-Instruct';
  var DEFAULT_GENERATION_OPTIONS = {
    max_new_tokens: 192,
    do_sample: false,
    return_full_text: false
  };

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function idPart(value) {
    return text(value).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'unknown';
  }

  function stableHash(value) {
    var hash = 5381;
    value = text(value);
    for (var i = 0; i < value.length; i++) {
      hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  function now() {
    return Date.now();
  }

  function isoNow() {
    return new Date().toISOString();
  }

  function emit(callback, event) {
    if (typeof callback === 'function') callback(event);
  }

  function signalAborted(signal) {
    return !!(signal && signal.aborted);
  }

  function isAbortError(error) {
    return !!(error && (error.name === 'AbortError' || error.code === 'ABORT_ERR'));
  }

  function requireDependency(value, name) {
    if (!value) throw new Error(name + ' is unavailable');
    return value;
  }

  function dependencySet(options) {
    options = options || {};
    return {
      modelLoader: options.modelLoader || (typeof ExtractionModelLoader !== 'undefined' ? ExtractionModelLoader : null),
      prompt: options.prompt || (typeof ExtractionPrompt !== 'undefined' ? ExtractionPrompt : null),
      candidates: options.candidates || (typeof ExtractionCandidateFilter !== 'undefined' ? ExtractionCandidateFilter : null),
      chunker: options.chunker || (typeof ExtractionChunker !== 'undefined' ? ExtractionChunker : null)
    };
  }

  function buildWindows(messages, deps, options) {
    var candidates = requireDependency(deps.candidates, 'Extraction candidate filter');
    var chunker = requireDependency(deps.chunker, 'Extraction chunker');
    var candidateWindows = candidates.buildCandidateWindows(messages, {
      contextRadius: options.contextRadius
    });
    var windows = [];
    candidateWindows.forEach(function(candidateWindow) {
      chunker.buildSlidingWindows(candidateWindow.messages, {
        windowSize: options.windowSize,
        overlap: options.overlap
      }).forEach(function(chunk) {
        windows.push(Object.assign({}, chunk, {
          id: candidateWindow.id + ':' + chunk.id,
          candidateMessageIds: candidateWindow.candidateMessageIds,
          candidates: candidateWindow.candidates
        }));
      });
    });
    return windows;
  }

  function generationOptions(options) {
    return Object.assign({}, DEFAULT_GENERATION_OPTIONS, options.generationOptions || {});
  }

  function generatedText(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return generatedText(value[value.length - 1]);
    if (value.generated_text !== undefined) return generatedText(value.generated_text);
    if (value.content !== undefined) return text(value.content);
    if (value.message && value.message.content !== undefined) return text(value.message.content);
    return text(value);
  }

  async function runGenerator(generator, prompt, options) {
    if (typeof generator !== 'function') throw new Error('Extraction generator is unavailable');
    return generatedText(await generator(prompt, generationOptions(options)));
  }

  function allowedMessageIds(messages) {
    return messages.map(function(message) {
      return text(message.messageId || message.id);
    }).filter(Boolean);
  }

  function makeThread(chat, row, createdAt) {
    var body = text(row.text).replace(/\s+/g, ' ').trim();
    var messageId = text(row.messageId).trim();
    return {
      threadId: ['extracted', idPart(chat.chatId), idPart(messageId), row.tag, stableHash(body)].join(':'),
      chatId: chat.chatId,
      messageId: messageId,
      tag: row.tag,
      text: body,
      source: 'extracted',
      subSource: 'llm',
      status: 'open',
      confidence: row.confidence,
      createdAt: createdAt
    };
  }

  function existingThreadKeys(threads) {
    return (Array.isArray(threads) ? threads : []).reduce(function(keys, thread) {
      keys[[thread.messageId || '', thread.tag || '', text(thread.text).replace(/\s+/g, ' ').trim()].join('\n')] = true;
      return keys;
    }, {});
  }

  function filterExistingThreads(threads, existing) {
    var keys = existingThreadKeys(existing);
    return threads.filter(function(thread) {
      var key = [thread.messageId || '', thread.tag || '', text(thread.text).replace(/\s+/g, ' ').trim()].join('\n');
      if (keys[key]) return false;
      keys[key] = true;
      return true;
    });
  }

  function modelName(options) {
    return options.modelName || options.modelId || DEFAULT_MODEL_ID;
  }

  function modelVersion(options) {
    return options.modelVersion || options.quantization || 'q4';
  }

  async function loadGenerator(deps, options, onProgress) {
    if (options.generator) return options.generator;
    var loader = requireDependency(deps.modelLoader, 'Extraction model loader');
    var loadModel = options.loadModel || loader.loadModel;
    if (typeof loadModel !== 'function') throw new Error('Extraction model loader is unavailable');
    emit(onProgress, { status: 'model-load' });
    return loadModel(options.modelId || DEFAULT_MODEL_ID, {
      task: options.task,
      quantization: options.quantization || 'q4',
      backend: options.backend,
      useExternalDataFormat: options.useExternalDataFormat,
      signal: options.signal,
      onProgress: function(event) {
        emit(onProgress, { status: 'model-progress', event: event });
      }
    });
  }

  async function runChatExtraction(chat, messages, options) {
    options = options || {};
    if (!chat || !chat.chatId) throw new Error('chatId is required');
    messages = Array.isArray(messages) ? messages : [];
    var deps = dependencySet(options);
    var prompt = requireDependency(deps.prompt, 'Extraction prompt');
    var chunker = requireDependency(deps.chunker, 'Extraction chunker');
    var startedAt = now();
    var createdAt = isoNow();
    var onProgress = options.onProgress;
    var signal = options.signal || null;
    var windows = buildWindows(messages, deps, options);
    var generator = null;
    var rawThreads = [];
    var savedThreads = [];
    var existingThreads = null;
    var cancelled = signalAborted(signal);

    async function existingRows() {
      if (existingThreads !== null) return existingThreads;
      if (options.dao && typeof options.dao.listOpenThreads === 'function') {
        existingThreads = await options.dao.listOpenThreads({ chatId: chat.chatId });
      } else {
        existingThreads = [];
      }
      return existingThreads;
    }

    async function persistDiscoveredThreads() {
      var deduped = chunker.dedupeThreads(rawThreads);
      if (!options.dao || typeof options.dao.putOpenThreads !== 'function') {
        if (options.dao && typeof options.dao.listOpenThreads === 'function') {
          return filterExistingThreads(deduped, await existingRows());
        }
        return deduped;
      }
      var pending = filterExistingThreads(deduped, (await existingRows()).concat(savedThreads));
      if (pending.length) {
        await options.dao.putOpenThreads(pending);
        savedThreads = savedThreads.concat(pending);
      }
      return savedThreads.slice();
    }

    if (windows.length && !cancelled) generator = await loadGenerator(deps, options, onProgress);
    for (var i = 0; i < windows.length; i++) {
      if (signalAborted(signal)) {
        cancelled = true;
        break;
      }
      emit(onProgress, { status: 'chunk-processing', index: i, total: windows.length, window: windows[i] });
      var builtPrompt = prompt.buildExtractionPrompt(windows[i].messages, options.promptOptions || {});
      var output = '';
      try {
        output = await runGenerator(generator, builtPrompt, options);
      } catch (error) {
        if (isAbortError(error) || signalAborted(signal)) {
          cancelled = true;
          break;
        }
        throw error;
      }
      var rows = prompt.parseExtractionOutput(output, {
        allowedMessageIds: allowedMessageIds(windows[i].messages)
      });
      rows.forEach(function(row) {
        rawThreads.push(makeThread(chat, row, createdAt));
      });
      await persistDiscoveredThreads();
    }

    if (signalAborted(signal)) cancelled = true;
    var threads = options.dao && typeof options.dao.putOpenThreads === 'function' ? savedThreads.slice() : await persistDiscoveredThreads();

    var result = {
      chatId: chat.chatId,
      windows: windows,
      rawThreadCount: rawThreads.length,
      threadCount: threads.length,
      threads: threads,
      cancelled: cancelled,
      durationMs: now() - startedAt
    };
    if (options.dao && typeof options.dao.putExtractionRun === 'function') {
      await options.dao.putExtractionRun({
        runId: ['extract', idPart(chat.chatId), String(startedAt), stableHash(createdAt)].join(':'),
        chatId: chat.chatId,
        modelName: modelName(options),
        modelVersion: modelVersion(options),
        completedAt: isoNow(),
        threadCount: result.threadCount,
        cancelled: cancelled,
        durationMs: result.durationMs
      });
    }
    emit(onProgress, { status: cancelled ? 'cancelled' : 'done', result: result });
    return result;
  }

  return {
    DEFAULT_MODEL_ID: DEFAULT_MODEL_ID,
    DEFAULT_GENERATION_OPTIONS: Object.assign({}, DEFAULT_GENERATION_OPTIONS),
    buildWindows: function(messages, options) {
      options = options || {};
      return buildWindows(messages, dependencySet(options), options);
    },
    generatedText: generatedText,
    runChatExtraction: runChatExtraction
  };
})();

if (typeof module !== 'undefined') module.exports = ExtractionRunner;
