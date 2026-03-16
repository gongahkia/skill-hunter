import { ItemView, WorkspaceLeaf, MarkdownView } from 'obsidian';
import { scanVault, TagEntry } from './scanner';
import { BUILT_IN_PREFIXES, PRIORITY, getColor } from './config';
import type OwlTagsPlugin from './main';
export const OWL_VIEW_TYPE = 'owl-tags-view';
export class OwlTagView extends ItemView {
  plugin: OwlTagsPlugin;
  tags: Map<string, TagEntry[]> = new Map();
  filter = '';
  constructor(leaf: WorkspaceLeaf, plugin: OwlTagsPlugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType(): string { return OWL_VIEW_TYPE; }
  getDisplayText(): string { return 'Owl Tags'; }
  getIcon(): string { return 'eye'; }
  async onOpen(): Promise<void> { await this.refresh(); }
  async onClose(): Promise<void> { this.contentEl.empty(); }
  async refresh(): Promise<void> {
    const prefixes = this.getAllPrefixes();
    this.tags = await scanVault(this.app, prefixes);
    this.render();
  }
  getAllPrefixes(): string[] {
    const custom = (this.plugin.settings.customPrefixes || '')
      .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    return [...BUILT_IN_PREFIXES, ...custom.filter(c => !BUILT_IN_PREFIXES.includes(c))];
  }
  render(): void {
    const el = this.contentEl;
    el.empty();
    const container = el.createDiv({ cls: 'owl-container' });
    const scheme = this.plugin.settings.colorscheme;
    const prefixes = this.getAllPrefixes();
    const sorted = [...prefixes].sort((a, b) => (PRIORITY[a] || 99) - (PRIORITY[b] || 99));
    let total = 0;
    this.tags.forEach(v => total += v.length);
    const stats = container.createDiv({ cls: 'owl-stats' }); // stats bar
    const totalBadge = stats.createSpan({ cls: 'owl-stat-badge', text: `ALL: ${total}` });
    totalBadge.style.background = 'var(--interactive-accent)';
    totalBadge.style.color = 'var(--text-on-accent)';
    sorted.forEach((p, i) => {
      const count = (this.tags.get(p) || []).length;
      if (count === 0) return;
      const badge = stats.createSpan({ cls: 'owl-stat-badge', text: `${p}: ${count}` });
      badge.style.background = getColor(scheme, p, i);
      badge.style.color = '#1a1a1a';
    });
    const filterInput = container.createEl('input', { cls: 'owl-filter', attr: { type: 'text', placeholder: 'Filter tags...' } }); // filter
    filterInput.value = this.filter;
    filterInput.addEventListener('input', () => { this.filter = filterInput.value; this.render(); });
    sorted.forEach((prefix, idx) => { // tag groups
      const entries = (this.tags.get(prefix) || []).filter(e =>
        !this.filter || e.text.toLowerCase().includes(this.filter.toLowerCase()) || e.path.toLowerCase().includes(this.filter.toLowerCase())
      );
      if (entries.length === 0) return;
      const group = container.createDiv({ cls: 'owl-prefix-group' });
      const header = group.createDiv({ cls: 'owl-prefix-header', text: `${prefix} (${entries.length})` });
      header.style.color = getColor(scheme, prefix, idx);
      entries.forEach(entry => {
        const item = group.createDiv({ cls: 'owl-tag-item' });
        const prefixSpan = item.createSpan({ cls: 'owl-tag-text', text: entry.text });
        prefixSpan.style.color = getColor(scheme, prefix, idx);
        const pathSpan = item.createSpan({ cls: 'owl-tag-path', text: ` ${entry.path}:${entry.line + 1}` });
        item.addEventListener('click', async () => { // navigate to tag
          await this.app.workspace.openLinkText(entry.file.path, '');
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (view) {
            const editor = view.editor;
            editor.setCursor({ line: entry.line, ch: 0 });
            editor.scrollIntoView({ from: { line: entry.line, ch: 0 }, to: { line: entry.line, ch: 0 } }, true);
          }
        });
      });
    });
  }
}
