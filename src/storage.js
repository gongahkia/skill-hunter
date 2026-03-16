var StorageManager = {
  defaults: {
    defaultFormat: 'json',
    filenameTemplate: '{platform}_{title}_{date}.{ext}',
    darkMode: 'system',
    showPreview: true,
    autoExportInterval: 0
  },
  async getAll() {
    return await api.storage.sync.get(this.defaults);
  },
  async get(key) {
    var all = await this.getAll();
    return all[key];
  },
  async set(key, value) {
    await api.storage.sync.set({ [key]: value });
  },
  async setAll(settings) {
    await api.storage.sync.set(settings);
  }
};
if (typeof module !== 'undefined') module.exports = StorageManager;
