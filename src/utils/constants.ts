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

export const SUPPORTED_SSO_PATH_PREFIXES = ['/Act/', '/SL/', '/Bills-Supp/'] as const;

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

export const SKILL_HUNTER_IDS = {
  ROOT_HOST: 'skill-hunter-root',
  TOC_TARGET_ATTR: 'data-skill-hunter-scroll-target',
  ACTION_ATTR: 'data-skill-hunter-action',
  MAIN_CONTENT_ID: 'skill-hunter-main-content',
  SEARCH_INPUT_ID: 'skill-hunter-search-input',
  SEARCH_COUNT_ID: 'skill-hunter-search-count',
  SEARCH_PREV_ID: 'skill-hunter-search-prev',
  SEARCH_NEXT_ID: 'skill-hunter-search-next',
  NOTE_PANEL_ID: 'skill-hunter-note-panel',
  NOTE_TEXTAREA_ID: 'skill-hunter-note-textarea',
  NOTE_STATUS_ID: 'skill-hunter-note-status',
  CITATION_FORMAT_ID: 'skill-hunter-citation-format',
  COPY_CITATION_ID: 'skill-hunter-copy-citation',
  COPY_LINK_ID: 'skill-hunter-copy-link',
  EXPORT_NOTE_ID: 'skill-hunter-export-note',
  EXPORT_DIAGNOSTICS_ID: 'skill-hunter-export-diagnostics',
  TIMELINE_BTN_ID: 'skill-hunter-timeline-btn',
  TIMELINE_PANEL_ID: 'skill-hunter-timeline-panel',
  TOAST_ID: 'skill-hunter-toast',
} as const;

export const STORAGE_KEYS = {
  NOTE_PREFIX: 'skill-hunter.note.',
} as const;

export const UX_LIMITS = {
  MAX_LOG_ENTRIES: 300,
  NOTE_MAX_CHARACTERS: 8000,
  SEARCH_QUERY_MAX_CHARACTERS: 80,
} as const;
