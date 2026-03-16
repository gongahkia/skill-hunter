import { PluginSettingTab, App, Setting } from 'obsidian';
import { COLORSCHEMES } from './config';
import type OwlTagsPlugin from './main';
export interface OwlSettings { colorscheme: string; customPrefixes: string; scanOnOpen: boolean; }
export const DEFAULT_SETTINGS: OwlSettings = { colorscheme: 'gruvbox', customPrefixes: '', scanOnOpen: false };
export class OwlSettingTab extends PluginSettingTab {
  plugin: OwlTagsPlugin;
  constructor(app: App, plugin: OwlTagsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName('Color scheme').setDesc('Choose a color scheme for tag highlights')
      .addDropdown(dd => {
        Object.keys(COLORSCHEMES).forEach(k => dd.addOption(k, k));
        dd.setValue(this.plugin.settings.colorscheme);
        dd.onChange(async v => { this.plugin.settings.colorscheme = v; await this.plugin.saveSettings(); });
      });
    new Setting(containerEl).setName('Custom prefixes').setDesc('Comma-separated additional prefixes (e.g. HACK,NOTE)')
      .addText(t => {
        t.setPlaceholder('HACK,NOTE').setValue(this.plugin.settings.customPrefixes);
        t.onChange(async v => { this.plugin.settings.customPrefixes = v; await this.plugin.saveSettings(); });
      });
    new Setting(containerEl).setName('Scan on open').setDesc('Automatically scan tags when the panel opens')
      .addToggle(t => {
        t.setValue(this.plugin.settings.scanOnOpen);
        t.onChange(async v => { this.plugin.settings.scanOnOpen = v; await this.plugin.saveSettings(); });
      });
  }
}
