import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

function files(root) {
  return readdirSync(root).flatMap((name) => {
    const path = resolve(root, name);
    if (statSync(path).isDirectory()) return files(path);
    return [path];
  });
}

describe('Google Docs Apps Script policy', () => {
  it('does not ship Apps Script code in src', () => {
    const srcFiles = files(resolve(process.cwd(), 'src'));
    const source = srcFiles.map((path) => readFileSync(path, 'utf8')).join('\n');

    expect(srcFiles.filter((path) => path.endsWith('.gs'))).toEqual([]);
    expect(source).not.toMatch(/\bScriptApp\b|\bUrlFetchApp\b|google\.script/);
  });
});
