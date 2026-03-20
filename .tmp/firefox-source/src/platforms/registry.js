var PlatformRegistry = {
  platforms: (typeof _platforms !== 'undefined') ? _platforms : [],
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
    return this.platforms.map(function(p) { return { id: p.id, name: p.name }; });
  }
};
if (typeof module !== 'undefined') module.exports = PlatformRegistry;
