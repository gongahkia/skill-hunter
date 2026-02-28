export type SegmentedClause = {
  heading: string | null;
  text: string;
  startOffset: number;
  endOffset: number;
};

const headingPattern =
  /^(section|clause|article)\s+[a-z0-9.-]+|^\d+(\.\d+)*[.)]|^\([a-z]\)|^[A-Z][A-Z\s]{4,}$/i;

function splitLongClauseBySentences(clause: SegmentedClause): SegmentedClause[] {
  if (clause.text.length <= 2400) {
    return [clause];
  }

  const sentenceParts = clause.text.split(/(?<=[.!?;:])\s+/g);

  if (sentenceParts.length < 2) {
    return [clause];
  }

  const output: SegmentedClause[] = [];
  let chunkText = "";
  let chunkStart = clause.startOffset;
  let cursor = clause.startOffset;

  for (const sentence of sentenceParts) {
    const candidate = chunkText ? `${chunkText} ${sentence}` : sentence;

    if (candidate.length > 1200 && chunkText) {
      output.push({
        heading: clause.heading,
        text: chunkText,
        startOffset: chunkStart,
        endOffset: chunkStart + chunkText.length
      });

      chunkStart = cursor;
      chunkText = sentence;
    } else {
      chunkText = candidate;
    }

    cursor += sentence.length + 1;
  }

  if (chunkText) {
    output.push({
      heading: clause.heading,
      text: chunkText,
      startOffset: chunkStart,
      endOffset: chunkStart + chunkText.length
    });
  }

  return output;
}

export function segmentContractClauses(text: string): SegmentedClause[] {
  const blocks = text
    .split(/\n{2,}/g)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return [];
  }

  const clauses: SegmentedClause[] = [];
  let currentClause: SegmentedClause | null = null;
  let cursor = 0;

  for (const block of blocks) {
    const blockStart = text.indexOf(block, cursor);
    const blockEnd = blockStart + block.length;
    cursor = blockEnd;

    const isHeading = headingPattern.test(block);

    if (isHeading || !currentClause) {
      if (currentClause) {
        clauses.push(currentClause);
      }

      currentClause = {
        heading: block,
        text: block,
        startOffset: blockStart,
        endOffset: blockEnd
      };

      continue;
    }

    currentClause.text = `${currentClause.text}\n\n${block}`;
    currentClause.endOffset = blockEnd;
  }

  if (currentClause) {
    clauses.push(currentClause);
  }

  return clauses.flatMap(splitLongClauseBySentences);
}
