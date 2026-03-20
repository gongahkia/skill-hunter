(async function() {
  var settings = await StorageManager.getAll();
  function applyTheme(mode) {
    if (mode === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (mode === 'light') document.documentElement.removeAttribute('data-theme');
    else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
    }
  }
  applyTheme(settings.darkMode);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() { applyTheme(settings.darkMode); });
  var previewEl = document.getElementById('export-preview');
  var previewInfo = document.getElementById('preview-info');
  var confirmBtn = document.getElementById('preview-confirm');
  var cancelBtn = document.getElementById('preview-cancel');
  var pendingExport = null;
  document.querySelectorAll('button[data-format]').forEach(function(button) {
    button.addEventListener('click', async function() {
      var format = button.dataset.format;
      try {
        var tabs = await api.tabs.query({ active: true, currentWindow: true });
        var response = await api.tabs.sendMessage(tabs[0].id, { action: 'extractChat' });
        if (!response) throw new Error('No response from content script');
        if (response.error) throw new Error(response.error);
        var data = response.data;
        if (settings.showPreview && previewEl) {
          pendingExport = { format: format, data: data };
          previewInfo.textContent = data.messageCount + ' messages from ' + data.platform +
            (data.model ? ' (' + data.model + ')' : '') + ' → ' + format.toUpperCase();
          previewEl.classList.remove('hidden');
        } else {
          await doDownload(format, data);
        }
      } catch(e) {
        showStatus('Export failed: ' + e.message, true);
      }
    });
  });
  if (confirmBtn) confirmBtn.addEventListener('click', async function() {
    if (!pendingExport) return;
    previewEl.classList.add('hidden');
    await doDownload(pendingExport.format, pendingExport.data);
    pendingExport = null;
  });
  if (cancelBtn) cancelBtn.addEventListener('click', function() {
    previewEl.classList.add('hidden');
    pendingExport = null;
  });
  async function doDownload(format, data) {
    try {
      var response = await api.runtime.sendMessage({ action: 'download', format: format, data: data });
      if (response && response.error) throw new Error(response.error);
      showStatus('Export opened the browser save flow.', false);
    } catch(e) {
      if (e.message && /download/i.test(e.message)) {
        await fallbackDownload(format, data);
        return;
      }
      showStatus('Download failed: ' + e.message, true);
    }
  }
  async function fallbackDownload(format, data) {
    var formatInfo = FormatConverter.formats[format];
    if (!formatInfo) throw new Error('Unsupported format: ' + format);
    var settings = await StorageManager.getAll();
    var filename = FilenameBuilder.build(settings.filenameTemplate, {
      platform: data.platform,
      title: data.chatTitle,
      format: format,
      ext: formatInfo.ext
    });
    var converted = FormatConverter.convert(format, data);
    var blob = new Blob([converted], { type: formatInfo.mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    try {
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      await ExportHistory.add({
        platform: data.platform,
        format: format,
        messageCount: data.messageCount,
        chatTitle: data.chatTitle,
        filename: filename
      });
      showStatus('Export downloaded from the popup fallback.', false);
    } finally {
      setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    }
  }
  function showStatus(msg, isError) {
    var el = document.getElementById('status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'status ' + (isError ? 'error' : 'success');
    el.classList.remove('hidden');
    setTimeout(function() { el.classList.add('hidden'); }, 3000);
  }
})();
