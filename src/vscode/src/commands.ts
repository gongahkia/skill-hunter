import * as vscode from 'vscode';
import { TagEntry } from './scanner';
import { getPriority } from './config';

function collectSorted(tags: Map<string, TagEntry[]>): { prefix: string; entries: TagEntry[] }[] {
  return Array.from(tags.entries())
    .sort(([a], [b]) => getPriority(a) - getPriority(b))
    .map(([prefix, entries]) => ({ prefix, entries }));
}

export async function exportJson(tags: Map<string, TagEntry[]>): Promise<void> {
  const sorted = collectSorted(tags);
  const data = sorted.map(({ prefix, entries }) => ({
    prefix,
    count: entries.length,
    items: entries.map(e => ({ text: e.text, file: e.file, line: e.line })),
  }));
  await vscode.env.clipboard.writeText(JSON.stringify(data, null, 2));
  vscode.window.showInformationMessage('Copied!');
}

export async function exportMd(tags: Map<string, TagEntry[]>): Promise<void> {
  const sorted = collectSorted(tags);
  const lines: string[] = ['# Owl Tags Report', ''];
  for (const { prefix, entries } of sorted) {
    lines.push(`## ${prefix} (${entries.length})`, '');
    for (const e of entries) {
      const basename = e.file.split('/').pop() || e.file;
      lines.push(`- \`${basename}:${e.line}\` ${e.text}`);
    }
    lines.push('');
  }
  await vscode.env.clipboard.writeText(lines.join('\n'));
  vscode.window.showInformationMessage('Copied!');
}
