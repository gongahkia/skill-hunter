var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => OwlTagsPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// view.ts
var import_obsidian = require("obsidian");

// scanner.ts
async function scanVault(app, prefixes) {
  const result = /* @__PURE__ */ new Map();
  prefixes.forEach((p) => result.set(p.toUpperCase(), []));
  const files = app.vault.getMarkdownFiles();
  for (const file of files) {
    const content = await app.vault.cachedRead(file);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const upper = trimmed.toUpperCase();
      for (const prefix of prefixes) {
        const pUpper = prefix.toUpperCase();
        if (upper.startsWith(pUpper + ":") || upper.startsWith(pUpper + " ") || upper === pUpper) {
          const entries = result.get(pUpper) || [];
          entries.push({ text: trimmed, file, line: i, path: file.path, prefix: pUpper });
          result.set(pUpper, entries);
          break;
        }
      }
    }
  }
  return result;
}

// config.ts
var BUILT_IN_PREFIXES = ["TODO", "FIXME", "TEMP", "REF", "REV"];
var PRIORITY = { FIXME: 1, TODO: 2, REV: 3, TEMP: 4, REF: 5 };
var FALLBACK_COLORS = {
  // for custom prefixes
  0: "#e0af68",
  1: "#f7768e",
  2: "#9ece6a",
  3: "#7aa2f7",
  4: "#bb9af7",
  5: "#e5c07b",
  6: "#e06c75",
  7: "#98c379",
  8: "#61afef",
  9: "#c678dd"
};
var COLORSCHEMES = {
  gruvbox: { TODO: "#FABD2F", FIXME: "#FB4934", TEMP: "#8EC07C", REF: "#83A598", REV: "#D3869B" },
  everforest: { TODO: "#d8a657", FIXME: "#e67e80", TEMP: "#a7c080", REF: "#7fbbb3", REV: "#d699b6" },
  tokyoNight: { TODO: "#e0af68", FIXME: "#f7768e", TEMP: "#9ece6a", REF: "#7aa2f7", REV: "#bb9af7" },
  atomDark: { TODO: "#e5c07b", FIXME: "#e06c75", TEMP: "#98c379", REF: "#61afef", REV: "#c678dd" },
  monokai: { TODO: "#f4bf75", FIXME: "#f92672", TEMP: "#a6e22e", REF: "#66d9ef", REV: "#ae81ff" },
  github: { TODO: "#6f42c1", FIXME: "#d73a49", TEMP: "#28a745", REF: "#0366d6", REV: "#005cc5" },
  ayu: { TODO: "#ff9940", FIXME: "#f07178", TEMP: "#aad94c", REF: "#39bae6", REV: "#c296eb" },
  dracula: { TODO: "#f1fa8c", FIXME: "#ff5555", TEMP: "#50fa7b", REF: "#8be9fd", REV: "#bd93f9" },
  rosePine: { TODO: "#f6c177", FIXME: "#eb6f92", TEMP: "#9ccfd8", REF: "#31748f", REV: "#c4a7e7" },
  spacemacs: { TODO: "#dcaeea", FIXME: "#fc5c94", TEMP: "#86dc2f", REF: "#36c6d3", REV: "#a9a1e1" }
};
function getColor(scheme, prefix, idx) {
  const s = COLORSCHEMES[scheme] || COLORSCHEMES["gruvbox"];
  return s[prefix] || FALLBACK_COLORS[String(idx % 10)] || "#cccccc";
}

