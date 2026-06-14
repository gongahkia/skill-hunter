var ThreadScanner = (function() {
  var TAGS = ['TODO', 'FIXME', 'REV', 'REF', 'FOLLOWUP', 'UNRESOLVED', 'PROMPT'];
  var TAG_PATTERN = new RegExp('^\\s*(' + TAGS.join('|') + ')\\s*:\\s*(.+)$', 'i');

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

  function scanMessage(message) {
    message = message || {};
    var id = messageId(message);
    var rows = [];
    var lines = text(message.content).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var match = TAG_PATTERN.exec(lines[i]);
      if (!match) continue;
      var body = match[2].trim();
      if (!body) continue;
      var tag = match[1].toUpperCase();
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
    scanMessage: scanMessage
  };
})();

if (typeof module !== 'undefined') module.exports = ThreadScanner;
