var BackgroundRuntime = (function() {
  var AUTO_EXPORT_STATUS_KEY = "lastAutoExportStatus";

  async function setAutoExportStatus(state, message) {
    await StorageManager.setRuntimeValue(AUTO_EXPORT_STATUS_KEY, {
      state: state,
      message: message,
      timestamp: new Date().toISOString()
    });
  }

  function validateEnvelope(data) {
    if (!data) throw new Error("Missing export data");
    if (!Array.isArray(data.messages)) throw new Error("Invalid export payload");
    if (!data.messages.length) throw new Error("No messages were extracted from the current conversation");
  }

  async function handleDownload(request) {
    var format = request.format;
    var data = request.data;
    if (!format || !data) throw new Error("Missing format or data");
    validateEnvelope(data);
    var formatInfo = FormatConverter.formats[format];
    if (!formatInfo) throw new Error("Unsupported format: " + format);
    var converted = FormatConverter.convert(format, data);
    if (!api.downloads || !api.downloads.download) {
      throw new Error("The browser download API is unavailable in the background context");
    }
    var settings = await StorageManager.getAll();
    var filename = FilenameBuilder.build(settings.filenameTemplate, {
      platform: data.platform,
      title: data.chatTitle,
      format: format,
      ext: formatInfo.ext
    });
    var url = "data:" + formatInfo.mime + ";charset=utf-8," + encodeURIComponent(converted);
    await api.downloads.download({
      url: url,
      filename: filename,
      saveAs: request.saveAs !== false,
      conflictAction: "uniquify"
    });
    await ExportHistory.add({
      platform: data.platform,
      format: format,
      messageCount: data.messageCount,
      chatTitle: data.chatTitle,
      filename: filename
    });
    return { success: true, filename: filename };
  }

  async function extractFromActiveTab() {
    var tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length || (tabs[0].id !== 0 && !tabs[0].id)) {
      throw new Error("No active tab is available for export");
    }
    var response = await api.tabs.sendMessage(tabs[0].id, { action: "extractChat" });
    if (!response) throw new Error("No response from content script");
    if (response.error) throw new Error(response.error);
    validateEnvelope(response.data);
    return response.data;
  }

  async function runAutoExport() {
    try {
      var settings = await StorageManager.getAll();
      var data = await extractFromActiveTab();
      await handleDownload({ format: settings.defaultFormat || "json", data: data, saveAs: true });
      await setAutoExportStatus("success", "Auto-export opened the browser save flow for the active supported tab.");
    } catch (error) {
      await setAutoExportStatus("error", error.message);
      console.warn("auto-export failed:", error);
    }
  }

  async function updateAutoExport() {
    await api.alarms.clear("auto-export");
    var interval = await StorageManager.get("autoExportInterval");
    if (interval && interval > 0) {
      api.alarms.create("auto-export", { periodInMinutes: interval });
    }
  }

  function init() {
    api.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.action === "download") {
        handleDownload(request).then(sendResponse).catch(function(error) {
          sendResponse({ error: error.message });
        });
        return true;
      }
    });

    api.alarms.onAlarm.addListener(function(alarm) {
      if (alarm.name !== "auto-export") return;
      runAutoExport();
    });

    api.storage.onChanged.addListener(function(changes) {
      if (changes.autoExportInterval) updateAutoExport();
    });

    updateAutoExport();
  }

  return {
    init: init,
    handleDownload: handleDownload,
    updateAutoExport: updateAutoExport,
    runAutoExport: runAutoExport
  };
})();
