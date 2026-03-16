export const BUILT_IN_PREFIXES = ['TODO', 'FIXME', 'TEMP', 'REF', 'REV'];
export const PRIORITY: Record<string, number> = { FIXME: 1, TODO: 2, REV: 3, TEMP: 4, REF: 5 };
export const FALLBACK_COLORS: Record<string, string> = { // for custom prefixes
  0: '#e0af68', 1: '#f7768e', 2: '#9ece6a', 3: '#7aa2f7', 4: '#bb9af7',
  5: '#e5c07b', 6: '#e06c75', 7: '#98c379', 8: '#61afef', 9: '#c678dd',
};
export interface SchemeColors { TODO: string; FIXME: string; TEMP: string; REF: string; REV: string; [key: string]: string; }
export const COLORSCHEMES: Record<string, SchemeColors> = {
  gruvbox: { TODO: '#FABD2F', FIXME: '#FB4934', TEMP: '#8EC07C', REF: '#83A598', REV: '#D3869B' },
  everforest: { TODO: '#d8a657', FIXME: '#e67e80', TEMP: '#a7c080', REF: '#7fbbb3', REV: '#d699b6' },
  tokyoNight: { TODO: '#e0af68', FIXME: '#f7768e', TEMP: '#9ece6a', REF: '#7aa2f7', REV: '#bb9af7' },
  atomDark: { TODO: '#e5c07b', FIXME: '#e06c75', TEMP: '#98c379', REF: '#61afef', REV: '#c678dd' },
  monokai: { TODO: '#f4bf75', FIXME: '#f92672', TEMP: '#a6e22e', REF: '#66d9ef', REV: '#ae81ff' },
  github: { TODO: '#6f42c1', FIXME: '#d73a49', TEMP: '#28a745', REF: '#0366d6', REV: '#005cc5' },
  ayu: { TODO: '#ff9940', FIXME: '#f07178', TEMP: '#aad94c', REF: '#39bae6', REV: '#c296eb' },
  dracula: { TODO: '#f1fa8c', FIXME: '#ff5555', TEMP: '#50fa7b', REF: '#8be9fd', REV: '#bd93f9' },
  rosePine: { TODO: '#f6c177', FIXME: '#eb6f92', TEMP: '#9ccfd8', REF: '#31748f', REV: '#c4a7e7' },
  spacemacs: { TODO: '#dcaeea', FIXME: '#fc5c94', TEMP: '#86dc2f', REF: '#36c6d3', REV: '#a9a1e1' },
};
export function getColor(scheme: string, prefix: string, idx: number): string { // resolve color for a prefix
  const s = COLORSCHEMES[scheme] || COLORSCHEMES['gruvbox'];
  return s[prefix] || FALLBACK_COLORS[String(idx % 10)] || '#cccccc';
}
