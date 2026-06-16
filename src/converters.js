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
  _escapeHTML(value) {
    return this._text(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  _slug(value) {
    return this._oneLine(value).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'item';
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
  toHTML(envelope) {
    envelope = envelope || {};
    var messages = Array.isArray(envelope.messages) ? envelope.messages : [];
    var threads = Array.isArray(envelope.openThreads) ? envelope.openThreads : Array.isArray(envelope.threads) ? envelope.threads : [];
    var title = this._chatTitle(envelope);
    var html = [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>' + this._escapeHTML(title) + '</title>',
      '<style>',
      ':root{color-scheme:light dark;--bg:#f8fafc;--fg:#111827;--muted:#64748b;--line:#cbd5e1;--card:#ffffff;--accent:#2563eb;}',
      '@media (prefers-color-scheme:dark){:root{--bg:#111827;--fg:#e5e7eb;--muted:#94a3b8;--line:#334155;--card:#1f2937;--accent:#60a5fa;}}',
      'body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
      'main{max-width:960px;margin:0 auto;padding:32px 20px 56px;}',
      'header{border-bottom:1px solid var(--line);margin-bottom:24px;padding-bottom:18px;}',
      'h1{font-size:30px;line-height:1.15;margin:0 0 14px;}',
      'h2{font-size:20px;margin:28px 0 12px;}',
      '.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px 16px;color:var(--muted);margin:0;padding:0;list-style:none;}',
      '.threads,.message{background:var(--card);border:1px solid var(--line);border-radius:8px;margin:16px 0;padding:16px;}',
      '.thread-list{margin:0;padding-left:20px;}.thread-list li{margin:8px 0;}',
      '.thread-tag{font-weight:700;color:var(--accent);}.thread-meta,.message-meta{color:var(--muted);font-size:13px;margin-bottom:8px;}',
      '.message h2{margin:0 0 4px;font-size:18px;}.content{white-space:pre-wrap;overflow-wrap:anywhere;}',
      'a{color:var(--accent);}@media print{body{background:#fff;color:#000;}main{max-width:none;padding:0}.threads,.message{break-inside:avoid;border-color:#bbb}}',
      '</style>',
      '</head>',
      '<body>',
      '<main>',
      '<header>',
      '<h1>' + this._escapeHTML(title) + '</h1>',
      '<ul class="meta">'
    ];

    function meta(label, value) {
      value = FormatConverter._oneLine(value);
      if (value) html.push('<li><strong>' + FormatConverter._escapeHTML(label) + ':</strong> ' + FormatConverter._escapeHTML(value) + '</li>');
    }

    meta('Chat ID', envelope.chatId);
    meta('Platform', envelope.platform || 'unknown');
    meta('Model', envelope.model);
    meta('Source', envelope.url || envelope.sourceUrl);
    meta('Exported', envelope.exportedAt || envelope.capturedAt);
    meta('Updated', envelope.lastUpdatedAt);
    meta('Messages', typeof envelope.messageCount === 'number' ? envelope.messageCount : messages.length);
    html.push('</ul>', '</header>');

    html.push('<section class="threads" aria-label="Open threads">', '<h2>Open threads</h2>');
    if (threads.length) {
      html.push('<ol class="thread-list">');
      threads.forEach(function(thread) {
        var messageId = FormatConverter._text(thread && thread.messageId);
        var href = messageId ? ' href="#message-' + FormatConverter._escapeHTML(FormatConverter._slug(messageId)) + '"' : '';
        var metaBits = [thread && thread.status, thread && thread.source, thread && thread.subSource].filter(Boolean).join(' / ');
        if (thread && typeof thread.confidence === 'number') metaBits += (metaBits ? ' / ' : '') + 'confidence ' + String(Math.round(thread.confidence * 100)) + '%';
        html.push('<li><span class="thread-tag">' + FormatConverter._escapeHTML(thread && thread.tag || 'THREAD') + '</span> ');
        html.push('<a' + href + '>' + FormatConverter._escapeHTML(FormatConverter._oneLine(thread && thread.text) || '(empty)') + '</a>');
        if (metaBits) html.push('<div class="thread-meta">' + FormatConverter._escapeHTML(metaBits) + '</div>');
        html.push('</li>');
      });
      html.push('</ol>');
    } else {
      html.push('<p class="thread-meta">No open threads.</p>');
    }
    html.push('</section>');

    messages.forEach(function(message, index) {
      message = message || {};
      var messageId = FormatConverter._messageId(message) || 'message-' + String(index + 1);
      var metaBits = [message.timestamp, FormatConverter._messageId(message)].filter(Boolean).join(' | ');
      html.push('<article id="message-' + FormatConverter._escapeHTML(FormatConverter._slug(messageId)) + '" class="message">');
      html.push('<h2>' + FormatConverter._escapeHTML(FormatConverter._roleLabel(message.role)) + '</h2>');
      if (metaBits) html.push('<div class="message-meta">' + FormatConverter._escapeHTML(metaBits) + '</div>');
      html.push('<div class="content">' + FormatConverter._escapeHTML(FormatConverter._text(message.content).trim() || '(empty)') + '</div>');
      html.push('</article>');
    });

    html.push('</main>', '</body>', '</html>');
    return html.join('\n');
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
