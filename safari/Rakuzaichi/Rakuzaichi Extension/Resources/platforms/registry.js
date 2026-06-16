function createPlatformEntry(platform) {
  return {
    id: platform.id,
      displayName: platform.displayName || platform.name,
      urlPatterns: platform.urlPatterns || platform.hostPatterns || [],
      adapterModule: platform.adapterModule || ('platforms/' + platform.id + '.js'),
      chatIdStrategy: platform.chatIdStrategy || ''
    };
}

var PlatformRegistry = {
  platforms: (typeof _platforms !== 'undefined') ? _platforms : [],
  entries: ((typeof _platforms !== 'undefined') ? _platforms : []).map(createPlatformEntry),
  detect() {
    for (var i = 0; i < this.platforms.length; i++) {
      try { if (this.platforms[i].detect()) return this.platforms[i]; } catch(e) {}
    }
    return null;
  },
  get(id) {
    for (var i = 0; i < this.platforms.length; i++) {
      if (this.platforms[i].id === id) return this.platforms[i];
    }
    return null;
  },
  list() {
    return this.entries.slice();
  }
};
if (typeof module !== 'undefined') module.exports = PlatformRegistry;
