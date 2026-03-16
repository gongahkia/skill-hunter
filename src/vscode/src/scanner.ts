import * as vscode from 'vscode';
import { getAllPrefixes } from './config';

export interface TagEntry {
  text: string;
  file: string;
  line: number;
  uri: vscode.Uri;
  range: vscode.Range;
  prefix: string;
}

export function scanDocument(doc: vscode.TextDocument): Map<string, TagEntry[]> {
  const results = new Map<string, TagEntry[]>();
  const prefixes = getAllPrefixes();
  const pattern = new RegExp(`\\b(${prefixes.join('|')})\\b[:\\s]*(.*)`, 'gi');
  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i);
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(line.text)) !== null) {
      const prefix = match[1].toUpperCase();
      const startPos = new vscode.Position(i, match.index);
      const endPos = new vscode.Position(i, match.index + match[0].length);
      const entry: TagEntry = {
        text: match[0].trim(),
        file: doc.fileName,
        line: i + 1, // 1-indexed
        uri: doc.uri,
        range: new vscode.Range(startPos, endPos),
        prefix,
      };
      if (!results.has(prefix)) results.set(prefix, []);
      results.get(prefix)!.push(entry);
    }
  }
  return results;
}

export function scanWorkspace(): Map<string, TagEntry[]> {
  const merged = new Map<string, TagEntry[]>();
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.uri.scheme !== 'file') continue;
    const docTags = scanDocument(doc);
    for (const [prefix, entries] of docTags) {
      if (!merged.has(prefix)) merged.set(prefix, []);
      merged.get(prefix)!.push(...entries);
    }
  }
  return merged;
}
