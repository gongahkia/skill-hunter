var LocalRAG = (function() {
  var DEFAULT_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
  var DEFAULT_TASK = 'feature-extraction';
  var DEFAULT_DTYPE = 'q8';
  var DEFAULT_BACKEND = 'wasm';
  var DEFAULT_LIMIT = 8;
  var TARGET_WORDS = 160;
  var MAX_WORDS = 220;
  var OVERLAP_WORDS = 32;

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function normalizeText(value) {
    return text(value).replace(/\s+/g, ' ').trim();
  }

  function stableHash(value) {
    value = text(value);
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function words(value) {
    return normalizeText(value).split(' ').filter(Boolean);
  }

  function nonStopwordCount(value) {
    var stop = { the: true, a: true, an: true, and: true, or: true, to: true, of: true, in: true, is: true, it: true };
    return words(value).filter(function(word) {
      return !stop[word.toLowerCase()];
    }).length;
  }

  function sourceTitle(chat) {
    return text(chat && (chat.title || chat.chatTitle), 'Untitled chat');
  }

  function chatTimestamp(chat, message) {
    return text(message && message.timestamp) || text(chat && (chat.lastUpdatedAt || chat.capturedAt));
  }

  function groupMessages(messages) {
    return (Array.isArray(messages) ? messages : []).reduce(function(grouped, message) {
      var chatId = text(message && message.chatId);
      if (!grouped[chatId]) grouped[chatId] = [];
      grouped[chatId].push(message);
      return grouped;
    }, {});
  }

  function chunkWords(sourceWords, maxWords, overlap) {
    if (!sourceWords.length) return [];
    var chunks = [];
    var step = Math.max(1, maxWords - overlap);
    for (var start = 0; start < sourceWords.length; start += step) {
      var end = Math.min(sourceWords.length, start + maxWords);
      chunks.push(sourceWords.slice(start, end).join(' '));
      if (end === sourceWords.length) break;
    }
    return chunks;
  }

  function createMessageChunks(chat, message, options) {
    options = options || {};
    var maxWords = Math.max(1, Math.floor(options.maxWords || MAX_WORDS));
    var overlap = Math.max(0, Math.min(maxWords - 1, Math.floor(options.overlapWords || OVERLAP_WORDS)));
    var content = normalizeText(message && message.content);
    if (!content) return [];
    var sourceWords = words(content);
    var parts = sourceWords.length > maxWords ? chunkWords(sourceWords, maxWords, overlap) : [content];
    var chatId = text(chat && chat.chatId);
    var messageId = text(message && (message.messageId || message.id)) || ('message-' + text(message && message.index, '0'));
    return parts.map(function(part, index) {
      if (nonStopwordCount(part) < 3 && parts.length > 1) return null;
      var hash = stableHash([chatId, messageId, index, part].join('\n'));
      return {
        chunkId: ['rag', 'message', chatId, messageId, index, hash].map(encodeURIComponent).join(':'),
        sourceKind: 'message',
        sourceId: chatId,
        chatId: chatId,
        messageId: messageId,
        chunkIndex: index,
        contentHash: hash,
        text: part,
        excerpt: part.length > 260 ? part.slice(0, 257) + '...' : part,
        title: sourceTitle(chat),
        platform: text(chat && chat.platform, 'unknown'),
        timestamp: chatTimestamp(chat, message),
        url: text(chat && (chat.url || chat.sourceUrl)),
        provenancePath: text(message && message.provenancePath)
      };
    }).filter(Boolean);
  }

  function createChunks(chats, messages, options) {
    var grouped = groupMessages(messages);
    var chunks = [];
    (Array.isArray(chats) ? chats : []).forEach(function(chat) {
      var rows = grouped[text(chat && chat.chatId)] || [];
      rows.sort(function(a, b) {
        return (a.index || 0) - (b.index || 0);
      });
      rows.forEach(function(message) {
        Array.prototype.push.apply(chunks, createMessageChunks(chat, message, options));
      });
    });
    return chunks;
  }

  function normalizeVector(vector) {
    vector = Array.prototype.slice.call(vector || []).map(function(value) {
      return Number(value) || 0;
    });
    var magnitude = Math.sqrt(vector.reduce(function(sum, value) {
      return sum + value * value;
    }, 0));
    if (!magnitude) return vector;
    return vector.map(function(value) {
      return value / magnitude;
    });
  }

  function tensorVectors(output, expectedCount) {
    if (!output) return [];
    if (Array.isArray(output)) {
      if (!output.length) return [];
      if (Array.isArray(output[0]) || ArrayBuffer.isView(output[0])) return output.map(normalizeVector);
      return [normalizeVector(output)];
    }
    if (typeof output.tolist === 'function') return tensorVectors(output.tolist(), expectedCount);
    if (output.data && output.dims && output.dims.length >= 2) {
      var rows = output.dims[0];
      var width = output.dims[1];
      var vectors = [];
      for (var row = 0; row < rows; row++) {
        vectors.push(normalizeVector(Array.prototype.slice.call(output.data, row * width, row * width + width)));
      }
      return vectors;
    }
    if (output.data && expectedCount === 1) return [normalizeVector(output.data)];
    return [];
  }

  async function embedWithLoader(texts, options) {
    options = options || {};
    var loader = options.modelLoader || (typeof ExtractionModelLoader !== 'undefined' ? ExtractionModelLoader : null);
    if (!loader || typeof loader.loadModel !== 'function') throw new Error('RAG model loader is unavailable');
    var pipe = await loader.loadModel(options.modelId || DEFAULT_MODEL_ID, {
      task: options.task || DEFAULT_TASK,
      quantization: options.dtype || DEFAULT_DTYPE,
      dtype: options.dtype || DEFAULT_DTYPE,
      backend: options.backend || DEFAULT_BACKEND,
      env: options.env,
      onProgress: options.onProgress
    });
    var output = await pipe(texts, { pooling: 'mean', normalize: true });
    return tensorVectors(output, texts.length);
  }

  async function embedTexts(texts, options) {
    texts = Array.isArray(texts) ? texts : [texts];
    options = options || {};
    if (options.embedder) {
      var result = typeof options.embedder === 'function'
        ? await options.embedder(texts)
        : await options.embedder.embed(texts);
      return tensorVectors(result, texts.length);
    }
    return embedWithLoader(texts, options);
  }

  function cosine(a, b) {
    var length = Math.min(a.length, b.length);
    var score = 0;
    for (var i = 0; i < length; i++) score += a[i] * b[i];
    return score;
  }

  function create(options) {
    options = options || {};
    var state = {
      chunks: [],
      vectors: [],
      modelReady: false,
      ready: false
    };

    async function downloadModel(downloadOptions) {
      downloadOptions = Object.assign({}, options, downloadOptions || {});
      if (downloadOptions.signal && downloadOptions.signal.aborted) throw new Error('RAG model download cancelled');
      var loader = downloadOptions.modelLoader || options.modelLoader || (typeof ExtractionModelLoader !== 'undefined' ? ExtractionModelLoader : null);
      if (!loader || typeof loader.loadModel !== 'function') throw new Error('RAG model loader is unavailable');
      var pipe = await loader.loadModel(downloadOptions.modelId || DEFAULT_MODEL_ID, {
        task: downloadOptions.task || DEFAULT_TASK,
        quantization: downloadOptions.dtype || DEFAULT_DTYPE,
        dtype: downloadOptions.dtype || DEFAULT_DTYPE,
        backend: downloadOptions.backend || DEFAULT_BACKEND,
        env: downloadOptions.env,
        onProgress: downloadOptions.onProgress
      });
      if (downloadOptions.signal && downloadOptions.signal.aborted) throw new Error('RAG model download cancelled');
      state.modelReady = true;
      return {
        modelId: downloadOptions.modelId || DEFAULT_MODEL_ID,
        dtype: downloadOptions.dtype || DEFAULT_DTYPE,
        backend: downloadOptions.backend || DEFAULT_BACKEND,
        pipe: pipe
      };
    }

    async function build(buildOptions) {
      buildOptions = Object.assign({}, options, buildOptions || {});
      var dao = buildOptions.dao || options.dao;
      if (!dao || typeof dao.listChats !== 'function' || typeof dao.listAllMessages !== 'function') {
        throw new Error('Vault DAO is unavailable');
      }
      var chats = await dao.listChats();
      var messages = await dao.listAllMessages();
      var chunks = createChunks(chats, messages, buildOptions);
      var vectors = [];
      var batchSize = Math.max(1, Math.floor(buildOptions.batchSize || 8));
      for (var i = 0; i < chunks.length; i += batchSize) {
        var batch = chunks.slice(i, i + batchSize);
        if (buildOptions.signal && buildOptions.signal.aborted) throw new Error('RAG index build cancelled');
        var embedded = await embedTexts(batch.map(function(chunk) { return chunk.text; }), buildOptions);
        if (buildOptions.signal && buildOptions.signal.aborted) throw new Error('RAG index build cancelled');
        Array.prototype.push.apply(vectors, embedded);
        if (typeof buildOptions.onProgress === 'function') {
          buildOptions.onProgress({ status: 'embedding', indexed: Math.min(i + batch.length, chunks.length), total: chunks.length });
        }
      }
      state.chunks = chunks;
      state.vectors = vectors;
      state.ready = true;
      return { chunkCount: chunks.length, modelId: buildOptions.modelId || DEFAULT_MODEL_ID };
    }

    async function search(query, searchOptions) {
      query = normalizeText(query);
      searchOptions = Object.assign({}, options, searchOptions || {});
      if (!query) return [];
      if (!state.ready) await build(searchOptions);
      var queryVector = (await embedTexts([query], searchOptions))[0] || [];
      return state.chunks.map(function(chunk, index) {
        return {
          chunk: chunk,
          score: cosine(queryVector, state.vectors[index] || [])
        };
      }).filter(function(result) {
        return result.score > 0;
      }).sort(function(a, b) {
        return b.score - a.score;
      }).slice(0, searchOptions.limit || DEFAULT_LIMIT);
    }

    function clear() {
      state.chunks = [];
      state.vectors = [];
      state.ready = false;
      return true;
    }

    async function clearModelCache(clearOptions) {
      clearOptions = Object.assign({}, options, clearOptions || {});
      var loader = clearOptions.modelLoader || options.modelLoader || (typeof ExtractionModelLoader !== 'undefined' ? ExtractionModelLoader : null);
      if (loader && typeof loader.clearLoadedModels === 'function') loader.clearLoadedModels();
      state.modelReady = false;
      var cacheApi = clearOptions.caches || (typeof caches !== 'undefined' ? caches : null);
      var keys = [
        clearOptions.cacheKey,
        loader && loader.DEFAULT_CACHE_KEY,
        'rakuzaichi-transformers-cache'
      ].filter(Boolean).filter(function(value, index, list) {
        return list.indexOf(value) === index;
      });
      var deleted = 0;
      if (cacheApi && typeof cacheApi.delete === 'function') {
        for (var i = 0; i < keys.length; i++) {
          if (await cacheApi.delete(keys[i])) deleted++;
        }
      }
      return { clearedCaches: deleted, cacheKeys: keys };
    }

    return {
      downloadModel: downloadModel,
      build: build,
      search: search,
      clearModelCache: clearModelCache,
      clear: clear,
      isReady: function() { return state.ready; },
      isModelReady: function() { return state.modelReady; },
      getChunks: function() { return state.chunks.slice(); }
    };
  }

  return {
    DEFAULT_MODEL_ID: DEFAULT_MODEL_ID,
    DEFAULT_TASK: DEFAULT_TASK,
    DEFAULT_DTYPE: DEFAULT_DTYPE,
    createChunks: createChunks,
    embedTexts: embedTexts,
    cosine: cosine,
    create: create
  };
})();

if (typeof module !== 'undefined') module.exports = LocalRAG;
