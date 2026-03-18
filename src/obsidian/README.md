# Owl Tags in Obsidian

This directory now contains the source and build tooling for the Obsidian plugin.

## Build

```bash
cd /Users/gongahkia/Desktop/coding/projects/owl/src/obsidian
npm install
npm run build
```

This produces `main.js` next to `manifest.json` and `styles.css`, which is the layout Obsidian expects for a local plugin.

## Load In Obsidian

1. Open your vault.
2. Create the plugin folder: `.obsidian/plugins/owl-tags/`
3. Copy or symlink these files into that folder:
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. In Obsidian, enable Community Plugins if needed.
5. Enable `Owl Tags`.

## Development

```bash
cd /Users/gongahkia/Desktop/coding/projects/owl/src/obsidian
npm run dev
```

After rebuilding, reload Obsidian with `Ctrl/Cmd + R`.
