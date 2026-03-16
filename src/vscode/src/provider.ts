import * as vscode from 'vscode';
import { TagEntry } from './scanner';
import { getPriority, getPrefixColor } from './config';

export class TagTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly entry?: TagEntry,
  ) {
    super(label, collapsibleState);
    if (entry) {
      const basename = entry.file.split('/').pop() || entry.file;
      this.description = `${basename}:${entry.line}`;
      this.tooltip = entry.text;
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [entry.uri, { selection: entry.range }],
      };
      this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.yellow')); // fallback
    }
  }
}

export class OwlTreeProvider implements vscode.TreeDataProvider<TagTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TagTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private tags = new Map<string, TagEntry[]>();

  refresh(tags: Map<string, TagEntry[]>): void {
    this.tags = tags;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TagTreeItem): vscode.TreeItem { return element; }

  getChildren(element?: TagTreeItem): TagTreeItem[] {
    if (!element) { // root: prefix groups sorted by priority
      const groups = Array.from(this.tags.keys())
        .sort((a, b) => getPriority(a) - getPriority(b));
      return groups.map(prefix => {
        const count = this.tags.get(prefix)?.length || 0;
        const item = new TagTreeItem(
          `${prefix} (${count})`,
          vscode.TreeItemCollapsibleState.Expanded,
        );
        item.contextValue = prefix;
        item.iconPath = new vscode.ThemeIcon('tag');
        return item;
      });
    }
    // child: individual tag entries
    const prefix = element.contextValue || element.label?.toString().split(' ')[0] || '';
    const entries = this.tags.get(prefix) || [];
    return entries.map(e => new TagTreeItem(
      e.text,
      vscode.TreeItemCollapsibleState.None,
      e,
    ));
  }
}
