var VaultSearch = (function() {
  var DEFAULT_LIMIT = 100;

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function getWorkerUrl(options) {
    if (options.workerUrl) return options.workerUrl;
    if (typeof api !== 'undefined' && api.runtime && api.runtime.getURL) return api.runtime.getURL('vault/search-worker.js');
    return 'vault/search-worker.js';
  }

  function groupMessages(messages) {
    return (Array.isArray(messages) ? messages : []).reduce(function(groups, message) {
      var chatId = text(message.chatId);
      if (!groups[chatId]) groups[chatId] = [];
      groups[chatId].push(message);
      return groups;
    }, {});
  }

  function createDocuments(chats, messages) {
    var grouped = groupMessages(messages);
    return (Array.isArray(chats) ? chats : []).map(function(chat) {
      var chatMessages = grouped[chat.chatId] || [];
      return {
        id: chat.chatId,
        chatId: chat.chatId,
        title: text(chat.title),
        content: chatMessages.map(function(message) {
          return text(message.content);
        }).join('\n'),
        platform: text(chat.platform),
        url: text(chat.url),
        lastUpdatedAt: text(chat.lastUpdatedAt || chat.capturedAt),
        messageCount: chat.messageCount || chatMessages.length,
        tags: Array.isArray(chat.tags) ? chat.tags.slice() : []
      };
    });
  }

  function create(options) {
    options = options || {};
    var dao = options.dao || (typeof VaultDAO !== 'undefined' ? VaultDAO : null);
    var WorkerCtor = options.Worker || (typeof Worker !== 'undefined' ? Worker : null);
    var worker = options.worker || (WorkerCtor ? new WorkerCtor(getWorkerUrl(options)) : null);
    if (!worker) throw new Error('Search worker is unavailable');

    var nextId = 1;
    var pending = {};
    var chats = [];
    var chatById = {};

    worker.onmessage = function(event) {
      var response = event.data || {};
      var request = pending[response.id];
      if (!request) return;
      delete pending[response.id];
      if (response.ok) request.resolve(response.payload);
      else request.reject(new Error(response.error && response.error.message ? response.error.message : 'Search worker failed'));
    };

    worker.onerror = function(error) {
      Object.keys(pending).forEach(function(id) {
        pending[id].reject(error instanceof Error ? error : new Error('Search worker failed'));
        delete pending[id];
      });
    };

    function request(type, payload) {
      return new Promise(function(resolve, reject) {
        var id = nextId++;
        pending[id] = { resolve: resolve, reject: reject };
        worker.postMessage({ id: id, type: type, payload: payload || {} });
      });
    }

    async function load() {
      if (!dao || typeof dao.listChats !== 'function') throw new Error('Vault DAO is unavailable');
      chats = await dao.listChats();
      var messages = typeof dao.listAllMessages === 'function' ? await dao.listAllMessages() : [];
      chatById = {};
      chats.forEach(function(chat) {
        chatById[chat.chatId] = chat;
      });
      await request('build', { documents: createDocuments(chats, messages) });
      return chats.slice();
    }

    async function search(query, limit) {
      query = text(query).trim();
      if (!query) return chats.slice();
      var results = await request('search', { query: query, limit: limit || DEFAULT_LIMIT });
      return results.map(function(result) {
        var chat = chatById[result.chatId];
        if (!chat) return null;
        return Object.assign({}, chat, {
          searchScore: result.score,
          searchTerms: result.terms || []
        });
      }).filter(Boolean);
    }

    function dispose() {
      if (worker && typeof worker.terminate === 'function') worker.terminate();
    }

    return {
      load: load,
      search: search,
      getChats: function() {
        return chats.slice();
      },
      dispose: dispose
    };
  }

  return {
    create: create,
    createDocuments: createDocuments
  };
})();

if (typeof module !== 'undefined') module.exports = VaultSearch;
