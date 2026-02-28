export type ClauseSnapshot = {
  id: string;
  type: string;
  normalizedText: string;
  startOffset: number;
  endOffset: number;
};

export type ClauseDiffItem = {
  changeType: "unchanged" | "modified" | "added" | "removed";
  similarity: number;
  fromClause: ClauseSnapshot | null;
  toClause: ClauseSnapshot | null;
};

export type ContractVersionDiffResult = {
  summary: {
    unchanged: number;
    modified: number;
    added: number;
    removed: number;
  };
  changes: ClauseDiffItem[];
};

function normalizeClauseText(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildTokenSet(text: string) {
  return new Set(
    normalizeClauseText(text)
      .split(/[^a-z0-9]+/g)
      .map((token) => token.trim())
      .filter((token) => token.length > 1)
  );
}

function jaccardSimilarity(left: Set<string>, right: Set<string>) {
  if (left.size === 0 && right.size === 0) {
    return 1;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...left, ...right]).size;
  if (union === 0) {
    return 0;
  }

  return intersection / union;
}

export function diffContractVersions(
  fromClauses: ClauseSnapshot[],
  toClauses: ClauseSnapshot[]
): ContractVersionDiffResult {
  const normalizedFrom = fromClauses.map((clause) => ({
    clause,
    normalizedText: normalizeClauseText(clause.normalizedText),
    tokens: buildTokenSet(clause.normalizedText)
  }));
  const normalizedTo = toClauses.map((clause) => ({
    clause,
    normalizedText: normalizeClauseText(clause.normalizedText),
    tokens: buildTokenSet(clause.normalizedText)
  }));

  const unmatchedFrom = new Set(normalizedFrom.map((item) => item.clause.id));
  const unmatchedTo = new Set(normalizedTo.map((item) => item.clause.id));
  const changes: ClauseDiffItem[] = [];

  for (const nextClause of normalizedTo) {
    const exactMatch = normalizedFrom.find(
      (candidate) =>
        unmatchedFrom.has(candidate.clause.id) &&
        candidate.clause.type === nextClause.clause.type &&
        candidate.normalizedText === nextClause.normalizedText
    );

    if (!exactMatch) {
      continue;
    }

    unmatchedFrom.delete(exactMatch.clause.id);
    unmatchedTo.delete(nextClause.clause.id);
    changes.push({
      changeType: "unchanged",
      similarity: 1,
      fromClause: exactMatch.clause,
      toClause: nextClause.clause
    });
  }

  for (const nextClause of normalizedTo) {
    if (!unmatchedTo.has(nextClause.clause.id)) {
      continue;
    }

    let bestCandidate: (typeof normalizedFrom)[number] | null = null;
    let bestScore = 0;

    for (const candidate of normalizedFrom) {
      if (!unmatchedFrom.has(candidate.clause.id)) {
        continue;
      }

      const baseScore = jaccardSimilarity(candidate.tokens, nextClause.tokens);
      const typeBonus = candidate.clause.type === nextClause.clause.type ? 0.05 : 0;
      const score = Math.min(1, baseScore + typeBonus);

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate || bestScore < 0.55) {
      continue;
    }

    unmatchedFrom.delete(bestCandidate.clause.id);
    unmatchedTo.delete(nextClause.clause.id);
    changes.push({
      changeType: "modified",
      similarity: Math.round(bestScore * 1000) / 1000,
      fromClause: bestCandidate.clause,
      toClause: nextClause.clause
    });
  }

  for (const removedClauseId of unmatchedFrom) {
    const removedClause = normalizedFrom.find((item) => item.clause.id === removedClauseId)?.clause;
    if (!removedClause) {
      continue;
    }

    changes.push({
      changeType: "removed",
      similarity: 0,
      fromClause: removedClause,
      toClause: null
    });
  }

  for (const addedClauseId of unmatchedTo) {
    const addedClause = normalizedTo.find((item) => item.clause.id === addedClauseId)?.clause;
    if (!addedClause) {
      continue;
    }

    changes.push({
      changeType: "added",
      similarity: 0,
      fromClause: null,
      toClause: addedClause
    });
  }

  changes.sort((left, right) => {
    const leftOffset = left.toClause?.startOffset ?? left.fromClause?.startOffset ?? 0;
    const rightOffset = right.toClause?.startOffset ?? right.fromClause?.startOffset ?? 0;
    return leftOffset - rightOffset;
  });

  return {
    summary: {
      unchanged: changes.filter((item) => item.changeType === "unchanged").length,
      modified: changes.filter((item) => item.changeType === "modified").length,
      added: changes.filter((item) => item.changeType === "added").length,
      removed: changes.filter((item) => item.changeType === "removed").length
    },
    changes
  };
}
