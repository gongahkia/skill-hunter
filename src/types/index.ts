/**
 * Core type definitions for Skill Hunter
 */

export interface PageMetadata {
  url: string;
  title: string;
  logoLink: string;
  characterSet: string;
  description: string;
}

export interface TableOfContentsItem {
  referenceText: string;
  referenceUrl: string;
}

export interface PageBasicData {
  legislationTitle: string;
  legislationPDFDownloadLink: string;
  legislationStatus: string;
  tableOfContents: TableOfContentsItem[];
}

export interface LegislationMetadata {
  legislationName: string;
  legislationDescription: string;
  legislationDate: string;
  revisedLegislationName: string;
  revisedLegislationText: string;
}

export interface Definition {
  [term: string]: string;
}

export type ContentTokenType =
  | 'sectionHeader'
  | 'sectionBody'
  | 'provisionHeader'
  | 'provisionNumber'
  | 'illustrationHeader'
  | 'illustrationBody';

export interface ContentToken {
  type: ContentTokenType;
  ID: string | null;
  content: string;
}

export interface HTMLContent {
  title: string;
  content: string;
}

export type SkillHunterMessageAction = 'toggle_simplified_view' | 'check_supported_page';

export interface ChromeMessage {
  action: SkillHunterMessageAction;
}

export interface ChromeMessageResponse {
  status: 'success' | 'error' | 'unsupported_page';
  isSimplified?: boolean;
  supportedPage?: boolean;
  error?: string;
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

export interface LegislationNote {
  statuteKey: string;
  statuteTitle: string;
  statuteUrl: string;
  note: string;
  updatedAt: string;
}
