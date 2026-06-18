var KeepImportPolicy = (function() {
  var ADAPTER_ID = 'keep';
  var TAKEOUT_ONLY_MESSAGE = 'Google Keep import uses local Google Takeout exports. Keep URLs and browser pages are not accepted.';
  var ATTACHMENT_TYPES = {
    image: /^image\//i,
    audio: /^audio\//i,
    drawing: /(^|\b)(drawing|application\/vnd\.google-apps\.drawing)(\b|$)/i
  };

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function sourceText(source) {
    if (typeof source === 'string') return source;
    source = source || {};
    return text(source.url || source.href || source.path || source.name || source.type || source.kind);
  }

  function isKeepLiveSource(source) {
    var value = sourceText(source).trim();
    return /^https?:\/\/([^/]+\.)?keep\.google\.com(?:\/|$)/i.test(value) ||
      /^keep(?:-web|-url|-page|-api)?$/i.test(value) ||
      /keep\.google\.com/i.test(value);
  }

  function rejectUnsupportedSource(source) {
    if (!isKeepLiveSource(source)) return null;
    var error = new Error(TAKEOUT_ONLY_MESSAGE);
    error.code = 'KEEP_UNSUPPORTED_LIVE_SOURCE';
    error.adapterId = ADAPTER_ID;
    error.recoverable = true;
    return error;
  }

  function assertSupportedSource(source) {
    var error = rejectUnsupportedSource(source);
    if (error) throw error;
    return true;
  }

  function attachmentName(attachment) {
    attachment = attachment || {};
    return text(attachment.name || attachment.filename || attachment.title || attachment.path || attachment.sourcePath || attachment.id || 'attachment');
  }

  function attachmentType(attachment) {
    attachment = attachment || {};
    var value = text(attachment.mimeType || attachment.mimetype || attachment.contentType || attachment.type || attachment.name || attachment.filename || attachment.path);
    if (ATTACHMENT_TYPES.image.test(value) || /\.(png|jpe?g|gif|webp|heic|bmp|tiff?)$/i.test(value)) return 'image';
    if (ATTACHMENT_TYPES.audio.test(value) || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(value)) return 'audio';
    if (ATTACHMENT_TYPES.drawing.test(value) || /\.(svg|drawio)$/i.test(value)) return 'drawing';
    return 'unsupported';
  }

  function hasLocalAttachment(attachment, availablePaths) {
    attachment = attachment || {};
    var candidates = [
      text(attachment.path),
      text(attachment.sourcePath),
      text(attachment.localPath),
      text(attachment.filename),
      text(attachment.name)
    ].filter(Boolean);
    if (!availablePaths) return candidates.length > 0;
    var set = {};
    (Array.isArray(availablePaths) ? availablePaths : Object.keys(availablePaths || {})).forEach(function(path) {
      set[text(path)] = true;
      set[text(path).split(/[\\/]/).pop()] = true;
    });
    return candidates.some(function(candidate) {
      return !!set[candidate] || !!set[candidate.split(/[\\/]/).pop()];
    });
  }

  function attachmentWarning(code, message, sourceRef) {
    return {
      code: code,
      message: message,
      sourceRef: text(sourceRef),
      recoverable: true
    };
  }

  function classifyAttachment(attachment, options) {
    options = options || {};
    var name = attachmentName(attachment);
    var kind = attachmentType(attachment);
    var sourceRef = text((attachment && (attachment.path || attachment.sourcePath || attachment.id)) || name);
    var local = hasLocalAttachment(attachment, options.availablePaths);
    var decision = {
      kind: kind,
      action: local && kind !== 'unsupported' ? 'link' : 'placeholder',
      placeholder: '[' + (kind === 'unsupported' ? 'attachment' : kind) + ': ' + name + ']',
      provenance: {
        name: name,
        kind: kind,
        path: text(attachment && (attachment.path || attachment.sourcePath || attachment.localPath)),
        mimeType: text(attachment && (attachment.mimeType || attachment.mimetype || attachment.contentType || attachment.type)),
        linked: local && kind !== 'unsupported'
      },
      warning: null
    };
    if (!local) {
      decision.warning = attachmentWarning('KEEP_ATTACHMENT_MISSING', 'Keep Takeout attachment file is missing; imported a placeholder.', sourceRef);
      return decision;
    }
    if (kind === 'unsupported') {
      decision.warning = attachmentWarning('KEEP_ATTACHMENT_UNSUPPORTED', 'Keep Takeout attachment type is unsupported; imported a placeholder.', sourceRef);
    }
    return decision;
  }

  return {
    ADAPTER_ID: ADAPTER_ID,
    TAKEOUT_ONLY_MESSAGE: TAKEOUT_ONLY_MESSAGE,
    isKeepLiveSource: isKeepLiveSource,
    rejectUnsupportedSource: rejectUnsupportedSource,
    assertSupportedSource: assertSupportedSource,
    attachmentType: attachmentType,
    classifyAttachment: classifyAttachment
  };
})();

if (typeof module !== 'undefined') module.exports = KeepImportPolicy;
