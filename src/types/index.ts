export type Site = 'sso' | 'elit';
export interface PageSummary {
  site: Site;
  title: string;
  type: string;
  status: string;
  date: string;
  revisedTitle: string;
  court: string;
  citation: string;
  hasPdf: boolean;
  sourceUrl: string;
}
export interface ChromeMessage {
  action: 'get_page_summary' | 'check_supported_page';
}
export interface ChromeMessageResponse {
  status: 'success' | 'error' | 'unsupported_page';
  enabled?: boolean;
  supportedPage?: boolean;
  pageSummary?: PageSummary;
  error?: string;
}
export type Lookup =
  | { kind: 'document'; url: string }
  | { kind: 'statute-search'; title: string }
  | { kind: 'case-search'; phrase: string };
export interface FetchResponse {
  ok: boolean;
  html?: string;
  url?: string;
  error?: string;
}
export interface Preview {
  kind: string;
  title: string;
  text: string;
  detail?: string;
  url?: string;
  links?: Array<{ title: string; url: string; detail?: string }>;
}
export interface Reference {
  kind: 'statute' | 'case' | 'local' | 'definition' | 'abbreviation' | 'citing';
  label: string;
  url?: string;
  section?: string;
  act?: string;
  version?: string;
  text?: string;
  target?: Element;
}
export interface ReferenceMatch {
  start: number;
  end: number;
  reference: Reference;
}
export type LogLevelName = 'debug' | 'info' | 'warn' | 'error';
export interface DiagnosticLogEntry {
  sessionId: string;
  timestamp: string;
  level: LogLevelName;
  context: string;
  message: string;
  data?: unknown;
}
