(async function() {
  var settings = await StorageManager.getAll();
  document.getElementById('defaultFormat').value = settings.defaultFormat;
  document.getElementById('filenameTemplate').value = settings.filenameTemplate;
  document.getElementById('darkMode').value = settings.darkMode;
  document.getElementById('showPreview').checked = settings.showPreview;
  document.getElementById('autoExportInterval').value = settings.autoExportInterval;
  document.getElementById('options-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    await StorageManager.setAll({
      defaultFormat: document.getElementById('defaultFormat').value,
      filenameTemplate: document.getElementById('filenameTemplate').value,
      darkMode: document.getElementById('darkMode').value,
      showPreview: document.getElementById('showPreview').checked,
      autoExportInterval: parseInt(document.getElementById('autoExportInterval').value) || 0
    });
    var status = document.getElementById('save-status');
    status.textContent = 'Saved!';
    setTimeout(function() { status.textContent = ''; }, 2000);
  });
})();
