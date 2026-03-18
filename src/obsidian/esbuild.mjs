import { builtinModules } from 'node:module';
import process from 'node:process';
import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');
const external = [
  'obsidian',
  'electron',
  ...builtinModules,
  ...builtinModules.map((mod) => `node:${mod}`),
];

const ctx = await esbuild.context({
  entryPoints: ['main.ts'],
  bundle: true,
  external,
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  logLevel: 'info',
  sourcemap: production ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
});

if (watch) {
  await ctx.watch();
  console.log('Watching Obsidian plugin sources...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
