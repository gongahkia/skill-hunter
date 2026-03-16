import { App, TFile } from 'obsidian';
export interface TagEntry { text: string; file: TFile; line: number; path: string; prefix: string; }
export async function scanVault(app: App, prefixes: string[]): Promise<Map<string, TagEntry[]>> {
  const result = new Map<string, TagEntry[]>();
  prefixes.forEach(p => result.set(p.toUpperCase(), []));
  const files = app.vault.getMarkdownFiles();
  for (const file of files) {
    const content = await app.vault.cachedRead(file);
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const upper = trimmed.toUpperCase();
      for (const prefix of prefixes) {
        const pUpper = prefix.toUpperCase();
        if (upper.startsWith(pUpper + ':') || upper.startsWith(pUpper + ' ') || upper === pUpper) {
          const entries = result.get(pUpper) || [];
          entries.push({ text: trimmed, file, line: i, path: file.path, prefix: pUpper });
          result.set(pUpper, entries);
          break; // first match wins
        }
      }
    }
  }
  return result;
}