// view.ts
var OWL_VIEW_TYPE = "owl-tags-view";
var OwlTagView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.tags = /* @__PURE__ */ new Map();
    this.filter = "";
    this.plugin = plugin;
  }
  getViewType() {
    return OWL_VIEW_TYPE;
  }
  getDisplayText() {
    return "Owl Tags";
  }
  getIcon() {
    return "eye";
  }
  async onOpen() {
    await this.refresh();
  }
  async onClose() {
    this.contentEl.empty();
  }
  async refresh() {
    const prefixes = this.getAllPrefixes();
    this.tags = await scanVault(this.app, prefixes);
    this.render();
  }
  getAllPrefixes() {
    const custom = (this.plugin.settings.customPrefixes || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    return [...BUILT_IN_PREFIXES, ...custom.filter((c) => !BUILT_IN_PREFIXES.includes(c))];
  }
  render() {
    const el = this.contentEl;
    el.empty();
    const container = el.createDiv({ cls: "owl-container" });
    const scheme = this.plugin.settings.colorscheme;
    const prefixes = this.getAllPrefixes();
    const sorted = [...prefixes].sort((a, b) => (PRIORITY[a] || 99) - (PRIORITY[b] || 99));
    let total = 0;
    this.tags.forEach((v) => total += v.length);
    const stats = container.createDiv({ cls: "owl-stats" });
    const totalBadge = stats.createSpan({ cls: "owl-stat-badge", text: `ALL: ${total}` });
    totalBadge.style.background = "var(--interactive-accent)";
    totalBadge.style.color = "var(--text-on-accent)";
    sorted.forEach((p, i) => {
      const count = (this.tags.get(p) || []).length;
      if (count === 0) return;
      const badge = stats.createSpan({ cls: "owl-stat-badge", text: `${p}: ${count}` });
      badge.style.background = getColor(scheme, p, i);
      badge.style.color = "#1a1a1a";
    });
    const filterInput = container.createEl("input", { cls: "owl-filter", attr: { type: "text", placeholder: "Filter tags..." } });
    filterInput.value = this.filter;
    filterInput.addEventListener("input", () => {
      this.filter = filterInput.value;
      this.render();
    });
    sorted.forEach((prefix, idx) => {
      const entries = (this.tags.get(prefix) || []).filter(
        (e) => !this.filter || e.text.toLowerCase().includes(this.filter.toLowerCase()) || e.path.toLowerCase().includes(this.filter.toLowerCase())
      );
      if (entries.length === 0) return;
      const group = container.createDiv({ cls: "owl-prefix-group" });
      const header = group.createDiv({ cls: "owl-prefix-header", text: `${prefix} (${entries.length})` });
      header.style.color = getColor(scheme, prefix, idx);
      entries.forEach((entry) => {
        const item = group.createDiv({ cls: "owl-tag-item" });
        const prefixSpan = item.createSpan({ cls: "owl-tag-text", text: entry.text });
        prefixSpan.style.color = getColor(scheme, prefix, idx);
        const pathSpan = item.createSpan({ cls: "owl-tag-path", text: ` ${entry.path}:${entry.line + 1}` });
        item.addEventListener("click", async () => {
          await this.app.workspace.openLinkText(entry.file.path, "");
          const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
          if (view) {
            const editor = view.editor;
            editor.setCursor({ line: entry.line, ch: 0 });
            editor.scrollIntoView({ from: { line: entry.line, ch: 0 }, to: { line: entry.line, ch: 0 } }, true);
          }
        });
      });
    });
  }
};

// settings.ts
var import_obsidian2 = require("obsidian");
var DEFAULT_SETTINGS = { colorscheme: "gruvbox", customPrefixes: "", scanOnOpen: false };
var OwlSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian2.Setting(containerEl).setName("Color scheme").setDesc("Choose a color scheme for tag highlights").addDropdown((dd) => {
      Object.keys(COLORSCHEMES).forEach((k) => dd.addOption(k, k));
      dd.setValue(this.plugin.settings.colorscheme);
      dd.onChange(async (v) => {
        this.plugin.settings.colorscheme = v;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Custom prefixes").setDesc("Comma-separated additional prefixes (e.g. HACK,NOTE)").addText((t) => {
      t.setPlaceholder("HACK,NOTE").setValue(this.plugin.settings.customPrefixes);
      t.onChange(async (v) => {
        this.plugin.settings.customPrefixes = v;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Scan on open").setDesc("Automatically scan tags when the panel opens").addToggle((t) => {
      t.setValue(this.plugin.settings.scanOnOpen);
      t.onChange(async (v) => {
        this.plugin.settings.scanOnOpen = v;
        await this.plugin.saveSettings();
      });
    });
  }
};

// main.ts
var OwlTagsPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(OWL_VIEW_TYPE, (leaf) => new OwlTagView(leaf, this));
    this.addRibbonIcon("eye", "Owl: Scan Tags", () => this.activateView());
    this.addCommand({ id: "owl-scan-tags", name: "Owl: Scan Tags", callback: () => this.activateView() });
    this.addSettingTab(new OwlSettingTab(this.app, this));
    if (this.settings.scanOnOpen) this.app.workspace.onLayoutReady(() => this.activateView());
  }
  async onunload() {
    this.app.workspace.detachLeavesOfType(OWL_VIEW_TYPE);
  }
  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(OWL_VIEW_TYPE);
    if (existing.length) {
      this.app.workspace.revealLeaf(existing[0]);
      const view = existing[0].view;
      await view.refresh();
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: OWL_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
