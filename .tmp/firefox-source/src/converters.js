var FormatConverter = {
  _escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
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
  toNDJSON(envelope) {
    var meta = {
      exportVersion: envelope.exportVersion,
      exportedAt: envelope.exportedAt,
      platform: envelope.platform,
      chatTitle: envelope.chatTitle,
      model: envelope.model,
      messageCount: envelope.messageCount
    };
    return [JSON.stringify(meta)].concat(envelope.messages.map(function(m) {
      return JSON.stringify(m);
    })).join('\n');
  },
  toXML(envelope) {
    var esc = this._escapeXml.bind(this);
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<export>\n';
    xml += '  <exportVersion>' + esc(envelope.exportVersion) + '</exportVersion>\n';
    xml += '  <exportedAt>' + esc(envelope.exportedAt) + '</exportedAt>\n';
    xml += '  <platform>' + esc(envelope.platform) + '</platform>\n';
    xml += '  <chatTitle>' + esc(envelope.chatTitle || '') + '</chatTitle>\n';
    xml += '  <model>' + esc(envelope.model || '') + '</model>\n';
    xml += '  <messageCount>' + envelope.messageCount + '</messageCount>\n';
    xml += '  <messages>\n';
    for (var i = 0; i < envelope.messages.length; i++) {
      var m = envelope.messages[i];
      xml += '    <message>\n';
      for (var j = 0; j < this._msgFields.length; j++) {
        var f = this._msgFields[j];
        xml += '      <' + f + '>' + esc(String(m[f] != null ? m[f] : '')) + '</' + f + '>\n';
      }
      xml += '    </message>\n';
    }
    xml += '  </messages>\n</export>';
    return xml;
  },
  toYAML(envelope) {
    var esc = function(s) {
      s = String(s);
      if (/[\n:#{}\[\],&*?|>!'"%@`]/.test(s) || s.trim() !== s || s === '') return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
      return s;
    };
    var y = 'exportVersion: ' + esc(envelope.exportVersion) + '\n';
    y += 'exportedAt: ' + esc(envelope.exportedAt) + '\n';
    y += 'platform: ' + esc(envelope.platform) + '\n';
    y += 'chatTitle: ' + esc(envelope.chatTitle || '') + '\n';
    y += 'model: ' + esc(envelope.model || '') + '\n';
    y += 'messageCount: ' + envelope.messageCount + '\n';
    y += 'messages:\n';
    for (var i = 0; i < envelope.messages.length; i++) {
      var m = envelope.messages[i];
      y += '  - role: ' + esc(m.role) + '\n';
      y += '    content: ' + esc(m.content) + '\n';
      y += '    id: ' + esc(m.id) + '\n';
      y += '    timestamp: ' + esc(m.timestamp) + '\n';
      y += '    model: ' + esc(m.model) + '\n';
      y += '    platform: ' + esc(m.platform) + '\n';
      y += '    index: ' + m.index + '\n';
    }
    return y;
  },
  formats: {
    csv:     { mime: 'text/csv',                  ext: 'csv' },
    tsv:     { mime: 'text/tab-separated-values', ext: 'tsv' },
    json:    { mime: 'application/json',           ext: 'json' },
    ndjson:  { mime: 'application/x-ndjson',       ext: 'ndjson' },
    xml:     { mime: 'application/xml',            ext: 'xml' },
    yaml:    { mime: 'text/yaml',                  ext: 'yaml' }
  },
  convert(format, envelope) {
    var methodMap = {
      csv: 'toCSV', tsv: 'toTSV', json: 'toJSON', ndjson: 'toNDJSON',
      xml: 'toXML', yaml: 'toYAML'
    };
    var method = methodMap[format];
    if (!method || !this[method]) throw new Error('Unsupported format: ' + format);
    return this[method](envelope);
  }
};
if (typeof module !== 'undefined') module.exports = FormatConverter;
