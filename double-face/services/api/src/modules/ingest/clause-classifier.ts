import { ClauseType } from "@prisma/client";

import type { SegmentedClause } from "./clause-segmentation";

type ClauseRule = {
  type: ClauseType;
  patterns: RegExp[];
};

const clauseRules: ClauseRule[] = [
  {
    type: ClauseType.DEFINITIONS,
    patterns: [/\bdefinitions?\b/i, /\bdefined terms?\b/i]
  },
  {
    type: ClauseType.SCOPE,
    patterns: [/\bscope\b/i, /\bservices\b/i, /\bstatement of work\b/i]
  },
  {
    type: ClauseType.PAYMENT,
    patterns: [/\bpayment\b/i, /\bfees?\b/i, /\binvoice\b/i]
  },
  {
    type: ClauseType.TERM,
    patterns: [/\bterm\b/i, /\beffective date\b/i, /\bcommencement\b/i]
  },
  {
    type: ClauseType.TERMINATION,
    patterns: [/\btermination\b/i, /\bterminate\b/i, /\bfor cause\b/i]
  },
  {
    type: ClauseType.LIABILITY,
    patterns: [/\bliability\b/i, /\blimit(?:ation)? of liability\b/i]
  },
  {
    type: ClauseType.INDEMNITY,
    patterns: [/\bindemnif(?:y|ication)\b/i, /\bhold harmless\b/i]
  },
  {
    type: ClauseType.IP,
    patterns: [
      /\bintellectual property\b/i,
      /\bownership\b/i,
      /\blicense\b/i,
      /\bcopyright\b/i
    ]
  },
  {
    type: ClauseType.CONFIDENTIALITY,
    patterns: [/\bconfidential(?:ity)?\b/i, /\bnon-disclosure\b/i]
  },
  {
    type: ClauseType.PRIVACY,
    patterns: [/\bprivacy\b/i, /\bpersonal data\b/i, /\bdata protection\b/i]
  },
  {
    type: ClauseType.GOVERNING_LAW,
    patterns: [/\bgoverning law\b/i, /\bjurisdiction\b/i]
  },
  {
    type: ClauseType.DISPUTE_RESOLUTION,
    patterns: [/\barbitration\b/i, /\bdispute resolution\b/i, /\bvenue\b/i]
  }
];

export function classifyClauseType(clause: SegmentedClause): ClauseType {
  const searchText = `${clause.heading ?? ""}\n${clause.text}`;

  for (const rule of clauseRules) {
    if (rule.patterns.some((pattern) => pattern.test(searchText))) {
      return rule.type;
    }
  }

  return ClauseType.UNKNOWN;
}
