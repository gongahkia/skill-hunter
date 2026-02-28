import { createWorker, type Worker } from "tesseract.js";

import type { ParsedContractDocument } from "./types";

type RawOcrWord = {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
};

type OcrDataShape = {
  text: string;
  words?: RawOcrWord[];
};

type OcrWord = {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
};

let workerPromise: Promise<Worker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng");
  }

  return workerPromise;
}

export async function parseImageDocument(input: Buffer): Promise<ParsedContractDocument> {
  const worker = await getWorker();
  const result = await worker.recognize(input);
  const resultData = result.data as unknown as OcrDataShape;
  const rawWords = resultData.words ?? [];

  const words: OcrWord[] = rawWords
    .filter((word) => Boolean(word.text?.trim()))
    .map((word) => ({
      text: word.text,
      confidence: word.confidence,
      bbox: {
        x0: word.bbox.x0,
        y0: word.bbox.y0,
        x1: word.bbox.x1,
        y1: word.bbox.y1
      }
    }));

  return {
    parser: "image",
    text: resultData.text.trim(),
    metadata: {
      sourceFormat: "image",
      ocrWordCount: words.length,
      boundingBoxes: words
    }
  };
}
