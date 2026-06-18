var NotionImportSessionModule = (typeof ImportSession !== 'undefined') ? ImportSession : null;
var NotionImportNormalizerModule = (typeof ImportNormalizer !== 'undefined') ? ImportNormalizer : null;
var NotionThreadScannerModule = (typeof ThreadScanner !== 'undefined') ? ThreadScanner : null;
if (!NotionImportSessionModule && typeof require !== 'undefined') {
  NotionImportSessionModule = require('./session.js');
}
if (!NotionImportNormalizerModule && typeof require !== 'undefined') {
  NotionImportNormalizerModule = require('./normalizer.js');
}

var NotionImporter = (function() {
  var ADAPTER_ID = 'notion';
  var ADAPTER_VERSION = 'v1';
  var NOTION_VERSION = '2026-03-11';
  var API_BASE = 'https://api.notion.com/v1';
  var SUPPORTED_TYPES = {
    paragraph: true,
    heading_1: true,
    heading_2: true,
    heading_3: true,
    bulleted_list_item: true,
    numbered_list_item: true,
    to_do: true,
    toggle: true,
    code: true,
    quote: true,
    callout: true
  };

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function stableHash(value) {
    var hash = 5381;
    value = text(value);
    for (var i = 0; i < value.length; i++) {
      hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  function requireModule(value, name) {
    if (!value) throw new Error(name + ' is unavailable');
    return value;
  }

  function abortError() {
    var error = new Error('Import cancelled');
    error.name = 'AbortError';
    error.code = 'ABORT_ERR';
    return error;
  }

  function isAbort(error) {
    return !!(error && (error.name === 'AbortError' || error.code === 'ABORT_ERR'));
  }

  function pageId(input) {
    input = text(input).trim();
    if (!input) throw new Error('Notion page ID or URL is required');
    var compact = input.replace(/-/g, '');
    var match = compact.match(/[0-9a-fA-F]{32}/g);
    return match && match.length ? match[match.length - 1].toLowerCase() : input;
  }

  function hyphenatedId(id) {
    id = text(id).replace(/-/g, '');
    if (!/^[0-9a-fA-F]{32}$/.test(id)) return text(id);
    return [id.slice(0, 8), id.slice(8, 12), id.slice(12, 16), id.slice(16, 20), id.slice(20)].join('-');
  }

  function richText(rows) {
    return (Array.isArray(rows) ? rows : []).map(function(row) {
      return text(row && row.plain_text);
    }).join('');
  }

  function pageTitle(page) {
    var props = page && page.properties ? page.properties : {};
    for (var key in props) {
      if (props[key] && props[key].type === 'title') {
        var title = richText(props[key].title);
        if (title) return title;
      }
    }
    return 'Untitled Notion page';
  }

  function blockContent(block) {
    var type = block && block.type;
    var data = block && block[type] ? block[type] : {};
    if (!SUPPORTED_TYPES[type]) return null;
    if (type === 'code') return richText(data.rich_text);
    if (type === 'to_do') return (data.checked ? '[x] ' : '[ ] ') + richText(data.rich_text);
    return richText(data.rich_text);
  }

  function fetcher(options) {
    var fn = options.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    if (typeof fn !== 'function') throw new Error('fetch is unavailable');
    return fn;
  }

  function retryAfter(response) {
    if (!response || !response.headers || typeof response.headers.get !== 'function') return 1;
    var value = Number(response.headers.get('Retry-After') || response.headers.get('retry-after') || 1);
    return Number.isFinite(value) && value >= 0 ? value : 1;
  }

  async function wait(ms, options) {
    if (options.signal && options.signal.aborted) throw abortError();
    if (typeof options.sleep === 'function') return options.sleep(ms);
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  async function parseError(response) {
    try {
      var body = await response.json();
      return {
        code: text(body.code || ('HTTP_' + response.status)),
        message: text(body.message || response.statusText || 'Notion request failed')
      };
    } catch (error) {
      return { code: 'HTTP_' + response.status, message: text(response.statusText || 'Notion request failed') };
    }
  }

  async function requestJson(path, options, session, attempt) {
    attempt = attempt || 0;
    session.throwIfCancelled();
    var response = await fetcher(options)(API_BASE + path, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + options.token,
        'Notion-Version': options.notionVersion || NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      signal: options.signal
    });

    if ((response.status === 429 || response.status === 529) && attempt < (options.maxRetries || 3)) {
      var delayMs = retryAfter(response) * 1000;
      session.addWarning({
        code: response.status === 429 ? 'NOTION_RATE_LIMIT' : 'NOTION_SERVICE_OVERLOAD',
        message: 'Retrying Notion request after rate limit.',
        sourceRef: path,
        recoverable: true
      });
      await wait(delayMs, options);
      return requestJson(path, options, session, attempt + 1);
    }

    if (!response.ok) {
      var parsed = await parseError(response);
      var error = new Error(parsed.message);
      error.code = parsed.code;
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async function collectBlocks(rootBlockId, options, session) {
    var rows = [];

    async function visit(blockId, parentId) {
      var cursor = '';
      do {
        session.throwIfCancelled();
        var path = '/blocks/' + encodeURIComponent(blockId) + '/children?page_size=50' + (cursor ? '&start_cursor=' + encodeURIComponent(cursor) : '');
        var page = await requestJson(path, options, session);
        var results = Array.isArray(page.results) ? page.results : [];
        for (var i = 0; i < results.length; i++) {
          session.recordParsed();
          rows.push({ block: results[i], parentId: parentId || rootBlockId });
          if (results[i] && results[i].has_children) await visit(results[i].id, results[i].id);
        }
        cursor = page.has_more ? text(page.next_cursor) : '';
      } while (cursor);
    }

    await visit(rootBlockId, '');
    return rows;
  }

  function makeMessages(page, blockRows, options, session, normalizer, importedAt) {
    var pageIdValue = text(page.id || options.pageId);
    var title = pageTitle(page);
    var pageUrl = page.url || options.pageUrl || '';
    var workspaceHint = text(options.workspaceHint || page.workspace || page.workspace_name);
    var chatId = ADAPTER_ID + ':page:' + pageIdValue;
    var messages = [];
    blockRows.forEach(function(row, index) {
      var block = row.block || {};
      var body = blockContent(block);
      if (body === null) {
        session.recordSkipped();
        session.skipSource(block.id || ('block-' + String(index)));
        session.addWarning({
          code: 'NOTION_UNSUPPORTED_BLOCK',
          message: 'Skipped unsupported Notion block type: ' + text(block.type || 'unknown'),
          sourceRef: text(block.id),
          recoverable: true
        });
        return;
      }
      messages.push(normalizer.createMessage({
        adapterId: ADAPTER_ID,
        adapterVersion: ADAPTER_VERSION,
        chatId: chatId,
        messageId: chatId + ':block:' + text(block.id || index),
        role: 'document',
        content: body,
        index: messages.length,
        sourceKind: 'block',
        sourceObjectId: text(block.id),
        sourceUrl: page.url || options.sourceUrl || '',
        sourceTimestamp: block.last_edited_time || page.last_edited_time || importedAt,
        importedAt: importedAt,
        runId: 'import:notion:' + pageIdValue + ':' + stableHash(importedAt),
        provenance: {
          pageId: pageIdValue,
          pageTitle: title,
          pageUrl: pageUrl,
          workspaceHint: workspaceHint,
          blockId: text(block.id),
          parentBlockId: text(row.parentId),
          blockType: text(block.type)
        }
      }));
      session.recordImported();
    });
    return messages;
  }

  async function persist(result, dao) {
    if (!dao) return;
    if (dao.putChat) await dao.putChat(result.chat);
    if (dao.putMessages) await dao.putMessages(result.chat.chatId, result.messages);
    if (dao.putOpenThreads && result.openThreads.length) await dao.putOpenThreads(result.openThreads);
    if (dao.putExtractionRun) await dao.putExtractionRun(result.run);
  }

  async function importPage(options) {
    options = options || {};
    if (!options.token) throw new Error('Notion token is required');
    var normalizedPageId = pageId(options.pageId || options.pageUrl);
    var importedAt = options.importedAt || new Date().toISOString();
    var sessionModule = requireModule(options.sessionModule || NotionImportSessionModule, 'ImportSession');
    var normalizer = requireModule(options.normalizer || NotionImportNormalizerModule, 'ImportNormalizer');
    var scanner = options.scanner || NotionThreadScannerModule || null;
    var session = sessionModule.create({
      adapterId: ADAPTER_ID,
      adapterVersion: ADAPTER_VERSION,
      sourceKind: 'page',
      sourceObjectId: normalizedPageId,
      sourceUrl: options.pageUrl || '',
      importedAt: importedAt,
      signal: options.signal,
      onProgress: options.onProgress
    });

    try {
      session.setPhase('page');
      var page = await requestJson('/pages/' + encodeURIComponent(hyphenatedId(normalizedPageId)), options, session);
      page.id = page.id || normalizedPageId;
      session.setPhase('blocks');
      var blockRows = await collectBlocks(page.id, options, session);
      session.setPhase('normalize');
      var messages = makeMessages(page, blockRows, options, session, normalizer, importedAt);
      var chatId = ADAPTER_ID + ':page:' + text(page.id);
      var contentHash = stableHash(JSON.stringify({
        page: { id: page.id, last_edited_time: page.last_edited_time },
        blocks: blockRows.map(function(row) {
          return { id: row.block && row.block.id, type: row.block && row.block.type, content: blockContent(row.block) };
        })
      }));
      var chat = normalizer.createChat({
        adapterId: ADAPTER_ID,
        adapterVersion: ADAPTER_VERSION,
        chatId: chatId,
        title: pageTitle(page),
        sourceKind: 'page',
        sourceObjectId: text(page.id),
        sourceUrl: page.url || options.pageUrl || '',
        sourceUpdatedAt: page.last_edited_time || importedAt,
        importedAt: importedAt,
        packageHash: contentHash,
        runId: 'import:notion:' + text(page.id) + ':' + stableHash(importedAt),
        messageCount: messages.length,
        provenance: {
          pageId: text(page.id),
          pageTitle: pageTitle(page),
          pageUrl: page.url || options.pageUrl || '',
          workspaceHint: text(options.workspaceHint || page.workspace || page.workspace_name)
        }
      });
      var openThreads = scanner && scanner.scanMessage
        ? messages.reduce(function(rows, message) {
            return rows.concat(scanner.scanMessage(message));
          }, [])
        : [];
      var run = session.finish();
      run.threadCount = openThreads.length;
      var result = { chat: chat, messages: messages, openThreads: openThreads, run: run, cancelled: false };
      await persist(result, options.dao);
      return result;
    } catch (error) {
      if (!isAbort(error)) {
        session.addError({
          code: error.code || 'NOTION_IMPORT_ERROR',
          message: error.message || String(error),
          sourceRef: normalizedPageId,
          recoverable: false
        });
      }
      var run = session.finish(isAbort(error) ? 'cancelled' : 'error');
      run.threadCount = 0;
      var failed = { chat: null, messages: [], openThreads: [], run: run, cancelled: isAbort(error), error: error };
      if (options.dao && options.dao.putExtractionRun) await options.dao.putExtractionRun(run);
      if (isAbort(error)) return failed;
      throw error;
    }
  }

  return {
    ADAPTER_ID: ADAPTER_ID,
    ADAPTER_VERSION: ADAPTER_VERSION,
    NOTION_VERSION: NOTION_VERSION,
    pageId: pageId,
    richText: richText,
    blockContent: blockContent,
    importPage: importPage
  };
})();

if (typeof module !== 'undefined') module.exports = NotionImporter;
