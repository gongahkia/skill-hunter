var ChatExportImportSessionModule = (typeof ImportSession !== 'undefined') ? ImportSession : null;
var ChatExportImportNormalizerModule = (typeof ImportNormalizer !== 'undefined') ? ImportNormalizer : null;
var ChatExportThreadScannerModule = (typeof ThreadScanner !== 'undefined') ? ThreadScanner : null;
var ChatExportZipWriterModule = (typeof ZipWriter !== 'undefined') ? ZipWriter : null;
if (!ChatExportImportSessionModule && typeof require !== 'undefined') {
  ChatExportImportSessionModule = require('./session.js');
}
if (!ChatExportImportNormalizerModule && typeof require !== 'undefined') {
  ChatExportImportNormalizerModule = require('./normalizer.js');
}
if (!ChatExportZipWriterModule && typeof require !== 'undefined') {
  ChatExportZipWriterModule = require('../zip.js');
}

var ChatExportImporter = (function() {
  var ADAPTER_VERSION = 'v1';
  var SLACK_ADAPTER_ID = 'slack';
  var DISCORD_ADAPTER_ID = 'discord';

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

  function normalizePath(value) {
    return text(value).replace(/\\/g, '/').replace(/^\/+/, '');
  }

  function basename(path) {
    var parts = normalizePath(path).split('/');
    return parts[parts.length - 1] || '';
  }

  function dirname(path) {
    var parts = normalizePath(path).split('/');
    parts.pop();
    return parts.join('/');
  }

  function rootName(path) {
    var parts = normalizePath(path).split('/').filter(Boolean);
    return parts.length ? parts[0] : '';
  }

  function requireModule(value, name) {
    if (!value) throw new Error(name + ' is unavailable');
    return value;
  }

  function isAbort(error) {
    return !!(error && (error.name === 'AbortError' || error.code === 'ABORT_ERR'));
  }

  function toBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return new TextEncoder().encode(text(value));
  }

  function decode(bytes) {
    return new TextDecoder().decode(toBytes(bytes));
  }

  function packageHash(entries) {
    var hash = 5381;
    Object.keys(entries).sort().forEach(function(name) {
      var bytes = toBytes(entries[name]);
      var token = name + ':' + String(bytes.length) + ':';
      for (var i = 0; i < token.length; i++) hash = ((hash << 5) + hash) ^ token.charCodeAt(i);
      for (var j = 0; j < bytes.length; j++) hash = ((hash << 5) + hash) ^ bytes[j];
    });
    return 'pkg:' + (hash >>> 0).toString(36);
  }

  function runId(adapterId, source, hash, importedAt) {
    return ['import', idPart(adapterId), idPart(source.object || source.path || source.name || 'export'), stableHash(hash + importedAt)].join(':');
  }

  function filePath(file) {
    return normalizePath(file && (file.webkitRelativePath || file.relativePath || file.path || file.name));
  }

  async function fileBytes(file) {
    if (file && typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
    if (file && typeof file.text === 'function') return toBytes(await file.text());
    if (file && file.content !== undefined) return toBytes(file.content);
    if (file && file.data !== undefined) return toBytes(file.data);
    throw new Error('File reader is unavailable');
  }

  function normalizeEntryMap(entries) {
    var out = {};
    Object.keys(entries || {}).forEach(function(name) {
      out[normalizePath(name)] = toBytes(entries[name]);
    });
    return out;
  }

  async function entriesFromFiles(files, session) {
    var out = {};
    files = Array.prototype.slice.call(files || []).filter(Boolean);
    for (var i = 0; i < files.length; i++) {
      session.throwIfCancelled();
      var path = filePath(files[i]);
      if (!path) continue;
      out[path] = await fileBytes(files[i]);
      session.setPhase('read', { entry: path, entriesRead: i + 1, entriesTotal: files.length });
      await yieldTurn();
    }
    return out;
  }

  async function entriesFromZip(input, session, zipModule, signal) {
    var out = {};
    var total = 0;
    for await (var entry of zipModule.entries(input, {
      signal: signal,
      onEntry: function(row) {
        total = row.total || total;
      }
    })) {
      session.throwIfCancelled();
      if (!/\/$/.test(entry.name) && !/^__MACOSX\//.test(entry.name)) out[normalizePath(entry.name)] = entry.data;
      session.setPhase('read', { entry: entry.name, entriesRead: entry.index + 1, entriesTotal: total || entry.total || 0 });
    }
    return out;
  }

  async function collectEntries(options, session, zipModule) {
    if (options.entries) return normalizeEntryMap(options.entries);
    if (options.zip || options.zipFile || options.file) {
      var zip = options.zip || options.zipFile || options.file;
      if (!zipModule || !zipModule.entries) throw new Error('ZIP reader is unavailable');
      return entriesFromZip(zip, session, zipModule, options.signal);
    }
    return entriesFromFiles(options.files || options.fileList, session);
  }

  function sourceFor(options, adapterId) {
    var file = options.zip || options.zipFile || options.file || null;
    var files = Array.prototype.slice.call(options.files || options.fileList || []);
    var path = text(options.sourcePath || (file && filePath(file)) || '');
    var name = text(options.sourceName || (file && file.name) || '');
    if (!path && files.length) path = rootName(filePath(files[0])) || adapterId + '-export-folder';
    if (!name) name = basename(path) || adapterId + '-export';
    return {
      kind: file ? 'zip' : 'folder',
      path: path,
      name: name,
      object: text(options.sourceObjectId || options.sourceObject || path || name)
    };
  }

  function findEntry(entries, names) {
    var wanted = {};
    names.forEach(function(name) {
      wanted[name] = true;
    });
    var keys = Object.keys(entries).sort();
    for (var i = 0; i < keys.length; i++) {
      for (var j = 0; j < names.length; j++) {
        if (keys[i] === names[j] || keys[i].slice(-(names[j].length + 1)) === '/' + names[j]) return keys[i];
      }
      if (wanted[basename(keys[i])]) return keys[i];
    }
    return '';
  }

  function parseJson(entries, path, session, code) {
    if (!path || !entries[path]) return null;
    try {
      return JSON.parse(decode(entries[path]));
    } catch (error) {
      session.recordSkipped();
      session.skipSource(path);
      session.addWarning({
        code: code,
        message: 'Skipped malformed JSON entry.',
        sourceRef: path,
        recoverable: true
      });
      return null;
    }
  }

  function parseJsonArray(entries, path, session, code) {
    var value = parseJson(entries, path, session, code);
    if (value === null) return null;
    if (Array.isArray(value)) return value;
    session.recordSkipped();
    session.skipSource(path);
    session.addWarning({
      code: code,
      message: 'Skipped JSON entry that is not an array.',
      sourceRef: path,
      recoverable: true
    });
    return null;
  }

  function arrayById(rows) {
    var byId = {};
    (Array.isArray(rows) ? rows : []).forEach(function(row) {
      if (row && row.id) byId[text(row.id)] = row;
    });
    return byId;
  }

  function userDisplay(user) {
    user = user || {};
    var profile = user.profile || {};
    return text(profile.display_name || profile.real_name || user.real_name || user.name || user.username || user.id);
  }

  function slackUserMap(users) {
    var map = {};
    (Array.isArray(users) ? users : []).forEach(function(user) {
      if (!user || !user.id) return;
      map[text(user.id)] = {
        id: text(user.id),
        name: userDisplay(user),
        handle: text(user.name || user.username),
        deleted: !!user.deleted,
        isBot: !!user.is_bot
      };
    });
    return map;
  }

  function slackConversationType(row) {
    if (!row) return 'channel';
    if (row.is_im) return 'dm';
    if (row.is_mpim) return 'group_dm';
    if (row.is_group || row.is_private) return 'private_channel';
    return 'channel';
  }

  function slackMessagePaths(entries) {
    return Object.keys(entries).filter(function(path) {
      return /(^|\/)[^/]+\/\d{4}-\d{2}-\d{2}\.json$/.test(path);
    }).sort();
  }

  function slackChannelKey(path) {
    var parts = normalizePath(path).split('/');
    return parts.length >= 2 ? parts[parts.length - 2] : 'unknown';
  }

  function slackTimestamp(ts) {
    var value = Number(text(ts).replace('.', ''));
    var seconds = Number(text(ts).split('.')[0]);
    if (!Number.isFinite(seconds)) return '';
    return new Date(seconds * 1000).toISOString();
  }

  function slackFiles(files) {
    return (Array.isArray(files) ? files : []).map(function(file) {
      return {
        id: text(file.id),
        name: text(file.name || file.title),
        mimetype: text(file.mimetype || file.filetype),
        url: text(file.permalink || file.url_private || file.url_private_download || file.url)
      };
    }).filter(function(file) {
      return file.name || file.url || file.id;
    });
  }

  function slackContent(row) {
    var parts = [];
    if (row.text) parts.push(text(row.text));
    slackFiles(row.files).forEach(function(file) {
      parts.push('[file: ' + text(file.name || file.url || file.id || 'attachment') + ']');
    });
    return parts.join('\n').trim();
  }

  function discordAttachmentRows(attachments) {
    return (Array.isArray(attachments) ? attachments : []).map(function(attachment) {
      return {
        id: text(attachment.id),
        filename: text(attachment.filename || attachment.name),
        url: text(attachment.url),
        contentType: text(attachment.content_type || attachment.contentType)
      };
    }).filter(function(attachment) {
      return attachment.filename || attachment.url || attachment.id;
    });
  }

  function discordContent(row) {
    var parts = [];
    if (row.content) parts.push(text(row.content));
    discordAttachmentRows(row.attachments).forEach(function(attachment) {
      parts.push('[attachment: ' + text(attachment.filename || attachment.url || attachment.id || 'file') + ']');
    });
    return parts.join('\n').trim();
  }

  function discordMessagePaths(entries) {
    return Object.keys(entries).filter(function(path) {
      return /(^|\/)messages\/c[^/]+\/messages\.json$/.test(path);
    }).sort();
  }

  function relatedDiscordPath(messagePath, file) {
    return dirname(messagePath) + '/' + file;
  }

  function indexByChannel(rows) {
    var byId = {};
    (Array.isArray(rows) ? rows : []).forEach(function(row) {
      if (row && row.id) byId[text(row.id)] = row;
    });
    return byId;
  }

  function serverMap(current, recent) {
    var out = {};
    [current, recent].forEach(function(rows) {
      (Array.isArray(rows) ? rows : []).forEach(function(server) {
        if (server && server.id && !out[text(server.id)]) out[text(server.id)] = server;
      });
    });
    return out;
  }

  function yieldTurn() {
    return new Promise(function(resolve) {
      setTimeout(resolve, 0);
    });
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
    run.chatId = result.chats.length === 1 ? result.chats[0].chatId : context.adapterId + ':package:' + idPart(context.packageHash);
    return run;
  }

  function makeResult(context, chats, messagesByChat) {
    var messages = [];
    chats.forEach(function(chat) {
      messages = messages.concat(messagesByChat[chat.chatId] || []);
    });
    var openThreads = scanMessages(messages, context.scanner);
    return {
      chats: chats,
      chat: chats[0] || null,
      messages: messages,
      messagesByChat: messagesByChat,
      openThreads: openThreads,
      run: null,
      cancelled: false
    };
  }

  async function normalizeSlack(entries, context) {
    var session = context.session;
    var normalizer = context.normalizer;
    var manifest = parseJson(entries, findEntry(entries, ['manifest.json']), session, 'SLACK_MALFORMED_JSON') || {};
    var channels = [];
    ['channels.json', 'groups.json', 'dms.json', 'mpims.json'].forEach(function(name) {
      var path = findEntry(entries, [name]);
      var rows = path ? parseJsonArray(entries, path, session, 'SLACK_MALFORMED_JSON') : null;
      if (rows) channels = channels.concat(rows);
    });
    var users = parseJsonArray(entries, findEntry(entries, ['users.json']), session, 'SLACK_MALFORMED_JSON') || [];
    var usersById = slackUserMap(users);
    var channelsByName = {};
    var channelsById = {};
    channels.forEach(function(channel) {
      if (!channel) return;
      if (channel.name) channelsByName[text(channel.name)] = channel;
      if (channel.id) channelsById[text(channel.id)] = channel;
    });
    var workspace = manifest.workspace || {};
    var workspaceId = text(workspace.id || (users[0] && users[0].team_id) || 'workspace');
    var workspaceName = text(workspace.name || manifest.workspace_name || 'Slack workspace');
    if (Array.isArray(manifest.missing)) {
      manifest.missing.forEach(function(name) {
        session.addWarning({
          code: 'SLACK_EXPORT_SCOPE_MISSING',
          message: 'Slack export does not include ' + name + '.',
          sourceRef: 'manifest.json',
          recoverable: true
        });
      });
    }

    var groups = {};
    slackMessagePaths(entries).forEach(function(path) {
      var channelKey = slackChannelKey(path);
      var channel = channelsByName[channelKey] || channelsById[channelKey] || { id: channelKey, name: channelKey };
      var messages = parseJsonArray(entries, path, session, 'SLACK_MALFORMED_JSON');
      if (!messages) return;
      var key = text(channel.id || channel.name || channelKey);
      if (!groups[key]) groups[key] = { channel: channel, rows: [] };
      messages.forEach(function(message, index) {
        groups[key].rows.push({ sourcePath: path, row: message, sourceIndex: index });
      });
    });

    var total = Object.keys(groups).reduce(function(sum, key) {
      return sum + groups[key].rows.length;
    }, 0);
    session.setTotal(total);
    session.setPhase('normalize');

    var chats = [];
    var messagesByChat = {};
    var groupKeys = Object.keys(groups).sort();
    for (var i = 0; i < groupKeys.length; i++) {
      var group = groups[groupKeys[i]];
      group.rows.sort(function(a, b) {
        return text(a.row.ts).localeCompare(text(b.row.ts)) || a.sourcePath.localeCompare(b.sourcePath);
      });
      var channelId = text(group.channel.id || group.channel.name || groupKeys[i]);
      var channelName = text(group.channel.name || channelId);
      var channelType = slackConversationType(group.channel);
      var chatId = 'slack:workspace:' + idPart(workspaceId) + ':conversation:' + idPart(channelId);
      var rows = [];
      for (var j = 0; j < group.rows.length; j++) {
        session.throwIfCancelled();
        var item = group.rows[j];
        var row = item.row || {};
        var content = slackContent(row);
        if (!row.ts || !content) {
          session.recordSkipped();
          session.skipSource(item.sourcePath + '#' + text(row.ts || item.sourceIndex));
          session.addWarning({
            code: 'SLACK_MALFORMED_MESSAGE',
            message: 'Skipped Slack message without timestamp or content.',
            sourceRef: item.sourcePath,
            recoverable: true
          });
          continue;
        }
        var userId = text(row.user || row.bot_id || row.username);
        var user = usersById[userId] || { id: userId, name: text(row.username || row.bot_id || userId) };
        var threadTs = text(row.thread_ts || row.ts);
        session.recordParsed();
        rows.push(normalizer.createMessage({
          adapterId: SLACK_ADAPTER_ID,
          adapterVersion: ADAPTER_VERSION,
          chatId: chatId,
          messageId: chatId + ':message:' + idPart(row.ts),
          role: 'user',
          content: content,
          index: rows.length,
          timestamp: slackTimestamp(row.ts) || context.importedAt,
          sourceKind: 'slack-message',
          sourceObjectId: row.ts,
          sourcePath: item.sourcePath,
          sourceName: context.source.name,
          importedAt: context.importedAt,
          runId: context.runId,
          packageHash: context.packageHash,
          authorId: userId,
          authorName: user.name,
          sourceTimestamp: slackTimestamp(row.ts),
          provenance: {
            workspaceId: workspaceId,
            workspaceName: workspaceName,
            channelId: channelId,
            channelName: channelName,
            channelType: channelType,
            threadTs: threadTs,
            threadId: threadTs ? chatId + ':thread:' + idPart(threadTs) : '',
            messageTs: text(row.ts),
            userId: userId,
            userName: user.name,
            sourceEntryPath: item.sourcePath,
            files: slackFiles(row.files),
            reactions: Array.isArray(row.reactions) ? row.reactions : []
          }
        }));
        session.recordImported();
        if (rows.length % 50 === 0) await yieldTurn();
      }
      var chat = normalizer.createChat({
        adapterId: SLACK_ADAPTER_ID,
        adapterVersion: ADAPTER_VERSION,
        chatId: chatId,
        title: 'Slack / ' + workspaceName + ' / #' + channelName,
        sourceKind: context.source.kind,
        sourceObjectId: workspaceId + ':' + channelId,
        sourcePath: context.source.path,
        sourceName: context.source.name,
        importedAt: context.importedAt,
        runId: context.runId,
        packageHash: context.packageHash,
        messageCount: rows.length,
        provenance: {
          workspaceId: workspaceId,
          workspaceName: workspaceName,
          channelId: channelId,
          channelName: channelName,
          channelType: channelType,
          userMap: usersById
        }
      });
      chats.push(chat);
      messagesByChat[chatId] = rows;
      session.completeSnapshot(chatId);
    }
    return makeResult(context, chats, messagesByChat);
  }

  async function normalizeDiscord(entries, context) {
    var session = context.session;
    var normalizer = context.normalizer;
    var pkg = parseJson(entries, findEntry(entries, ['package.json']), session, 'DISCORD_MALFORMED_JSON') || {};
    var index = parseJson(entries, findEntry(entries, ['messages/index.json', 'index.json']), session, 'DISCORD_MALFORMED_JSON') || {};
    var currentServers = parseJsonArray(entries, findEntry(entries, ['servers/current.json']), session, 'DISCORD_MALFORMED_JSON') || [];
    var recentServers = parseJsonArray(entries, findEntry(entries, ['servers/recent.json']), session, 'DISCORD_MALFORMED_JSON') || [];
    var indexedChannels = indexByChannel(index.channels || []);
    var serversById = serverMap(currentServers, recentServers);
    var messagePaths = discordMessagePaths(entries);
    var groups = [];

    messagePaths.forEach(function(path) {
      var messages = parseJsonArray(entries, path, session, 'DISCORD_MALFORMED_JSON');
      if (!messages) return;
      var channelPath = relatedDiscordPath(path, 'channel.json');
      var channel = parseJson(entries, channelPath, session, 'DISCORD_MALFORMED_JSON') || {};
      channel = Object.assign({}, indexedChannels[text(channel.id)] || indexedChannels[text(channel.id || '').replace(/^c/, '')] || {}, channel);
      groups.push({ path: path, channel: channel, rows: messages });
    });

    var total = groups.reduce(function(sum, group) {
      return sum + group.rows.length;
    }, 0);
    session.setTotal(total);
    session.setPhase('normalize');

    var chats = [];
    var messagesByChat = {};
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      var channelId = text(group.channel.id || basename(dirname(group.path)).replace(/^c/, ''));
      var channelType = text(group.channel.type || 'unknown');
      var server = serversById[text(group.channel.guild_id)] || null;
      var serverId = server ? text(server.id) : text(group.channel.guild_id);
      var serverName = server ? text(server.name) : '';
      var channelName = text(group.channel.name);
      if (!channelName && channelType === 'dm' && Array.isArray(group.channel.recipients)) channelName = group.channel.recipients.map(userDisplay).filter(Boolean).join(', ');
      if (!channelName) channelName = channelId;
      var chatId = 'discord:channel:' + idPart(channelId);
      var title = channelType === 'guild_text'
        ? 'Discord / ' + text(serverName || 'Server') + ' / #' + channelName
        : channelType === 'group_dm'
          ? 'Discord / Group DM / ' + channelName
          : 'Discord / DM / ' + channelName;
      var rows = group.rows.slice().sort(function(a, b) {
        return text(a.timestamp).localeCompare(text(b.timestamp)) || text(a.id).localeCompare(text(b.id));
      });
      var messages = [];
      for (var j = 0; j < rows.length; j++) {
        session.throwIfCancelled();
        var row = rows[j] || {};
        var content = discordContent(row);
        if (!row.id || !content) {
          session.recordSkipped();
          session.skipSource(group.path + '#' + text(row.id || j));
          session.addWarning({
            code: 'DISCORD_MALFORMED_MESSAGE',
            message: 'Skipped Discord message without ID or content.',
            sourceRef: group.path,
            recoverable: true
          });
          continue;
        }
        var author = row.author || {};
        var attachments = discordAttachmentRows(row.attachments);
        session.recordParsed();
        messages.push(normalizer.createMessage({
          adapterId: DISCORD_ADAPTER_ID,
          adapterVersion: ADAPTER_VERSION,
          chatId: chatId,
          messageId: chatId + ':message:' + idPart(row.id),
          role: 'user',
          content: content,
          index: messages.length,
          timestamp: text(row.timestamp || context.importedAt),
          sourceKind: 'discord-message',
          sourceObjectId: row.id,
          sourcePath: group.path,
          sourceName: context.source.name,
          importedAt: context.importedAt,
          runId: context.runId,
          packageHash: context.packageHash,
          authorId: author.id,
          authorName: author.username || author.global_name,
          sourceTimestamp: row.timestamp,
          provenance: {
            serverId: serverId,
            serverName: serverName,
            channelId: channelId,
            channelName: channelName,
            channelType: channelType,
            messageId: text(row.id),
            authorId: text(author.id),
            authorName: text(author.username || author.global_name || author.id),
            authorDeleted: !!author.deleted,
            timestamp: text(row.timestamp),
            attachmentUrls: attachments.map(function(attachment) { return attachment.url; }).filter(Boolean),
            attachmentFilenames: attachments.map(function(attachment) { return attachment.filename; }).filter(Boolean),
            attachments: attachments,
            sourceEntryPath: group.path
          }
        }));
        session.recordImported();
        if (messages.length % 50 === 0) await yieldTurn();
      }
      var chat = normalizer.createChat({
        adapterId: DISCORD_ADAPTER_ID,
        adapterVersion: ADAPTER_VERSION,
        chatId: chatId,
        title: title,
        sourceKind: context.source.kind,
        sourceObjectId: channelId,
        sourcePath: context.source.path,
        sourceName: context.source.name,
        importedAt: context.importedAt,
        runId: context.runId,
        packageHash: context.packageHash,
        messageCount: messages.length,
        provenance: {
          accountId: text(pkg.account && pkg.account.id),
          accountUsername: text(pkg.account && pkg.account.username),
          serverId: serverId,
          serverName: serverName,
          channelId: channelId,
          channelName: channelName,
          channelType: channelType,
          recipients: Array.isArray(group.channel.recipients) ? group.channel.recipients : []
        }
      });
      chats.push(chat);
      messagesByChat[chatId] = messages;
      session.completeSnapshot(chatId);
    }
    return makeResult(context, chats, messagesByChat);
  }

  async function importPackage(adapterId, options) {
    options = options || {};
    var sessionModule = requireModule(options.sessionModule || ChatExportImportSessionModule, 'ImportSession');
    var normalizer = requireModule(options.normalizer || ChatExportImportNormalizerModule, 'ImportNormalizer');
    var zipModule = options.zipModule || ChatExportZipWriterModule || null;
    var importedAt = options.importedAt || new Date().toISOString();
    var source = sourceFor(options, adapterId);
    var session = sessionModule.create({
      adapterId: adapterId,
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
      var entries = await collectEntries(options, session, zipModule);
      if (!Object.keys(entries).length) throw new Error('No export entries selected');
      var hash = packageHash(entries);
      context = {
        adapterId: adapterId,
        importedAt: importedAt,
        packageHash: hash,
        runId: runId(adapterId, source, hash, importedAt),
        source: source,
        session: session,
        normalizer: normalizer,
        scanner: options.scanner || ChatExportThreadScannerModule || null
      };
      var result = adapterId === SLACK_ADAPTER_ID ? await normalizeSlack(entries, context) : await normalizeDiscord(entries, context);
      result.run = patchRun(session.finish('done'), context, result);
      await persist(result, options.dao || null);
      return result;
    } catch (error) {
      if (!isAbort(error)) {
        session.addError({
          code: adapterId.toUpperCase().replace(/-/g, '_') + '_IMPORT_ERROR',
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

  function importSlack(options) {
    return importPackage(SLACK_ADAPTER_ID, options || {});
  }

  function importDiscord(options) {
    return importPackage(DISCORD_ADAPTER_ID, options || {});
  }

  function importExport(options) {
    options = options || {};
    var adapterId = text(options.adapterId || options.adapter);
    if (adapterId === SLACK_ADAPTER_ID) return importSlack(options);
    if (adapterId === DISCORD_ADAPTER_ID) return importDiscord(options);
    throw new Error('Unsupported chat export adapter');
  }

  return {
    ADAPTER_VERSION: ADAPTER_VERSION,
    SLACK_ADAPTER_ID: SLACK_ADAPTER_ID,
    DISCORD_ADAPTER_ID: DISCORD_ADAPTER_ID,
    importExport: importExport,
    importSlack: importSlack,
    importDiscord: importDiscord,
    readEntries: collectEntries
  };
})();

if (typeof module !== 'undefined') module.exports = ChatExportImporter;
