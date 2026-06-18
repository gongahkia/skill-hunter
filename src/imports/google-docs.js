var GoogleDocsImportSessionModule = (typeof ImportSession !== 'undefined') ? ImportSession : null;
var GoogleDocsImportNormalizerModule = (typeof ImportNormalizer !== 'undefined') ? ImportNormalizer : null;
var GoogleDocsThreadScannerModule = (typeof ThreadScanner !== 'undefined') ? ThreadScanner : null;
if (!GoogleDocsImportSessionModule && typeof require !== 'undefined') {
  GoogleDocsImportSessionModule = require('./session.js');
}
if (!GoogleDocsImportNormalizerModule && typeof require !== 'undefined') {
  GoogleDocsImportNormalizerModule = require('./normalizer.js');
}

var GoogleDocsImporter = (function() {
  var ADAPTER_ID = 'google-docs';
  var ADAPTER_VERSION = 'v1';
  var SUPPORTED_EXTENSIONS = {
    html: 'html',
    htm: 'html',
    txt: 'plain-text',
    md: 'markdown',
    markdown: 'markdown',
    xml: 'docx-document-xml'
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

  function idPart(value) {
    return text(value).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'unknown';
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

  function parserCtor(options) {
    if (options && options.DOMParser) return options.DOMParser;
    if (typeof DOMParser !== 'undefined') return DOMParser;
    throw new Error('DOMParser is unavailable');
  }

  function parseDom(content, type, options) {
    var Parser = parserCtor(options);
    return new Parser().parseFromString(text(content), type);
  }

  function filename(file) {
    return text(file && (file.webkitRelativePath || file.relativePath || file.path || file.name)).trim();
  }

  function basename(path) {
    var name = text(path).split(/[\\/]/).pop();
    return name.replace(/\.[^.]+$/, '') || name || 'Untitled Google Doc';
  }

  function extension(path) {
    var match = text(path).toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : '';
  }

  function inferFormat(file, path) {
    var type = text(file && file.type).toLowerCase();
    var ext = extension(path);
    if (SUPPORTED_EXTENSIONS[ext]) return SUPPORTED_EXTENSIONS[ext];
    if (type.indexOf('html') !== -1) return 'html';
    if (type.indexOf('markdown') !== -1) return 'markdown';
    if (type.indexOf('text/plain') !== -1) return 'plain-text';
    if (type.indexOf('xml') !== -1) return 'docx-document-xml';
    return '';
  }

  function compactSpaces(value) {
    return text(value).replace(/\s+/g, ' ').trim();
  }

  function imageText(node) {
    var images = node.querySelectorAll ? Array.prototype.slice.call(node.querySelectorAll('img')) : [];
    return images.map(function(img) {
      var alt = compactSpaces(img.getAttribute('alt') || img.getAttribute('title'));
      return alt ? '[image: ' + alt + ']' : '[image]';
    }).join(' ');
  }

  function nodeText(node) {
    return compactSpaces([node.textContent, imageText(node)].filter(Boolean).join(' '));
  }

  function pushBlock(blocks, type, content, path, extra) {
    content = text(content).trim();
    if (!content) return;
    blocks.push(Object.assign({
      type: type,
      content: content,
      path: path || type + ':' + String(blocks.length)
    }, extra || {}));
  }

  function sourceUrlFromHtml(doc) {
    var meta = doc.querySelector('meta[name="source-url"],meta[property="og:url"]');
    if (meta && meta.getAttribute('content')) return meta.getAttribute('content');
    var canonical = doc.querySelector('link[rel="canonical"]');
    return canonical ? text(canonical.getAttribute('href')) : '';
  }

  function parseHtml(content, path, options) {
    var doc = parseDom(content, 'text/html', options);
    var title = compactSpaces(doc.querySelector('title') && doc.querySelector('title').textContent) ||
      compactSpaces(doc.querySelector('h1') && doc.querySelector('h1').textContent) ||
      basename(path);
    var nodes = Array.prototype.slice.call(doc.body ? doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,table,aside.comment,[data-comment]') : []);
    var blocks = [];

    nodes.forEach(function(node, index) {
      var tag = text(node.tagName).toLowerCase();
      if (tag !== 'table' && node.closest && node.closest('table')) return;
      if (tag === 'p' && node.closest && node.closest('li')) return;
      if (tag === 'table') {
        var rows = Array.prototype.slice.call(node.querySelectorAll('tr')).map(function(row) {
          return Array.prototype.slice.call(row.querySelectorAll('th,td')).map(nodeText).filter(Boolean).join(' | ');
        }).filter(Boolean);
        pushBlock(blocks, 'table', rows.join('\n'), 'html:table:' + String(index));
        return;
      }
      pushBlock(blocks, tag === 'li' ? 'list-item' : tag, nodeText(node), 'html:' + tag + ':' + String(index));
    });

    return {
      title: title,
      sourceUrl: sourceUrlFromHtml(doc),
      format: 'html',
      blocks: blocks,
      warnings: []
    };
  }

  function getByTag(root, tag) {
    return Array.prototype.slice.call(root.getElementsByTagName(tag));
  }

  function firstAttr(node, names) {
    for (var i = 0; i < names.length; i++) {
      var value = node.getAttribute && node.getAttribute(names[i]);
      if (value) return value;
    }
    return '';
  }

  function xmlText(node) {
    return getByTag(node, 'w:t').concat(getByTag(node, 't')).map(function(row) {
      return text(row.textContent);
    }).join('');
  }

  function xmlHas(node, tag) {
    return getByTag(node, tag).length > 0 || getByTag(node, tag.replace(/^w:/, '')).length > 0;
  }

  function xmlClosest(node, tag) {
    while (node) {
      if (node.nodeName === tag || node.localName === tag.replace(/^w:/, '')) return node;
      node = node.parentNode;
    }
    return null;
  }

  function parseDocxDocumentXml(content, path, options) {
    var doc = parseDom(content, 'application/xml', options);
    if (doc.querySelector && doc.querySelector('parsererror')) throw new Error('Malformed DOCX document XML');
    var blocks = [];
    var warnings = [];
    var tables = getByTag(doc, 'w:tbl').concat(getByTag(doc, 'tbl'));

    tables.forEach(function(table, index) {
      var rows = getByTag(table, 'w:tr').concat(getByTag(table, 'tr')).map(function(row) {
        return getByTag(row, 'w:tc').concat(getByTag(row, 'tc')).map(function(cell) {
          return compactSpaces(xmlText(cell));
        }).filter(Boolean).join(' | ');
      }).filter(Boolean);
      pushBlock(blocks, 'table', rows.join('\n'), 'docx:table:' + String(index));
    });

    getByTag(doc, 'w:p').concat(getByTag(doc, 'p')).forEach(function(node, index) {
      if (xmlClosest(node.parentNode, 'w:tbl')) return;
      var body = compactSpaces(xmlText(node));
      if (!body && xmlHas(node, 'w:drawing')) body = '[image]';
      if (!body && xmlHas(node, 'w:footnoteReference')) body = '[footnote reference ' + firstAttr(getByTag(node, 'w:footnoteReference')[0] || getByTag(node, 'footnoteReference')[0] || {}, ['w:id', 'id']) + ']';
      if (!body) return;
      var type = /Heading/i.test(text(node.innerHTML)) ? 'heading' : 'paragraph';
      pushBlock(blocks, type, body, 'docx:p:' + String(index));
    });

    if (text(content).indexOf('<w:drawing') !== -1) warnings.push({
      code: 'GOOGLE_DOCS_IMAGE_PLACEHOLDER',
      message: 'Imported DOCX image as placeholder.',
      sourceRef: path,
      recoverable: true
    });

    return {
      title: blocks.length ? blocks[0].content : basename(path),
      sourceUrl: '',
      format: 'docx-document-xml',
      blocks: blocks,
      warnings: warnings
    };
  }

  function parseText(content, path, format) {
    var blocks = text(content).split(/\r?\n/).map(function(line, index) {
      return { line: line.trim(), index: index };
    }).filter(function(row) {
      return !!row.line;
    }).map(function(row) {
      return { type: 'paragraph', content: row.line, path: format + ':line:' + String(row.index) };
    });
    return {
      title: blocks.length ? blocks[0].content.slice(0, 80) : basename(path),
      sourceUrl: '',
      format: format,
      blocks: blocks,
      warnings: []
    };
  }

  function parseContent(content, format, path, options) {
    if (format === 'html') return parseHtml(content, path, options);
    if (format === 'docx-document-xml') return parseDocxDocumentXml(content, path, options);
    if (format === 'plain-text' || format === 'markdown') return parseText(content, path, format);
    throw new Error('Unsupported Google Docs export format');
  }

  async function readFile(file) {
    if (file && typeof file.text === 'function') return file.text();
    if (file && typeof file.content === 'string') return file.content;
    if (file && typeof file.data === 'string') return file.data;
    throw new Error('File text reader is unavailable');
  }

  function normalizeFiles(files) {
    if (!files) return [];
    return Array.prototype.slice.call(files).filter(Boolean);
  }

  function persistableDao(options) {
    return options.dao || null;
  }

  async function persist(result, dao) {
    if (!dao) return;
    if (dao.putChat) await dao.putChat(result.chat);
    if (dao.putMessages) await dao.putMessages(result.chat.chatId, result.messages);
    if (dao.putOpenThreads && result.openThreads.length) await dao.putOpenThreads(result.openThreads);
    if (dao.putExtractionRun) await dao.putExtractionRun(result.run);
  }

  function makeMessage(normalizer, session, parsed, source, chatId, runId, packageHash, importedAt, block, index) {
    session.throwIfCancelled();
    session.recordParsed();
    var message = normalizer.createMessage({
      adapterId: ADAPTER_ID,
      adapterVersion: ADAPTER_VERSION,
      chatId: chatId,
      messageId: chatId + ':node:' + idPart(block.path || index),
      role: 'document',
      content: block.content,
      index: index,
      sourceKind: 'file-node',
      sourceObjectId: block.path || String(index),
      sourcePath: source.path,
      sourceName: source.name,
      sourceUrl: parsed.sourceUrl,
      importedAt: importedAt,
      runId: runId,
      packageHash: packageHash,
      provenance: {
        filePath: source.path,
        fileName: source.name,
        exportedFormat: parsed.format,
        documentTitle: parsed.title,
        sourceUrl: parsed.sourceUrl,
        nodePath: block.path,
        nodeType: block.type
      }
    });
    session.recordImported();
    return message;
  }

  async function importFile(options) {
    options = options || {};
    var file = options.file;
    if (!file) throw new Error('Google Docs export file is required');
    var path = filename(file);
    if (!path) throw new Error('Google Docs export file name is required');
    var format = options.format || inferFormat(file, path);
    if (!format) throw new Error('Unsupported Google Docs export format');
    var content = await readFile(file);
    var importedAt = options.importedAt || new Date().toISOString();
    var packageHash = stableHash(content);
    var sourceId = stableHash(path + '\n' + packageHash);
    var chatId = ADAPTER_ID + ':file:' + sourceId;
    var runId = 'import:' + ADAPTER_ID + ':' + sourceId + ':' + stableHash(importedAt);
    var source = { path: path, name: text(file.name || basename(path)) };
    var sessionModule = requireModule(options.sessionModule || GoogleDocsImportSessionModule, 'ImportSession');
    var normalizer = requireModule(options.normalizer || GoogleDocsImportNormalizerModule, 'ImportNormalizer');
    var scanner = options.scanner || GoogleDocsThreadScannerModule || null;
    var session = sessionModule.create({
      adapterId: ADAPTER_ID,
      adapterVersion: ADAPTER_VERSION,
      sourceKind: 'file',
      sourcePath: path,
      sourceName: source.name,
      packageHash: packageHash,
      importedAt: importedAt,
      signal: options.signal,
      onProgress: options.onProgress
    });

    try {
      session.setPhase('parse');
      var parsed = parseContent(content, format, path, options);
      session.setTotal(parsed.blocks.length);
      parsed.warnings.forEach(function(warning) {
        session.addWarning(warning);
      });
      session.setPhase('normalize');
      var messages = parsed.blocks.map(function(block, index) {
        return makeMessage(normalizer, session, parsed, source, chatId, runId, packageHash, importedAt, block, index);
      });
      session.completeSnapshot(chatId);
      var chat = normalizer.createChat({
        adapterId: ADAPTER_ID,
        adapterVersion: ADAPTER_VERSION,
        chatId: chatId,
        title: parsed.title || basename(path),
        url: parsed.sourceUrl,
        sourceKind: 'file',
        sourcePath: path,
        sourceName: source.name,
        sourceUrl: parsed.sourceUrl,
        importedAt: importedAt,
        packageHash: packageHash,
        runId: runId,
        messageCount: messages.length,
        provenance: {
          filePath: path,
          fileName: source.name,
          exportedFormat: parsed.format,
          documentTitle: parsed.title || basename(path),
          sourceUrl: parsed.sourceUrl
        }
      });
      var openThreads = scanner && scanner.scanMessage
        ? messages.reduce(function(rows, message) {
            return rows.concat(scanner.scanMessage(message));
          }, [])
        : [];
      var run = session.finish('done', { chatId: chatId });
      run.chatId = chatId;
      run.threadCount = openThreads.length;
      var result = { chat: chat, messages: messages, openThreads: openThreads, run: run, cancelled: false };
      await persist(result, persistableDao(options));
      return result;
    } catch (error) {
      if (!isAbort(error)) {
        session.addError({
          code: error.code || 'GOOGLE_DOCS_IMPORT_ERROR',
          message: error.message || String(error),
          sourceRef: path,
          recoverable: false
        });
      }
      var failedRun = session.finish(isAbort(error) ? 'cancelled' : 'error', { chatId: chatId });
      failedRun.chatId = chatId;
      var failed = { chat: null, messages: [], openThreads: [], run: failedRun, cancelled: isAbort(error), error: error };
      if (options.dao && options.dao.putExtractionRun) await options.dao.putExtractionRun(failedRun);
      if (isAbort(error)) return failed;
      throw error;
    }
  }

  async function importFiles(options) {
    options = options || {};
    var files = normalizeFiles(options.files || options.fileList);
    if (!files.length) throw new Error('No Google Docs export files selected');
    var results = [];
    for (var i = 0; i < files.length; i++) {
      if (options.signal && options.signal.aborted) throw abortError();
      results.push(await importFile(Object.assign({}, options, { file: files[i] })));
    }
    return {
      results: results,
      chats: results.map(function(result) { return result.chat; }).filter(Boolean),
      messages: results.reduce(function(rows, result) { return rows.concat(result.messages); }, []),
      openThreads: results.reduce(function(rows, result) { return rows.concat(result.openThreads); }, []),
      runs: results.map(function(result) { return result.run; }),
      cancelled: results.some(function(result) { return result.cancelled; })
    };
  }

  return {
    ADAPTER_ID: ADAPTER_ID,
    ADAPTER_VERSION: ADAPTER_VERSION,
    inferFormat: inferFormat,
    parseContent: parseContent,
    importFile: importFile,
    importFiles: importFiles
  };
})();

if (typeof module !== 'undefined') module.exports = GoogleDocsImporter;
