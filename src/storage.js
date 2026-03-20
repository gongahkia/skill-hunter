var StorageManager = {
  defaults: {
    defaultFormat: 'json',
    filenameTemplate: '{platform}_{title}_{date}.{ext}',
    darkMode: 'system',
    showPreview: true,
    autoExportInterval: 0,
    lastAutoExportStatus: {
      state: 'idle',
      message: 'Auto-export has not run yet.',
      timestamp: ''
    }
  },
  async getAll() {
    return await api.storage.local.get(this.defaults);
  },
  async get(key) {
    var all = await this.getAll();
    return all[key];
  },
  async set(key, value) {
    await api.storage.local.set({ [key]: value });
  },
  async setAll(settings) {
    await api.storage.local.set(settings);
  },
  async setRuntimeValue(key, value) {
    await api.storage.local.set({ [key]: value });
  }
};
if (typeof module !== 'undefined') module.exports = StorageManager;
