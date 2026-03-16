import { Plugin, WorkspaceLeaf } from 'obsidian';
import { OWL_VIEW_TYPE, OwlTagView } from './view';
import { OwlSettingTab, OwlSettings, DEFAULT_SETTINGS } from './settings';
export default class OwlTagsPlugin extends Plugin {
  settings: OwlSettings = DEFAULT_SETTINGS;
  async onload(): Promise<void> {
    await this.loadSettings();
    this.registerView(OWL_VIEW_TYPE, (leaf: WorkspaceLeaf) => new OwlTagView(leaf, this));
    this.addRibbonIcon('eye', 'Owl: Scan Tags', () => this.activateView());
    this.addCommand({ id: 'owl-scan-tags', name: 'Owl: Scan Tags', callback: () => this.activateView() });
    this.addSettingTab(new OwlSettingTab(this.app, this));
    if (this.settings.scanOnOpen) this.app.workspace.onLayoutReady(() => this.activateView());
  }
  async onunload(): Promise<void> { this.app.workspace.detachLeavesOfType(OWL_VIEW_TYPE); }
  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(OWL_VIEW_TYPE);
    if (existing.length) { // refresh existing
      this.app.workspace.revealLeaf(existing[0]);
      const view = existing[0].view as OwlTagView;
      await view.refresh();
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: OWL_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  async loadSettings(): Promise<void> { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
  async saveSettings(): Promise<void> { await this.saveData(this.settings); }
}
