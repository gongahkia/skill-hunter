/**
 * Application constants
 */

export const SELECTORS = {
  // Navigation and header
  TOP_PANEL: 'div#nav.affix-top div#topLeftPanel.top-left-panel',
  LEGIS_TITLE: 'div.legis-title',
  PDF_LINK: 'span.fa.fa-file-pdf-o',
  STATUS_VALUE: 'div.status-value',

  // Table of contents
  TOC_PANEL: 'div#tocPanel.toc-panel div#tocNav nav#toc',
  TOC_LINKS: 'a.nav-link',

  // Content sections
  LEGIS_CONTENT: 'div#colLegis div#legisContent',
  LEGIS_FRONT: 'div.front',
  LEGIS_BODY: 'div.body',
  PROVISION_CONTAINERS: "div[class^='prov']",

  // Specific content elements
  ACT_HEADER: 'table tbody tr td.actHd',
  LONG_TITLE: 'table tbody tr td.longTitle',
  C_DATE: 'table tbody tr td.cDate',
  REVISED_HEADER: 'table tbody tr td.revdHdr',
  REVISED_TEXT: 'table tbody tr td.revdTxt',

  // Provision elements
  SECTION_HEADER: "td[class^='prov'][class$='Hdr']",
  SECTION_BODY: "td[class^='prov'][class$='Txt']",
  PROVISION_HEADER: 'td.partHdr',
  PROVISION_NUMBER: 'td.part',
  PROVISION_NUMBER_DIV: 'div.partNo',
  DEFINITION_CELL: 'td.def',
  ILLUSTRATION_CELL: 'td.fs',
} as const;

export const LEGISLATION_URLS = {
  ACTS: 'https://sso.agc.gov.sg/Act/*?WholeDoc=1',
  SUBSIDIARY: 'https://sso.agc.gov.sg/SL/*WholeDoc=1',
  BILLS: 'https://sso.agc.gov.sg/Bills-Supp/*WholeDoc=1',
} as const;

export const LOGICAL_CONNECTORS = [
  'and',
  'also',
  'as well as',
  'in addition',
  'furthermore',
  'moreover',
  'but',
  'however',
  'on the other hand',
  'yet',
  'although',
  'nevertheless',
  'because',
  'since',
  'therefore',
  'thus',
  'as a result',
  'consequently',
  'similarly',
  'likewise',
  'in the same way',
  'first',
  'then',
  'next',
  'finally',
  'afterward',
  'if',
  'unless',
  'provided that',
  'besides',
  'not only... but also',
  'along with',
  'as well',
  'despite',
  'in contrast',
  'on the contrary',
  'even though',
  'rather',
  'due to',
  'owing to',
  'for this reason',
  'accordingly',
  'in comparison',
  'just as',
  'equally',
  'correspondingly',
  'subsequently',
  'prior to',
  'simultaneously',
  'at the same time',
  'earlier',
  'in case',
  'assuming that',
  'even if',
  'as long as',
  'granted that',
  'admittedly',
  'regardless',
  'in summary',
  'to sum up',
  'in conclusion',
  'all in all',
  'ultimately',
  'for example',
  'for instance',
  'to illustrate',
  'in other words',
  'or',
  'nor',
  'either',
  'alternatively',
  'otherwise',
] as const;

export const STORAGE_KEYS = {
  COLOR_SCHEME: 'skillhunter_color_scheme',
  FONT_FAMILY: 'skillhunter_font_family',
  SIMPLIFIED_STATE: 'skillhunter_simplified_state',
  USER_PREFERENCES: 'skillhunter_preferences',
} as const;

export const EVENTS = {
  SIMPLIFY: 'simplify',
  REVERT: 'revert',
  SETTINGS_UPDATED: 'settings_updated',
} as const;

