import { BrowserTarget, EditorType, OAuthClientIds, WebExtSettings } from './types';

export const BUILTIN_PREFIXES = ['TODO', 'FIXME', 'TEMP', 'REF', 'REV'] as const;

export const COLORSCHEMES: Record<string, Record<string, string>> = {
  gruvbox: {
    TODO: '#FABD2F',
    FIXME: '#FB4934',
    TEMP: '#8EC07C',
    REF: '#83A598',
    REV: '#D3869B',
  },
  everforest: {
    TODO: '#d8a657',
    FIXME: '#e67e80',
    TEMP: '#a7c080',
    REF: '#7fbbb3',
    REV: '#d699b6',
  },
  tokyoNight: {
    TODO: '#e0af68',
    FIXME: '#f7768e',
    TEMP: '#9ece6a',
    REF: '#7aa2f7',
    REV: '#bb9af7',
  },
  atomDark: {
    TODO: '#e5c07b',
    FIXME: '#e06c75',
    TEMP: '#98c379',
    REF: '#61afef',
    REV: '#c678dd',
  },
  monokai: {
    TODO: '#f4bf75',
    FIXME: '#f92672',
    TEMP: '#a6e22e',
    REF: '#66d9ef',
    REV: '#ae81ff',
  },
  github: {
    TODO: '#6f42c1',
    FIXME: '#d73a49',
    TEMP: '#28a745',
    REF: '#0366d6',
    REV: '#005cc5',
  },
  ayu: {
    TODO: '#ff9940',
    FIXME: '#f07178',
    TEMP: '#aad94c',
    REF: '#39bae6',
    REV: '#c296eb',
  },
  dracula: {
    TODO: '#f1fa8c',
    FIXME: '#ff5555',
    TEMP: '#50fa7b',
    REF: '#8be9fd',
    REV: '#bd93f9',
  },
  rosePine: {
    TODO: '#f6c177',
    FIXME: '#eb6f92',
    TEMP: '#9ccfd8',
    REF: '#31748f',
    REV: '#c4a7e7',
  },
  spacemacs: {
    TODO: '#dcaeea',
    FIXME: '#fc5c94',
    TEMP: '#86dc2f',
    REF: '#36c6d3',
    REV: '#a9a1e1',
  },
};

export const GOOGLE_EDITOR_PAGE_PATTERNS = [
  'https://docs.google.com/document/*',
  'https://docs.google.com/spreadsheets/*',
  'https://docs.google.com/presentation/*',
];

export const GOOGLE_API_HOST_PATTERNS = [
  'https://accounts.google.com/*',
  'https://oauth2.googleapis.com/*',
  'https://www.googleapis.com/*',
];

export const OAUTH_SCOPE_MAP: Record<
  EditorType,
  Record<'readonly' | 'write', string[]>
> = {
  docs: {
    readonly: ['https://www.googleapis.com/auth/documents.readonly'],
    write: ['https://www.googleapis.com/auth/documents'],
  },
  sheets: {
    readonly: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    write: ['https://www.googleapis.com/auth/spreadsheets'],
  },
  slides: {
    readonly: ['https://www.googleapis.com/auth/presentations.readonly'],
    write: ['https://www.googleapis.com/auth/presentations'],
  },
};

export const FIREFOX_DATA_TYPES = ['authenticationInfo', 'websiteContent'];

export const DEFAULT_OAUTH_CLIENT_IDS: OAuthClientIds = {
  chrome: '',
  firefox: '',
  safari: '',
};

export const DEFAULT_SETTINGS: WebExtSettings = {
  colorscheme: 'gruvbox',
  customPrefixes: [],
  alwaysEnableOnGoogleEditors: false,
  oauthClientIds: DEFAULT_OAUTH_CLIENT_IDS,
};

export const BROWSER_LABELS: Record<BrowserTarget, string> = {
  chrome: 'Chrome',
  firefox: 'Firefox',
  safari: 'Safari',
};
