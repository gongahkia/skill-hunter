var FilenameBuilder = {
  sanitize(str) {
    return str.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '_').slice(0, 100);
  },
  build(template, ctx) {
    var date = new Date().toISOString().slice(0, 10);
    var time = String(Date.now());
    return template
      .replace(/\{platform\}/g, this.sanitize(ctx.platform || 'unknown'))
      .replace(/\{title\}/g, this.sanitize(ctx.title || 'untitled'))
      .replace(/\{date\}/g, date)
      .replace(/\{time\}/g, time)
      .replace(/\{format\}/g, ctx.format || 'json')
      .replace(/\{ext\}/g, ctx.ext || 'json');
  }
};
if (typeof module !== 'undefined') module.exports = FilenameBuilder;
