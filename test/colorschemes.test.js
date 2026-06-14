import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadSrc } from './helpers.js';

function loadColorschemes() {
  const code = 'var module = undefined;\n' + loadSrc('ui/colorschemes.js') + '\nthis.result = OwlColorschemes;';
  const fn = new Function(code);
  const ctx = { result: null };
  fn.call(ctx);
  return ctx.result;
}

describe('OwlColorschemes', () => {
  it('ports the ten Owl colorschemes', () => {
    const colorschemes = loadColorschemes();
    const schemes = colorschemes.all();

    expect(schemes.map((scheme) => scheme.id)).toEqual([
      'gruvbox',
      'everforest',
      'tokyo-night',
      'atom-dark',
      'monokai',
      'github',
      'ayu',
      'dracula',
      'rose-pine',
      'spacemacs'
    ]);
    expect(colorschemes.get('gruvbox').colors).toEqual({
      BACKGROUND: '#282828',
      TODO: '#FABD2F',
      FIXME: '#FB4934',
      TEMP: '#8EC07C',
      REF: '#83A598',
      REV: '#D3869B'
    });
    expect(colorschemes.get('github').colors).toEqual({
      BACKGROUND: '#ffffff',
      TODO: '#6f42c1',
      FIXME: '#d73a49',
      TEMP: '#28a745',
      REF: '#0366d6',
      REV: '#005cc5'
    });
  });

  it('maps Owl constants to UI CSS variables', () => {
    const colorschemes = loadColorschemes();
    const vars = colorschemes.cssVars('tokyo-night');

    expect(vars['--bg']).toBe('#1a1b26');
    expect(vars['--primary']).toBe('#7aa2f7');
    expect(vars['--secondary']).toBe('#e0af68');
    expect(vars['--success']).toBe('#9ece6a');
    expect(vars['--danger']).toBe('#f7768e');
    expect(vars['--revision']).toBe('#bb9af7');
  });

  it('generates light and dark variants independent of scheme identity', () => {
    const colorschemes = loadColorschemes();
    const lightTokyo = colorschemes.cssVars('tokyo-night', 'light');
    const darkGithub = colorschemes.cssVars('github', 'dark');

    expect(lightTokyo['--bg']).not.toBe('#1a1b26');
    expect(lightTokyo['--ink']).toBe('#172232');
    expect(lightTokyo['--primary']).toBe('#7aa2f7');
    expect(darkGithub['--bg']).not.toBe('#ffffff');
    expect(darkGithub['--ink']).toBe('#f4f7fb');
    expect(darkGithub['--primary']).toBe('#0366d6');
  });

  it('applies a colorscheme to document root variables', () => {
    const colorschemes = loadColorschemes();
    const dom = new JSDOM('<!doctype html><html><body></body></html>');

    colorschemes.apply(dom.window.document, 'github', 'light');

    expect(dom.window.document.documentElement.dataset.colorscheme).toBe('github');
    expect(dom.window.document.documentElement.dataset.themeMode).toBe('light');
    expect(dom.window.document.documentElement.style.getPropertyValue('--bg')).toBe('#ffffff');
    expect(dom.window.document.documentElement.style.getPropertyValue('--primary')).toBe('#0366d6');
  });
});
