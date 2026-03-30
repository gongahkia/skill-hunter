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
  _ensureStorage() {
    if (!api || !api.storage || !api.storage.local) {
      throw new Error('Browser storage API is unavailable');
    }
  },
  _wrapError(operation, error) {
    throw new Error('Storage operation failed during ' + operation + ': ' + (error && error.message ? error.message : String(error)));
  },
  async getAll() {
    this._ensureStorage();
    try {
      return await api.storage.local.get(this.defaults);
    } catch (error) {
      this._wrapError('getAll', error);
    }
  },
  async get(key) {
    try {
      var all = await this.getAll();
      return all[key];
    } catch (error) {
      this._wrapError('get(' + key + ')', error);
    }
  },
  async set(key, value) {
    this._ensureStorage();
    try {
      await api.storage.local.set({ [key]: value });
    } catch (error) {
      this._wrapError('set(' + key + ')', error);
    }
  },
  async setAll(settings) {
    this._ensureStorage();
    try {
      await api.storage.local.set(settings);
    } catch (error) {
      this._wrapError('setAll', error);
    }
  },
  async setRuntimeValue(key, value) {
    await this.set(key, value);
  }
};
if (typeof module !== 'undefined') module.exports = StorageManager;
