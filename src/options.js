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
  function renderAutoExportStatus(status) {
    var statusEl = document.getElementById('autoExportStatus');
    if (!statusEl) return;
    if (!status || !status.message) {
      statusEl.textContent = 'Auto-export has not run yet.';
      return;
    }
    var prefix = status.state === 'error' ? 'Error' : status.state === 'success' ? 'Success' : 'Status';
    var timestamp = status.timestamp ? ' (' + new Date(status.timestamp).toLocaleString() + ')' : '';
    statusEl.textContent = prefix + ': ' + status.message + timestamp;
  }
  applyTheme(settings.darkMode);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() { applyTheme(settings.darkMode); });
  document.getElementById('defaultFormat').value = settings.defaultFormat;
  document.getElementById('filenameTemplate').value = settings.filenameTemplate;
  document.getElementById('darkMode').value = settings.darkMode;
  document.getElementById('showPreview').checked = settings.showPreview;
  document.getElementById('autoExportInterval').value = settings.autoExportInterval;
  renderAutoExportStatus(settings.lastAutoExportStatus);
  document.getElementById('options-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var darkMode = document.getElementById('darkMode').value;
    await StorageManager.setAll({
      defaultFormat: document.getElementById('defaultFormat').value,
      filenameTemplate: document.getElementById('filenameTemplate').value,
      darkMode: darkMode,
      showPreview: document.getElementById('showPreview').checked,
      autoExportInterval: parseInt(document.getElementById('autoExportInterval').value) || 0
    });
    applyTheme(darkMode);
    var status = document.getElementById('save-status');
    status.textContent = 'Saved!';
    setTimeout(function() { status.textContent = ''; }, 2000);
  });
})();
