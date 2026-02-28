import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { ParsedContractDocument } from "./types";

type TextItemLike = {
  str: string;
  transform: number[];
};

type PdfTextBlock = {
  pageNumber: number;
  text: string;
  startOffset: number;
  endOffset: number;
};

function normalizeLineText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function groupLines(items: TextItemLike[]) {
  const sorted = [...items].sort((a, b) => {
    const yA = a.transform[5] ?? 0;
    const yB = b.transform[5] ?? 0;

    if (Math.abs(yA - yB) > 1.5) {
      return yB - yA;
    }

    const xA = a.transform[4] ?? 0;
    const xB = b.transform[4] ?? 0;

    return xA - xB;
  });

  const lines: TextItemLike[][] = [];

  for (const item of sorted) {
    const currentY = item.transform[5] ?? 0;
    const currentLine = lines[lines.length - 1];

    if (!currentLine) {
      lines.push([item]);
      continue;
    }

    const lineY = currentLine[0]?.transform[5] ?? 0;

    if (Math.abs(currentY - lineY) <= 1.5) {
      currentLine.push(item);
    } else {
      lines.push([item]);
    }
  }

  return lines;
}

export async function parsePdfDocument(input: Buffer): Promise<ParsedContractDocument> {
  const loadingTask = getDocument({
    data: new Uint8Array(input)
  });

  const pdf = await loadingTask.promise;
  const blocks: PdfTextBlock[] = [];
  const renderedLines: string[] = [];
  let cursor = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const textItems: TextItemLike[] = [];

    for (const item of textContent.items) {
      if (typeof item === "object" && item && "str" in item && "transform" in item) {
        textItems.push(item as TextItemLike);
      }
    }

    const groupedLines = groupLines(textItems);

    for (const line of groupedLines) {
      const lineText = normalizeLineText(line.map((item) => item.str).join(" "));

      if (!lineText) {
        continue;
      }

      const blockStart = renderedLines.length > 0 ? cursor + 2 : cursor;
      const blockEnd = blockStart + lineText.length;

      blocks.push({
        pageNumber,
        text: lineText,
        startOffset: blockStart,
        endOffset: blockEnd
      });

      renderedLines.push(lineText);
      cursor = blockEnd;
    }
  }

  const text = renderedLines.join("\n\n");

  return {
    parser: "pdf",
    text,
    pageCount: pdf.numPages,
    metadata: {
      sourceFormat: "pdf",
      textBlocks: blocks
    }
  };
}
