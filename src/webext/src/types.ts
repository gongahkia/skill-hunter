export type EditorType = 'docs' | 'sheets' | 'slides';
export type AccessMode = 'readonly' | 'write';
export type MutationAction = 'highlight' | 'markDone' | 'archive';
export type BrowserTarget = 'chrome' | 'firefox' | 'safari';

export interface PrefixMatch {
  prefix: string;
  rawText: string;
  content: string;
  matchStart: number;
  prefixStart: number;
  prefixEnd: number;
}

export interface TextRange {
  start: number;
  end: number;
}

export interface NavigationTarget {
  queryText: string;
  locationLabel: string;
  sheetId?: number;
  cellA1?: string;
}

export interface MutationMetadata {
  prefixRange?: TextRange;
  blockRange?: TextRange;
  sheetId?: number;
  row?: number;
  col?: number;
  cellA1?: string;
  objectId?: string;
  textRange?: TextRange;
  appendText?: string;
}

export interface TagEntry {
  id: string;
  editor: EditorType;
  documentId: string;
  prefix: string;
  rawText: string;
  content: string;
  locationLabel: string;
  logicalLocation: string;
  navigation: NavigationTarget;
  mutation: MutationMetadata;
}

export interface ScanResult {
  editor: EditorType;
  documentId: string;
  title: string;
  entries: TagEntry[];
}

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
}

export interface OAuthClientIds {
  chrome: string;
  firefox: string;
  safari: string;
}

export interface WebExtSettings {
  colorscheme: string;
  customPrefixes: string[];
  alwaysEnableOnGoogleEditors: boolean;
  oauthClientIds: OAuthClientIds;
}

export interface PermissionProfile {
  editor: EditorType;
  accessMode: AccessMode;
  oauthScopes: string[];
  firefoxDataTypes: string[];
}

export interface EditorContext {
  editor: EditorType;
  documentId: string;
  url: string;
  sheetGid?: number;
  slideObjectId?: string;
}

export interface AuthLaunchRequest {
  authUrl: string;
  interactive: boolean;
}

export interface AuthLauncher {
  getRedirectUri(): Promise<string>;
  launch(request: AuthLaunchRequest): Promise<string>;
}

export interface EditorAdapter {
  scan(context: EditorContext, prefixes: string[], accessToken: string): Promise<ScanResult>;
  highlight(
    context: EditorContext,
    entries: TagEntry[],
    accessToken: string,
    colorscheme: string
  ): Promise<void>;
  markDone(context: EditorContext, entries: TagEntry[], accessToken: string): Promise<void>;
  archive(context: EditorContext, entries: TagEntry[], accessToken: string): Promise<void>;
  buildMutationPreview(action: MutationAction, entries: TagEntry[]): string;
}

export interface PopupState {
  browser: BrowserTarget;
  settings: WebExtSettings;
  currentContext?: EditorContext;
  lastScan?: ScanResult;
}

export interface RuntimeMessageMap {
  getPopupState: undefined;
  saveSettings: WebExtSettings;
  scanCurrentDocument: undefined;
  signOut: undefined;
  navigateBestEffort: TagEntry;
  runMutation: {
    action: MutationAction;
    entries: TagEntry[];
  };
}
