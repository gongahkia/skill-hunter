var ImportPrivacyCopy = (function() {
  var DEFAULT_COPY = {
    archiveWarning: 'Imported archives can contain other people\'s messages and sensitive account data.',
    localOnly: 'Imported content stays local unless you export, back up, or sync the vault.',
    tokenWarning: 'Do not store OAuth tokens or API keys in vault exports.',
    reviewWarning: 'Review source files before importing shared workspaces, mailboxes, or chat exports.'
  };

  var ADAPTER_COPY = {
    notion: {
      archiveWarning: 'Imported Notion pages can include shared workspace content and private page text.'
    },
    'google-docs': {
      archiveWarning: 'Imported Google Docs can include comments, links, names, and shared document text.',
      apiLimitWarning: 'Google Drive API exports can fail when exported content exceeds the 10 MB files.export limit. Use Google Takeout or export the Doc locally, then import that file.'
    },
    keep: {
      archiveWarning: 'Imported Keep notes can include personal notes, labels, attachments, and deleted/archive state.'
    },
    slack: {
      archiveWarning: 'Imported Slack exports can include other people\'s messages, names, reactions, links, and file references.'
    },
    discord: {
      archiveWarning: 'Imported Discord packages can include other people\'s messages, usernames, IDs, and attachment links.'
    },
    email: {
      archiveWarning: 'Imported email can include senders, recipients, private threads, labels, headers, and attachments.'
    },
    'x-bookmarks': {
      archiveWarning: 'Imported X bookmarks can include saved post text, account IDs, handles, media refs, and protected/deleted post context.'
    }
  };

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function normalizeAdapter(value) {
    return text(value).trim().toLowerCase();
  }

  function copyFor(adapterId) {
    return Object.assign({}, DEFAULT_COPY, ADAPTER_COPY[normalizeAdapter(adapterId)] || {});
  }

  function warnings(adapterId) {
    var copy = copyFor(adapterId);
    return [copy.archiveWarning, copy.localOnly, copy.tokenWarning, copy.reviewWarning, copy.apiLimitWarning].filter(Boolean);
  }

  return {
    defaults: Object.assign({}, DEFAULT_COPY),
    forAdapter: copyFor,
    warnings: warnings
  };
})();

if (typeof module !== 'undefined') module.exports = ImportPrivacyCopy;
