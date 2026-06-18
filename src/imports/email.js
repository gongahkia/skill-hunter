var EmailImportSessionModule = (typeof ImportSession !== 'undefined') ? ImportSession : null;
var EmailImportNormalizerModule = (typeof ImportNormalizer !== 'undefined') ? ImportNormalizer : null;
var EmailThreadScannerModule = (typeof ThreadScanner !== 'undefined') ? ThreadScanner : null;
if (!EmailImportSessionModule && typeof require !== 'undefined') {
  EmailImportSessionModule = require('./session.js');
}
if (!EmailImportNormalizerModule && typeof require !== 'undefined') {
  EmailImportNormalizerModule = require('./normalizer.js');
}

var EmailImporter = (function() {
  var ADAPTER_ID = 'email';
  var ADAPTER_VERSION = 'v1';

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function stableHash(value) {
    var hash = 5381;
    value = text(value);
    for (var i = 0; i < value.length; i++) hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    return (hash >>> 0).toString(36);
  }

  function idPart(value) {
    return text(value).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'unknown';
  }

  function requireModule(value, name) {
    if (!value) throw new Error(name + ' is unavailable');
    return value;
  }

  function isAbort(error) {
    return !!(error && (error.name === 'AbortError' || error.code === 'ABORT_ERR'));
  }

  function normalizePath(value) {
    return text(value).replace(/\\/g, '/').replace(/^\/+/, '');
  }

  function basename(path) {
    var parts = normalizePath(path).split('/');
    return parts[parts.length - 1] || '';
  }

  function rootName(path) {
    var parts = normalizePath(path).split('/').filter(Boolean);
    return parts.length ? parts[0] : '';
  }

  function filePath(file) {
    return normalizePath(file && (file.webkitRelativePath || file.relativePath || file.path || file.name));
  }

  async function readFile(file) {
    if (file && typeof file.text === 'function') return file.text();
    if (file && typeof file.arrayBuffer === 'function') return new TextDecoder().decode(new Uint8Array(await file.arrayBuffer()));
    if (file && file.content !== undefined) return text(file.content);
    if (file && file.data !== undefined) return text(file.data);
    throw new Error('File text reader is unavailable');
  }

  function fileArray(files) {
    return Array.prototype.slice.call(files || []).filter(Boolean);
  }

  function packageHash(sources) {
    return 'pkg:' + stableHash((sources || []).map(function(source) {
      return source.path + ':' + source.content.length + ':' + source.content;
    }).join('\n'));
  }

  function sourceFor(files, options) {
    var path = text(options.sourcePath || (files.length === 1 ? filePath(files[0]) : rootName(filePath(files[0]))));
    var name = text(options.sourceName || (files.length === 1 ? files[0].name : basename(path)));
    if (!path) path = 'email-import';
    if (!name) name = basename(path) || 'Email import';
    return {
      kind: files.length === 1 ? 'file' : 'folder',
      path: path,
      name: name,
      object: text(options.sourceObjectId || options.sourceObject || path || name)
    };
  }

  function unfoldHeaders(lines, session, sourceRef) {
    var out = [];
    var current = '';
    lines.forEach(function(line, index) {
      if (/^[ \t]/.test(line) && current) {
        current += ' ' + line.trim();
        return;
      }
      if (current) out.push(current);
      current = line;
      if (line && line.indexOf(':') === -1) {
        session.addWarning({
          code: 'EMAIL_MALFORMED_HEADER',
          message: 'Skipped malformed email header.',
          sourceRef: sourceRef + '#header-' + String(index),
          recoverable: true
        });
        current = '';
      }
    });
    if (current) out.push(current);
    return out;
  }

  function parseHeaderBlock(raw, session, sourceRef) {
    raw = text(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var lines = raw.split('\n');
    var headerLines = [];
    var bodyStart = 0;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] === '') {
        bodyStart = i + 1;
        break;
      }
      headerLines.push(lines[i]);
    }
    var headers = {};
    var rawHeaders = {};
    unfoldHeaders(headerLines, session, sourceRef).forEach(function(line) {
      var index = line.indexOf(':');
      if (index === -1) return;
      var name = line.slice(0, index).trim();
      var key = name.toLowerCase();
      var value = line.slice(index + 1).trim();
      if (!headers[key]) headers[key] = [];
      headers[key].push(value);
      rawHeaders[name] = value;
    });
    return {
      headers: headers,
      rawHeaders: rawHeaders,
      body: lines.slice(bodyStart).join('\n')
    };
  }

  function header(headers, name) {
    var values = headers[text(name).toLowerCase()] || [];
    return values.length ? values[0] : '';
  }

  function parseParams(value) {
    var parts = text(value).split(';');
    var out = { value: parts.shift().trim().toLowerCase(), params: {} };
    parts.forEach(function(part) {
      var index = part.indexOf('=');
      if (index === -1) return;
      var key = part.slice(0, index).trim().toLowerCase();
      var raw = part.slice(index + 1).trim();
      out.params[key] = raw.replace(/^"|"$/g, '');
    });
    return out;
  }

  function splitAddressList(value) {
    return text(value).split(',').map(function(row) {
      return row.trim();
    }).filter(Boolean);
  }

  function splitMessageIds(value) {
    var matches = text(value).match(/<[^>]+>/g);
    return matches ? matches.map(function(row) { return row.trim(); }) : text(value).split(/\s+/).filter(Boolean);
  }

  function labels(value) {
    return text(value).split(',').map(function(label) {
      return label.trim();
    }).filter(Boolean);
  }

  function decodeEntities(value) {
    return text(value)
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'");
  }

  function compactLines(value) {
    return text(value).split(/\n+/).map(function(line) {
      return line.replace(/[ \t]+/g, ' ').trim();
    }).filter(Boolean).join('\n');
  }

  function sanitizeHtml(html, session, sourceRef) {
    var original = text(html);
    var sanitized = original
      .replace(/<\s*(script|iframe|object|embed|style|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(script|iframe|object|embed|style|link|meta)[^>]*\/?\s*>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+(href|src)\s*=\s*("\s*(javascript:|data:)[^"]*"|'\s*(javascript:|data:)[^']*'|(?:javascript:|data:)[^\s>]+)/gi, '')
      .replace(/<\s*img[^>]*src\s*=\s*["']?https?:\/\/[^>]+>/gi, '');
    if (sanitized !== original) {
      session.addWarning({
        code: 'EMAIL_HTML_SANITIZED',
        message: 'Sanitized unsafe HTML email content.',
        sourceRef: sourceRef,
        recoverable: true
      });
    }
    sanitized = sanitized
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    return compactLines(decodeEntities(sanitized));
  }

  function splitMultipart(body, boundary) {
    var lines = text(body).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var parts = [];
    var current = [];
    var active = false;
    var delimiter = '--' + boundary;
    var end = delimiter + '--';
    lines.forEach(function(line) {
      if (line === delimiter || line === end) {
        if (active && current.length) parts.push(current.join('\n'));
        current = [];
        active = line !== end;
        return;
      }
      if (active) current.push(line);
    });
    return parts;
  }

  function decodeTransfer(body, encoding) {
    encoding = text(encoding).toLowerCase();
    body = text(body).replace(/^>From /gm, 'From ');
    if (encoding === 'quoted-printable') {
      return body.replace(/=\r?\n/g, '').replace(/=([0-9a-f]{2})/gi, function(_match, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      });
    }
    if (encoding === 'base64') {
      try {
        if (typeof atob !== 'undefined') return atob(body.replace(/\s+/g, ''));
        if (typeof Buffer !== 'undefined') return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
      } catch (error) {
        return body;
      }
    }
    return body;
  }

  function attachmentMeta(headers, body) {
    var disposition = parseParams(header(headers, 'content-disposition'));
    var contentType = parseParams(header(headers, 'content-type') || 'application/octet-stream');
    var filename = disposition.params.filename || contentType.params.name || '';
    return {
      filename: filename,
      contentType: contentType.value,
      contentId: header(headers, 'content-id'),
      size: text(body).replace(/\s+/g, '').length
    };
  }

  function parseEntity(raw, session, sourceRef) {
    var parsed = parseHeaderBlock(raw, session, sourceRef);
    var contentType = parseParams(header(parsed.headers, 'content-type') || 'text/plain');
    var disposition = parseParams(header(parsed.headers, 'content-disposition'));
    var encoding = header(parsed.headers, 'content-transfer-encoding');
    var result = { textParts: [], htmlParts: [], attachments: [] };

    if (contentType.value.indexOf('multipart/') === 0) {
      if (!contentType.params.boundary) {
        session.addWarning({
          code: 'EMAIL_MISSING_BOUNDARY',
          message: 'Multipart email is missing a boundary.',
          sourceRef: sourceRef,
          recoverable: true
        });
        return result;
      }
      splitMultipart(parsed.body, contentType.params.boundary).forEach(function(part, index) {
        var child = parseEntity(part, session, sourceRef + '/part-' + String(index));
        result.textParts = result.textParts.concat(child.textParts);
        result.htmlParts = result.htmlParts.concat(child.htmlParts);
        result.attachments = result.attachments.concat(child.attachments);
      });
      return result;
    }

    if (disposition.value === 'attachment' || disposition.params.filename || contentType.params.name) {
      result.attachments.push(attachmentMeta(parsed.headers, parsed.body));
      session.addWarning({
        code: 'EMAIL_ATTACHMENT_SKIPPED',
        message: 'Skipped binary email attachment payload.',
        sourceRef: sourceRef,
        recoverable: true
      });
      return result;
    }

    if (contentType.value === 'text/html') {
      result.htmlParts.push(sanitizeHtml(decodeTransfer(parsed.body, encoding), session, sourceRef));
      return result;
    }

    if (contentType.value === 'text/plain' || contentType.value === '') {
      result.textParts.push(compactLines(decodeTransfer(parsed.body, encoding)));
    }
    return result;
  }

  function splitMbox(content) {
    var lines = text(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var messages = [];
    var current = [];
    lines.forEach(function(line) {
      if (line.indexOf('From ') === 0) {
        if (current.length) messages.push(current.join('\n').replace(/\n+$/, ''));
        current = [];
        return;
      }
      current.push(line);
    });
    if (current.length) messages.push(current.join('\n').replace(/\n+$/, ''));
    return messages.filter(function(message) {
      return message.trim();
    });
  }

  function normalizeDate(value, importedAt, session, sourceRef) {
    var date = new Date(text(value));
    if (!value || Number.isNaN(date.getTime())) {
      session.addWarning({
        code: 'EMAIL_INVALID_DATE',
        message: 'Email date is missing or invalid.',
        sourceRef: sourceRef,
        recoverable: true
      });
      return importedAt;
    }
    return date.toISOString();
  }

  function subjectBase(value) {
    return text(value).replace(/^(\s*(re|fwd?)\s*:\s*)+/i, '').trim() || text(value).trim();
  }

  function parseMboxSource(source, session, importedAt) {
    var rawMessages = splitMbox(source.content);
    return rawMessages.map(function(raw, index) {
      var sourceRef = source.path + '#message-' + String(index);
      var parsed = parseHeaderBlock(raw, session, sourceRef);
      var entity = parseEntity(raw, session, sourceRef);
      var messageId = header(parsed.headers, 'message-id').trim();
      var date = header(parsed.headers, 'date');
      var attachments = entity.attachments;
      var body = (entity.textParts.length ? entity.textParts : entity.htmlParts).filter(Boolean).join('\n\n');
      attachments.forEach(function(attachment) {
        body += (body ? '\n' : '') + '[attachment: ' + text(attachment.filename || attachment.contentType || 'file') + ']';
      });
      return {
        raw: raw,
        sourcePath: source.path,
        sourceName: source.name,
        sourceIndex: index,
        sourceRef: sourceRef,
        headers: parsed.headers,
        rawHeaders: parsed.rawHeaders,
        messageId: messageId,
        normalizedId: messageId,
        date: date,
        timestamp: normalizeDate(date, importedAt, session, sourceRef),
        from: header(parsed.headers, 'from'),
        to: splitAddressList(header(parsed.headers, 'to')),
        cc: splitAddressList(header(parsed.headers, 'cc')),
        bcc: splitAddressList(header(parsed.headers, 'bcc')),
        subject: header(parsed.headers, 'subject') || 'Untitled email',
        labels: labels(header(parsed.headers, 'x-gmail-labels')),
        inReplyTo: splitMessageIds(header(parsed.headers, 'in-reply-to'))[0] || '',
        references: splitMessageIds(header(parsed.headers, 'references')),
        attachments: attachments,
        content: body || '[empty email body]'
      };
    });
  }

  function assignIds(messages, session) {
    var seen = {};
    var firstByMessageId = {};
    messages.forEach(function(message) {
      if (!message.messageId) {
        message.normalizedId = 'missing:' + stableHash(message.sourceRef + message.subject + message.content);
        return;
      }
      seen[message.messageId] = (seen[message.messageId] || 0) + 1;
      if (seen[message.messageId] === 1) {
        message.normalizedId = message.messageId;
        firstByMessageId[message.messageId] = message.normalizedId;
        return;
      }
      message.normalizedId = message.messageId + '#duplicate-' + String(seen[message.messageId]);
      session.addWarning({
        code: 'EMAIL_DUPLICATE_MESSAGE_ID',
        message: 'Disambiguated duplicate Message-ID.',
        sourceRef: message.sourceRef,
        recoverable: true
      });
    });
    return firstByMessageId;
  }

  function groupRoot(message, firstByMessageId) {
    for (var i = 0; i < message.references.length; i++) {
      if (firstByMessageId[message.references[i]]) return firstByMessageId[message.references[i]];
    }
    if (firstByMessageId[message.inReplyTo]) return firstByMessageId[message.inReplyTo];
    return message.normalizedId;
  }

  function scanMessages(messages, scanner) {
    if (!scanner || !scanner.scanMessage) return [];
    return messages.reduce(function(rows, message) {
      return rows.concat(scanner.scanMessage(message));
    }, []);
  }

  async function persist(result, dao) {
    if (!dao) return;
    for (var i = 0; i < result.chats.length; i++) {
      if (dao.putChat) await dao.putChat(result.chats[i]);
      if (dao.putMessages) await dao.putMessages(result.chats[i].chatId, result.messagesByChat[result.chats[i].chatId] || []);
    }
    if (dao.putOpenThreads && result.openThreads.length) await dao.putOpenThreads(result.openThreads);
    if (dao.putExtractionRun) await dao.putExtractionRun(result.run);
  }

  function patchRun(run, context, result) {
    run.threadCount = result.openThreads.length;
    run.metadata.packageHash = context.packageHash;
    run.metadata.chatIds = result.chats.map(function(chat) { return chat.chatId; });
    run.metadata.messageCount = result.messages.length;
    run.metadata.threadCount = result.openThreads.length;
    run.chatId = result.chats.length === 1 ? result.chats[0].chatId : ADAPTER_ID + ':package:' + idPart(context.packageHash);
    return run;
  }

  function sourceMessages(sources, session, importedAt) {
    var messages = [];
    sources.forEach(function(source) {
      messages = messages.concat(parseMboxSource(source, session, importedAt));
    });
    session.setTotal(messages.length);
    return messages;
  }

  async function readSources(files, session) {
    var sources = [];
    for (var i = 0; i < files.length; i++) {
      session.throwIfCancelled();
      var path = filePath(files[i]) || ('mailbox-' + String(i) + '.mbox');
      sources.push({
        path: path,
        name: files[i].name || basename(path),
        content: await readFile(files[i])
      });
      session.setPhase('read', { entry: path, entriesRead: i + 1, entriesTotal: files.length });
      await yieldTurn();
    }
    return sources;
  }

  function yieldTurn() {
    return new Promise(function(resolve) {
      setTimeout(resolve, 0);
    });
  }

  async function importFiles(options) {
    options = options || {};
    var files = fileArray(options.files || options.fileList || (options.file ? [options.file] : []));
    if (!files.length) throw new Error('No MBOX files selected');
    var sessionModule = requireModule(options.sessionModule || EmailImportSessionModule, 'ImportSession');
    var normalizer = requireModule(options.normalizer || EmailImportNormalizerModule, 'ImportNormalizer');
    var importedAt = options.importedAt || new Date().toISOString();
    var source = sourceFor(files, options);
    var session = sessionModule.create({
      adapterId: ADAPTER_ID,
      adapterVersion: ADAPTER_VERSION,
      sourceKind: source.kind,
      sourceObjectId: source.object,
      sourcePath: source.path,
      sourceName: source.name,
      importedAt: importedAt,
      signal: options.signal,
      onProgress: options.onProgress
    });
    var context = null;
    try {
      session.setPhase('read');
      var sources = await readSources(files, session);
      var hash = packageHash(sources);
      context = {
        importedAt: importedAt,
        packageHash: hash,
        runId: ['import', ADAPTER_ID, idPart(source.object || source.path), stableHash(hash + importedAt)].join(':'),
        source: source,
        scanner: options.scanner || EmailThreadScannerModule || null
      };
      session.setPhase('parse');
      var parsedMessages = sourceMessages(sources, session, importedAt);
      var firstByMessageId = assignIds(parsedMessages, session);
      var groups = {};
      session.setPhase('normalize');
      for (var i = 0; i < parsedMessages.length; i++) {
        session.throwIfCancelled();
        var parsed = parsedMessages[i];
        var root = groupRoot(parsed, firstByMessageId);
        if (!groups[root]) groups[root] = [];
        groups[root].push(parsed);
        session.recordParsed();
        if (i % 50 === 0) await yieldTurn();
      }

      var chats = [];
      var messagesByChat = {};
      Object.keys(groups).sort().forEach(function(root) {
        var rows = groups[root].sort(function(a, b) {
          return text(a.timestamp).localeCompare(text(b.timestamp)) || String(a.sourceIndex).localeCompare(String(b.sourceIndex));
        });
        var first = rows[0];
        var chatId = 'email:thread:' + idPart(root);
        var messages = rows.map(function(parsed, index) {
          var message = normalizer.createMessage({
            adapterId: ADAPTER_ID,
            adapterVersion: ADAPTER_VERSION,
            chatId: chatId,
            messageId: chatId + ':message:' + idPart(parsed.normalizedId),
            role: 'document',
            content: parsed.content,
            index: index,
            timestamp: parsed.timestamp,
            sourceKind: 'email-message',
            sourceObjectId: parsed.normalizedId,
            sourcePath: parsed.sourcePath,
            sourceName: parsed.sourceName,
            importedAt: importedAt,
            runId: context.runId,
            packageHash: hash,
            authorName: parsed.from,
            sourceTimestamp: parsed.date,
            provenance: {
              messageId: parsed.messageId,
              normalizedMessageId: parsed.normalizedId,
              from: parsed.from,
              to: parsed.to,
              cc: parsed.cc,
              bcc: parsed.bcc,
              subject: parsed.subject,
              date: parsed.date,
              inReplyTo: parsed.inReplyTo,
              references: parsed.references,
              labels: parsed.labels,
              mailboxPath: parsed.sourcePath,
              mailboxName: parsed.sourceName,
              sourceEntryPath: parsed.sourceRef,
              attachments: parsed.attachments
            }
          });
          session.recordImported();
          return message;
        });
        var chat = normalizer.createChat({
          adapterId: ADAPTER_ID,
          adapterVersion: ADAPTER_VERSION,
          chatId: chatId,
          title: subjectBase(first.subject) || 'Email thread',
          sourceKind: source.kind,
          sourceObjectId: root,
          sourcePath: source.path,
          sourceName: source.name,
          importedAt: importedAt,
          runId: context.runId,
          packageHash: hash,
          messageCount: messages.length,
          provenance: {
            threadRoot: root,
            subject: subjectBase(first.subject),
            labels: first.labels,
            mailboxPath: first.sourcePath,
            messageIds: rows.map(function(row) { return row.normalizedId; })
          }
        });
        chats.push(chat);
        messagesByChat[chatId] = messages;
        session.completeSnapshot(chatId);
      });
      var messages = [];
      chats.forEach(function(chat) {
        messages = messages.concat(messagesByChat[chat.chatId] || []);
      });
      var result = {
        chats: chats,
        chat: chats[0] || null,
        messages: messages,
        messagesByChat: messagesByChat,
        openThreads: scanMessages(messages, context.scanner),
        run: null,
        cancelled: false
      };
      result.run = patchRun(session.finish('done'), context, result);
      await persist(result, options.dao || null);
      return result;
    } catch (error) {
      if (!isAbort(error)) {
        session.addError({
          code: 'EMAIL_IMPORT_ERROR',
          message: error.message || String(error),
          sourceRef: source.path || source.name,
          recoverable: false
        });
      }
      var failed = {
        chats: [],
        chat: null,
        messages: [],
        messagesByChat: {},
        openThreads: [],
        run: session.finish(isAbort(error) ? 'cancelled' : 'error'),
        cancelled: isAbort(error),
        error: error
      };
      if (context) patchRun(failed.run, context, failed);
      if (options.dao && options.dao.putExtractionRun) await options.dao.putExtractionRun(failed.run);
      if (isAbort(error)) return failed;
      throw error;
    }
  }

  return {
    ADAPTER_ID: ADAPTER_ID,
    ADAPTER_VERSION: ADAPTER_VERSION,
    splitMbox: splitMbox,
    importFiles: importFiles,
    importFile: function(options) {
      options = options || {};
      return importFiles(Object.assign({}, options, { files: [options.file] }));
    }
  };
})();

if (typeof module !== 'undefined') module.exports = EmailImporter;
