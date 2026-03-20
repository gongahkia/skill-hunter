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
  },
  readText(node) {
    if (!node) return '';
    var text = typeof node.innerText === 'string' ? node.innerText : (node.textContent || '');
    return text.replace(/\u00a0/g, ' ').trim();
  },
  firstAttribute(node, names) {
    if (!node || !node.getAttribute) return '';
    for (const name of names) {
      const value = node.getAttribute(name);
      if (value) return value;
    }
    return '';
  },
  readTimestamp(node) {
    if (!node) return '';
    var direct = this.firstAttribute(node, ['data-timestamp', 'data-time', 'datetime', 'timestamp']);
    if (direct) return direct;
    var timeEl = this.querySafe(node, ['time', '[datetime]', '[data-timestamp]', '[data-time]']);
    if (!timeEl) return '';
    return this.firstAttribute(timeEl, ['datetime', 'data-timestamp', 'data-time', 'title']) || this.readText(timeEl);
  },
  normalizeRole(rawRole, fallbackRole) {
    var value = String(rawRole || '').toLowerCase();
    if (!value) return fallbackRole || 'unknown';
    if (/(assistant|bot|model|response|answer)/.test(value)) return 'assistant';
    if (/(user|human|prompt|query|question|request)/.test(value)) return 'user';
    return fallbackRole || 'unknown';
  },
  inferRole(node, fallbackRole) {
    if (!node) return fallbackRole || 'unknown';
    var hintParts = [
      this.firstAttribute(node, ['data-message-author-role', 'data-role', 'data-author', 'author', 'aria-label', 'data-testid']),
      node.className || ''
    ];
    if (node.parentElement) {
      hintParts.push(this.firstAttribute(node.parentElement, ['data-message-author-role', 'data-role', 'aria-label', 'data-testid']));
      hintParts.push(node.parentElement.className || '');
    }
    return this.normalizeRole(hintParts.join(' '), fallbackRole);
  },
  buildMessageId(platform, node, index, prefix) {
    var id = this.firstAttribute(node, ['data-message-id', 'data-id', 'id']);
    if (id) return id;
    var stem = prefix || platform || 'message';
    return stem + '-msg-' + index;
  }
};
if (typeof module !== 'undefined') module.exports = DomUtils;
