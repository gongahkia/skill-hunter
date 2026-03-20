var ExportHistory = {
  MAX_ENTRIES: 500,
  async add(entry) {
    var result = await api.storage.local.get({ exportHistory: [] });
    var history = result.exportHistory;
    history.unshift({
      timestamp: new Date().toISOString(),
      platform: entry.platform || '',
      format: entry.format || '',
      messageCount: entry.messageCount || 0,
      chatTitle: entry.chatTitle || '',
      filename: entry.filename || ''
    });
    if (history.length > this.MAX_ENTRIES) history.length = this.MAX_ENTRIES;
    await api.storage.local.set({ exportHistory: history });
  },
  async getAll() {
    var result = await api.storage.local.get({ exportHistory: [] });
    return result.exportHistory;
  },
  async clear() {
    await api.storage.local.set({ exportHistory: [] });
  }
};
if (typeof module !== 'undefined') module.exports = ExportHistory;
