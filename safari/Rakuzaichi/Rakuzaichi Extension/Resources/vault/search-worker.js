(function(root) {
  function serializeError(error) {
    return {
      name: error && error.name ? error.name : 'Error',
      message: error && error.message ? error.message : String(error || 'Unknown error'),
      stack: error && error.stack ? error.stack : ''
    };
  }

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function normalizeDocument(document) {
    return {
      id: text(document.id || document.chatId),
      chatId: text(document.chatId || document.id),
      title: text(document.title),
      content: text(document.content),
      platform: text(document.platform),
      url: text(document.url),
      lastUpdatedAt: text(document.lastUpdatedAt),
      messageCount: document.messageCount || 0,
      tags: Array.isArray(document.tags) ? document.tags.slice() : []
    };
  }

  function createVaultSearchWorkerRuntime(MiniSearchCtor) {
    if (!MiniSearchCtor) throw new Error('MiniSearch is unavailable');
    var index = null;
    var indexOptions = {
      fields: ['title', 'content'],
      storeFields: ['chatId', 'title', 'platform', 'url', 'lastUpdatedAt', 'messageCount', 'tags']
    };

    function build(documents) {
      var normalized = (Array.isArray(documents) ? documents : []).map(normalizeDocument);
      index = new MiniSearchCtor(indexOptions);
      index.addAll(normalized);
      return { count: normalized.length };
    }

    function load(indexJson) {
      index = MiniSearchCtor.loadJSON(indexJson, indexOptions);
      return { loaded: true };
    }

    function upsert(document) {
      if (!index) index = new MiniSearchCtor(indexOptions);
      var normalized = normalizeDocument(document || {});
      if (!normalized.id) throw new Error('Search document id is required');
      try {
        index.discard(normalized.id);
      } catch (error) {}
      index.add(normalized);
      return { chatId: normalized.chatId };
    }

    function exportIndex() {
      return index ? JSON.stringify(index) : '';
    }

    function search(query, limit) {
      if (!index) return [];
      query = text(query).trim();
      if (!query) return [];
      limit = limit && limit > 0 ? limit : 100;
      return index.search(query, {
        boost: { title: 2 },
        prefix: true,
        fuzzy: 0.2
      }).slice(0, limit).map(function(result) {
        return {
          chatId: result.chatId,
          score: result.score,
          terms: result.terms || [],
          title: result.title,
          platform: result.platform,
          url: result.url,
          lastUpdatedAt: result.lastUpdatedAt,
          messageCount: result.messageCount,
          tags: result.tags || []
        };
      });
    }

    async function handleMessage(message, respond) {
      var id = message && message.id;
      try {
        if (!message || message.type === 'build') {
          respond({ id: id, ok: true, payload: build(message && message.payload && message.payload.documents) });
          return;
        }
        if (message.type === 'load') {
          respond({ id: id, ok: true, payload: load(message.payload && message.payload.indexJson) });
          return;
        }
        if (message.type === 'upsert') {
          respond({ id: id, ok: true, payload: upsert(message.payload && message.payload.document) });
          return;
        }
        if (message.type === 'export') {
          respond({ id: id, ok: true, payload: { indexJson: exportIndex() } });
          return;
        }
        if (message.type === 'search') {
          respond({
            id: id,
            ok: true,
            payload: search(message.payload && message.payload.query, message.payload && message.payload.limit)
          });
          return;
        }
        throw new Error('Unknown search worker message: ' + message.type);
      } catch (error) {
        respond({ id: id, ok: false, error: serializeError(error) });
      }
    }

    return {
      build: build,
      load: load,
      upsert: upsert,
      exportIndex: exportIndex,
      search: search,
      handleMessage: handleMessage
    };
  }

  if (root && typeof root.importScripts === 'function' && !root.MiniSearch) {
    root.importScripts('../vendor/minisearch.js');
  }

  function isDedicatedWorker(root) {
    return !!(root && root.constructor && root.constructor.name === 'DedicatedWorkerGlobalScope');
  }

  if (isDedicatedWorker(root) && typeof root.addEventListener === 'function' && typeof root.postMessage === 'function') {
    var runtime = createVaultSearchWorkerRuntime(root.MiniSearch);
    root.addEventListener('message', function(event) {
      runtime.handleMessage(event.data, function(response) {
        root.postMessage(response);
      });
    });
  }

  if (typeof module !== 'undefined') {
    module.exports = {
      createVaultSearchWorkerRuntime: createVaultSearchWorkerRuntime
    };
  }
  if (root) root.createVaultSearchWorkerRuntime = createVaultSearchWorkerRuntime;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
