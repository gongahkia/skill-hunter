var DomUtils = {
  querySafe(el, selectors) {
    for (const s of selectors) {
      try { const r = el.querySelector(s); if (r) return r; } catch(e) {}
    }
    return null;
  },
  querySafeAll(el, selectors) {
    for (const s of selectors) {
      try { const r = el.querySelectorAll(s); if (r.length) return Array.from(r); } catch(e) {}
    }
    return [];
  },
  traverseShadow(root, path) {
    let cur = root;
    for (const sel of path) {
      if (!cur) return null;
      const el = cur.querySelector ? cur.querySelector(sel) : null;
      if (!el) return null;
      cur = el.shadowRoot || el;
    }
    return cur;
  },
  queryShadow(root, hostSelectors, innerSelector) {
    const shadow = this.traverseShadow(root, hostSelectors);
    if (!shadow || !shadow.querySelectorAll) return [];
    return Array.from(shadow.querySelectorAll(innerSelector));
  }
};
if (typeof module !== 'undefined') module.exports = DomUtils;
