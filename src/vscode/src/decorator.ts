import * as vscode from 'vscode';
import { getAllPrefixes, getPrefixColor } from './config';

const decorationTypes = new Map<string, vscode.TextEditorDecorationType>();

export function ensureDecorationTypes(): void {
  const prefixes = getAllPrefixes();
  for (const prefix of prefixes) {
    if (decorationTypes.has(prefix)) continue;
    const color = getPrefixColor(prefix);
    decorationTypes.set(prefix, vscode.window.createTextEditorDecorationType({
      color,
      fontWeight: 'bold',
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
    }));
  }
}

export function updateDecorations(editor: vscode.TextEditor): void {
  ensureDecorationTypes();
  const doc = editor.document;
  const prefixes = getAllPrefixes();
  const pattern = new RegExp(`\\b(${prefixes.join('|')})\\b`, 'gi');
  const rangeMap = new Map<string, vscode.Range[]>();
  for (const p of prefixes) rangeMap.set(p, []);
  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i).text;
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(line)) !== null) {
      const prefix = match[1].toUpperCase();
      const start = new vscode.Position(i, match.index);
      const end = new vscode.Position(i, match.index + match[1].length);
      rangeMap.get(prefix)?.push(new vscode.Range(start, end));
    }
  }
  for (const [prefix, ranges] of rangeMap) {
    const dt = decorationTypes.get(prefix);
    if (dt) editor.setDecorations(dt, ranges);
  }
}

export function clearDecorations(editor: vscode.TextEditor): void {
  for (const dt of decorationTypes.values()) editor.setDecorations(dt, []);
}

export function disposeDecorations(): void {
  for (const dt of decorationTypes.values()) dt.dispose();
  decorationTypes.clear();
}

export function resetDecorationTypes(): void { // call on config change
  disposeDecorations();
  ensureDecorationTypes();
}
