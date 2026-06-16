var FormatConverter = {
  _text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  },
  _oneLine(value) {
    return this._text(value).replace(/\s+/g, ' ').trim();
  },
  _roleLabel(role) {
    role = this._oneLine(role || 'unknown').toLowerCase();
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Unknown';
  },
  _messageId(message) {
    return this._text(message.messageId || message.id || '');
  },
  _chatTitle(envelope) {
    return this._oneLine(envelope.chatTitle || envelope.title || 'Untitled Conversation') || 'Untitled Conversation';
  },
  _appendMeta(lines, label, value) {
    value = this._oneLine(value);
    if (value) lines.push('- ' + label + ': ' + value);
  },
  _escapeCSV(s) {
    return '"' + String(s).replace(/"/g, '""') + '"';
  },
  _msgFields: ['role', 'content', 'id', 'timestamp', 'model', 'platform', 'index'],
  toJSON(envelope) {
    return JSON.stringify(envelope, null, 2);
  },
  toCSV(envelope) {
    var headers = this._msgFields.join(',');
    var rows = envelope.messages.map(function(m) {
      return FormatConverter._msgFields.map(function(f) {
        return FormatConverter._escapeCSV(String(m[f] != null ? m[f] : ''));
      }).join(',');
    });
    return [headers].concat(rows).join('\n');
  },
  toTSV(envelope) {
    var headers = this._msgFields.join('\t');
    var rows = envelope.messages.map(function(m) {
      return FormatConverter._msgFields.map(function(f) {
        return String(m[f] != null ? m[f] : '').replace(/\t/g, ' ').replace(/\n/g, ' ');
      }).join('\t');
    });
    return [headers].concat(rows).join('\n');
  },
  toMarkdown(envelope) {
    envelope = envelope || {};
    var messages = Array.isArray(envelope.messages) ? envelope.messages : [];
    var lines = [];
    var title = this._chatTitle(envelope);
    lines.push('# ' + title);
    lines.push('');
    this._appendMeta(lines, 'Chat ID', envelope.chatId);
    this._appendMeta(lines, 'Platform', envelope.platform || 'unknown');
    this._appendMeta(lines, 'Model', envelope.model);
    this._appendMeta(lines, 'Source', envelope.url || envelope.sourceUrl);
    this._appendMeta(lines, 'Exported', envelope.exportedAt || envelope.capturedAt);
    this._appendMeta(lines, 'Updated', envelope.lastUpdatedAt);
    lines.push('- Message count: ' + (typeof envelope.messageCount === 'number' ? envelope.messageCount : messages.length));
    lines.push('');

    for (var i = 0; i < messages.length; i++) {
      var m = messages[i] || {};
      lines.push('## ' + this._roleLabel(m.role));
      var meta = [];
      if (m.timestamp) meta.push(this._text(m.timestamp));
      var messageId = this._messageId(m);
      if (messageId) meta.push(messageId);
      if (meta.length) lines.push('`' + meta.join(' | ') + '`');
      lines.push('');
      lines.push(this._text(m.content).trim() || '(empty)');
      lines.push('');
    }
    return lines.join('\n').trim() + '\n';
  },
  toMarkdownBulk(chats) {
    if (!Array.isArray(chats)) throw new Error('chats must be an array');
    return chats.map(function(chat) {
      return FormatConverter.toMarkdown(chat).trim();
    }).join('\n\n---\n\n') + '\n';
  },
  toPDF() {
    throw new Error('not implemented — see M6');
  },
  toHTML() {
    throw new Error('not implemented — see M6');
  },
  formats: {
    csv:     { mime: 'text/csv',                  ext: 'csv' },
    tsv:     { mime: 'text/tab-separated-values', ext: 'tsv' },
    json:    { mime: 'application/json',           ext: 'json' },
    markdown:{ mime: 'text/markdown',              ext: 'md' },
    pdf:     { mime: 'application/pdf',            ext: 'pdf' },
    html:    { mime: 'text/html',                  ext: 'html' }
  },
  convert(format, envelope) {
    var methodMap = {
      csv: 'toCSV', tsv: 'toTSV', json: 'toJSON', markdown: 'toMarkdown',
      pdf: 'toPDF', html: 'toHTML'
    };
    var method = methodMap[format];
    if (!method || !this[method]) throw new Error('Unsupported format: ' + format);
    return this[method](envelope);
  }
};
if (typeof module !== 'undefined') module.exports = FormatConverter;
