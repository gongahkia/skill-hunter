var ThreadScanner = (function() {
  var TAGS = ['TODO', 'FIXME', 'REV', 'REF', 'FOLLOWUP', 'UNRESOLVED', 'PROMPT'];

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function messageId(message) {
    return text(message.messageId || message.id);
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

  function normalizeTagName(value) {
    return text(value).trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function normalizeCustomTags(customTags) {
    var seen = {};
    var result = [];
    (Array.isArray(customTags) ? customTags : []).forEach(function(entry) {
      var tag = normalizeTagName(entry && typeof entry === 'object' ? entry.tag : entry);
      if (!tag || seen[tag] || TAGS.indexOf(tag) !== -1) return;
      seen[tag] = true;
      result.push(tag);
    });
    return result;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function tagPattern(customTags) {
    return new RegExp('^\\s*(' + TAGS.concat(normalizeCustomTags(customTags)).map(escapeRegExp).join('|') + ')\\s*:\\s*(.+)$', 'i');
  }

  function scanMessage(message, options) {
    message = message || {};
    options = options || {};
    var id = messageId(message);
    var rows = [];
    var lines = text(message.content).split(/\r?\n/);
    var pattern = tagPattern(options.customTags);
    for (var i = 0; i < lines.length; i++) {
      var match = pattern.exec(lines[i]);
      if (!match) continue;
      var body = match[2].trim();
      if (!body) continue;
      var tag = normalizeTagName(match[1]);
      rows.push({
        threadId: ['scan', idPart(message.chatId), idPart(id), String(i), tag, stableHash(body)].join(':'),
        chatId: text(message.chatId),
        messageId: id,
        tag: tag,
        text: body,
        source: 'explicit',
        subSource: 'scan',
        status: 'open',
        createdAt: text(message.timestamp)
      });
    }
    return rows;
  }

  return {
    TAGS: TAGS.slice(),
    normalizeTagName: normalizeTagName,
    normalizeCustomTags: normalizeCustomTags,
    scanMessage: scanMessage
  };
})();

if (typeof module !== 'undefined') module.exports = ThreadScanner;
