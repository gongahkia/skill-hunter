import * as vscode from 'vscode';
import { scanDocument, scanWorkspace, TagEntry } from './scanner';
import { OwlTreeProvider } from './provider';
import { updateDecorations, clearDecorations, disposeDecorations, resetDecorationTypes } from './decorator';
import { exportJson, exportMd } from './commands';
import { getScanOnSave } from './config';

let treeProvider: OwlTreeProvider;
let currentTags = new Map<string, TagEntry[]>();
let highlightsEnabled = true;

function doScan(doc: vscode.TextDocument): void {
  currentTags = scanDocument(doc);
  treeProvider.refresh(currentTags);
  const editor = vscode.window.activeTextEditor;
  if (editor && highlightsEnabled) updateDecorations(editor);
}

function doScanWorkspace(): void {
  currentTags = scanWorkspace();
  treeProvider.refresh(currentTags);
  const editor = vscode.window.activeTextEditor;
  if (editor && highlightsEnabled) updateDecorations(editor);
}

export function activate(ctx: vscode.ExtensionContext): void {
  treeProvider = new OwlTreeProvider();
  ctx.subscriptions.push(
    vscode.window.registerTreeDataProvider('owl-tags-view', treeProvider),
    vscode.commands.registerCommand('owl-tags.scan', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) doScan(editor.document);
    }),
    vscode.commands.registerCommand('owl-tags.scanWorkspace', () => doScanWorkspace()),
    vscode.commands.registerCommand('owl-tags.highlight', () => {
      highlightsEnabled = !highlightsEnabled;
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      if (highlightsEnabled) updateDecorations(editor);
      else clearDecorations(editor);
      vscode.window.showInformationMessage(`Owl highlights ${highlightsEnabled ? 'on' : 'off'}`);
    }),
    vscode.commands.registerCommand('owl-tags.exportJson', () => exportJson(currentTags)),
    vscode.commands.registerCommand('owl-tags.exportMd', () => exportMd(currentTags)),
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (getScanOnSave()) doScan(doc);
    }),
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && highlightsEnabled) {
        doScan(editor.document);
      }
    }),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('owl-tags')) {
        resetDecorationTypes();
        const editor = vscode.window.activeTextEditor;
        if (editor) doScan(editor.document);
      }
    }),
  );
  const editor = vscode.window.activeTextEditor; // scan on activate
  if (editor) doScan(editor.document);
}

export function deactivate(): void {
  disposeDecorations();
}
