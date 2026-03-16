importScripts('compat.js', 'converters.js', 'filename.js', 'storage.js', 'history.js');

api.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'download') {
    handleDownload(request).then(sendResponse).catch(function(e) {
      sendResponse({ error: e.message });
    });
    return true; // async response
  }
});

async function handleDownload(request) {
  var format = request.format;
  var data = request.data;
  if (!format || !data) throw new Error('Missing format or data');
  var formatInfo = FormatConverter.formats[format];
  if (!formatInfo) throw new Error('Unknown format: ' + format);
  var converted = FormatConverter.convert(format, data);
  var settings = await StorageManager.getAll();
  var filename = FilenameBuilder.build(settings.filenameTemplate, {
    platform: data.platform,
    title: data.chatTitle,
    format: format,
    ext: formatInfo.ext
  });
  var url = 'data:' + formatInfo.mime + ';charset=utf-8,' + encodeURIComponent(converted);
  await api.downloads.download({ url: url, filename: filename, saveAs: true });
  await ExportHistory.add({
    platform: data.platform,
    format: format,
    messageCount: data.messageCount,
    chatTitle: data.chatTitle,
    filename: filename
  });
  return { success: true };
}

// auto-export via alarms
api.alarms.onAlarm.addListener(async function(alarm) {
  if (alarm.name !== 'auto-export') return;
  try {
    var tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length) return;
    var response = await api.tabs.sendMessage(tabs[0].id, { action: 'extractChat' });
    if (!response || response.error || !response.data) return;
    var settings = await StorageManager.getAll();
    await handleDownload({ format: settings.defaultFormat || 'json', data: response.data });
  } catch(e) { console.warn('auto-export failed:', e); }
});

async function updateAutoExport() {
  await api.alarms.clear('auto-export');
  var interval = await StorageManager.get('autoExportInterval');
  if (interval && interval > 0) {
    api.alarms.create('auto-export', { periodInMinutes: interval });
  }
}
api.storage.onChanged.addListener(function(changes) {
  if (changes.autoExportInterval) updateAutoExport();
});
updateAutoExport();
