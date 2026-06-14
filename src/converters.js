var FormatConverter = {
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
    var lines = [];
    var title = envelope.chatTitle || 'Untitled Conversation';
    lines.push('# ' + title);
    lines.push('');
    lines.push('- Export version: ' + (envelope.exportVersion || '2.0'));
    lines.push('- Exported at: ' + (envelope.exportedAt || ''));
    lines.push('- Platform: ' + (envelope.platform || 'unknown'));
    lines.push('- Model: ' + (envelope.model || ''));
    lines.push('- Message count: ' + (typeof envelope.messageCount === 'number' ? envelope.messageCount : (envelope.messages || []).length));
    lines.push('');

    for (var i = 0; i < envelope.messages.length; i++) {
      var m = envelope.messages[i];
      lines.push('## ' + String(m.role || 'unknown').toUpperCase());
      if (m.timestamp) lines.push('`' + m.timestamp + '`');
      lines.push('');
      lines.push(m.content || '');
      lines.push('');
    }
    return lines.join('\n').trim() + '\n';
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
