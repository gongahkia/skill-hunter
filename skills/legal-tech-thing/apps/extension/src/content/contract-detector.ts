export const CONTRACT_DETECTION_MESSAGE_TYPE = "extension.pageDetection.v1";

const DETECTION_THRESHOLD = 8;
const MAX_BODY_TEXT_CHARS = 120_000;
const MAX_HEADING_TEXT_CHARS = 8_000;

type SignalKind = "phrase" | "url" | "title" | "heading";

interface DetectorRule {
  label: string;
  pattern: RegExp;
  weight: number;
  signal: SignalKind;
}

export interface ContractDetectionResult {
  url: string;
  title: string;
  isContractLike: boolean;
  score: number;
  confidence: number;
  matchedPhrases: string[];
  matchedSignals: string[];
  scannedAt: string;
  scannedCharacters: number;
}

const LEGAL_PHRASE_RULES: DetectorRule[] = [
  { label: "terms of service", pattern: /\bterms of service\b/i, weight: 3, signal: "phrase" },
  { label: "terms and conditions", pattern: /\bterms (?:and|&) conditions\b/i, weight: 3, signal: "phrase" },
  { label: "privacy policy", pattern: /\bprivacy policy\b/i, weight: 3, signal: "phrase" },
  { label: "end user license agreement", pattern: /\bend user license agreement\b|\beula\b/i, weight: 3, signal: "phrase" },
  { label: "arbitration", pattern: /\barbitration\b/i, weight: 2, signal: "phrase" },
  { label: "governing law", pattern: /\bgoverning law\b/i, weight: 2, signal: "phrase" },
  { label: "limitation of liability", pattern: /\blimitation of liability\b/i, weight: 2, signal: "phrase" },
  { label: "indemnif(y|ication)", pattern: /\bindemnif(?:y|ication)\b/i, weight: 2, signal: "phrase" },
  { label: "dispute resolution", pattern: /\bdispute resolution\b/i, weight: 2, signal: "phrase" },
  { label: "waiver of rights", pattern: /\bwaive\b|\bwaiver\b/i, weight: 1, signal: "phrase" },
  { label: "class action waiver", pattern: /\bclass action waiver\b/i, weight: 2, signal: "phrase" },
  { label: "termination", pattern: /\btermination\b/i, weight: 1, signal: "phrase" },
  { label: "intellectual property", pattern: /\bintellectual property\b/i, weight: 1, signal: "phrase" },
  { label: "license grant", pattern: /\blicense grant\b|\bgrant(?:ed)? license\b/i, weight: 1, signal: "phrase" }
];

const URL_RULES: DetectorRule[] = [
  { label: "url: terms path", pattern: /\/(?:terms|tos|conditions)(?:\/|$)/i, weight: 3, signal: "url" },
  { label: "url: policy path", pattern: /\/(?:privacy|policy|legal)(?:\/|$)/i, weight: 2, signal: "url" },
  { label: "url: agreement path", pattern: /\/(?:agreement|eula|license)(?:\/|$)/i, weight: 3, signal: "url" }
];

const TITLE_RULES: DetectorRule[] = [
  { label: "title: terms", pattern: /\bterms\b|\bconditions\b/i, weight: 2, signal: "title" },
  { label: "title: policy", pattern: /\bprivacy\b|\bpolicy\b|\blegal\b/i, weight: 2, signal: "title" },
  { label: "title: agreement", pattern: /\bagreement\b|\beula\b|\blicense\b/i, weight: 2, signal: "title" }
];

const HEADING_RULES: DetectorRule[] = [
  { label: "heading: terms", pattern: /\bterms\b|\bconditions\b/i, weight: 2, signal: "heading" },
  { label: "heading: policy", pattern: /\bprivacy\b|\bpolicy\b|\blegal\b/i, weight: 2, signal: "heading" },
  { label: "heading: agreement", pattern: /\bagreement\b|\blicense\b/i, weight: 2, signal: "heading" }
];

function evaluateRules(text: string, rules: DetectorRule[]) {
  const matches: DetectorRule[] = [];

  for (const rule of rules) {
    if (!rule.pattern.test(text)) {
      continue;
    }
    matches.push(rule);
  }

  return matches;
}

function uniqueLabels(matches: DetectorRule[], kind: SignalKind) {
  const labels = new Set<string>();
  for (const match of matches) {
    if (match.signal === kind) {
      labels.add(match.label);
    }
  }
  return Array.from(labels);
}

function collectHeadingText(doc: Document) {
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3")).slice(0, 25);
  const text = headings
    .map((heading) => heading.textContent?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .slice(0, MAX_HEADING_TEXT_CHARS);

  return text;
}

function sumWeight(matches: DetectorRule[]) {
  return matches.reduce((total, match) => total + match.weight, 0);
}

function toConfidence(score: number) {
  const normalized = (score - DETECTION_THRESHOLD + 4) / 10;
  return Math.max(0, Math.min(1, normalized));
}

export function detectContractLikePage(doc: Document, pageUrl: string): ContractDetectionResult {
  const bodyText = (doc.body?.innerText ?? "").slice(0, MAX_BODY_TEXT_CHARS);
  const title = doc.title ?? "";
  const headingText = collectHeadingText(doc);

  const phraseMatches = evaluateRules(bodyText, LEGAL_PHRASE_RULES);
  const urlMatches = evaluateRules(pageUrl, URL_RULES);
  const titleMatches = evaluateRules(title, TITLE_RULES);
  const headingMatches = evaluateRules(headingText, HEADING_RULES);

  const matches = [...phraseMatches, ...urlMatches, ...titleMatches, ...headingMatches];
  let score = sumWeight(matches);

  // Require some baseline text before classifying pages as contract-like.
  if (bodyText.length > 1_000) {
    score += 1;
  }

  return {
    url: pageUrl,
    title,
    isContractLike: score >= DETECTION_THRESHOLD,
    score,
    confidence: toConfidence(score),
    matchedPhrases: uniqueLabels(phraseMatches, "phrase"),
    matchedSignals: [
      ...uniqueLabels(urlMatches, "url"),
      ...uniqueLabels(titleMatches, "title"),
      ...uniqueLabels(headingMatches, "heading")
    ],
    scannedAt: new Date().toISOString(),
    scannedCharacters: bodyText.length
  };
}
