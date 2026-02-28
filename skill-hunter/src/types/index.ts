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
  style: string;
  content: string;
}

export interface BackupContent {
  title: string;
  style: string | null;
  content: string;
}

export interface ChromeMessage {
  action: 'simplify' | 'cancel' | 'settings';
  toggle?: boolean;
}

export interface ChromeMessageResponse {
  status: 'success' | 'error';
  error?: string;
}

export enum ColorScheme {
  Dark = 'dark',
  Light = 'light',
  Gruvbox = 'gruvbox',
  Everforest = 'everforest',
  SolarizedDark = 'solarized-dark',
  SolarizedLight = 'solarized-light',
  Dracula = 'dracula',
  Monokai = 'monokai',
  Nord = 'nord',
  TokyoNight = 'tokyo-night',
}

export interface ColorSchemeConfig {
  '--bg-color': string;
  '--text-color': string;
  '--accent-color'?: string;
  '--border-color'?: string;
}

export type ColorSchemeMap = Record<ColorScheme, ColorSchemeConfig>;

