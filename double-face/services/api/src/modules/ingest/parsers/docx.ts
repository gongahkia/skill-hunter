import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";

import type { ParsedContractDocument } from "./types";

type NumberingLevelMap = Map<number, string>;
type NumberingDefinitionMap = Map<string, NumberingLevelMap>;

type NumberingCounters = Map<string, number>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ""
});

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function getXmlValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;

    if (typeof obj["#text"] === "string") {
      return obj["#text"];
    }

    if (typeof obj["w:val"] === "string") {
      return obj["w:val"];
    }
  }

  return null;
}

function collectTextNodes(node: unknown): string[] {
  if (typeof node === "string") {
    return [node];
  }

  if (!node || typeof node !== "object") {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap((item) => collectTextNodes(item));
  }

  const objectNode = node as Record<string, unknown>;
  const fragments: string[] = [];

  for (const [key, value] of Object.entries(objectNode)) {
    if (key === "w:t") {
      const textValue = getXmlValue(value);

      if (textValue) {
        fragments.push(textValue);
      }

      continue;
    }

    if (key === "w:tab") {
      fragments.push("\t");
      continue;
    }

    if (key === "w:br") {
      fragments.push("\n");
      continue;
    }

    fragments.push(...collectTextNodes(value));
  }

  return fragments;
}

function normalizeParagraphText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function parseNumberingMap(numberingXml: string | null): NumberingDefinitionMap {
  const numberingMap: NumberingDefinitionMap = new Map();

  if (!numberingXml) {
    return numberingMap;
  }

  const parsed = xmlParser.parse(numberingXml) as Record<string, unknown>;
  const numberingRoot = parsed["w:numbering"] as Record<string, unknown> | undefined;

  if (!numberingRoot) {
    return numberingMap;
  }

  const abstractNumById = new Map<string, NumberingLevelMap>();

  for (const abstractNum of toArray(numberingRoot["w:abstractNum"])) {
    const abstractNode = abstractNum as Record<string, unknown>;
    const abstractNumId = getXmlValue(abstractNode["w:abstractNumId"]);

    if (!abstractNumId) {
      continue;
    }

    const levels: NumberingLevelMap = new Map();

    for (const levelNode of toArray(abstractNode["w:lvl"])) {
      const level = levelNode as Record<string, unknown>;
      const ilvl = Number(getXmlValue(level["w:ilvl"]) ?? 0);
      const numFmtNode = level["w:numFmt"] as Record<string, unknown> | undefined;
      const numFmt = getXmlValue(numFmtNode?.["w:val"]) ?? "decimal";
      levels.set(ilvl, numFmt);
    }

    abstractNumById.set(abstractNumId, levels);
  }

  for (const numNode of toArray(numberingRoot["w:num"])) {
    const num = numNode as Record<string, unknown>;
    const numId = getXmlValue(num["w:numId"]);
    const abstractRefNode = num["w:abstractNumId"] as Record<string, unknown> | undefined;
    const abstractNumId = getXmlValue(abstractRefNode?.["w:val"] ?? num["w:abstractNumId"]);

    if (!numId || !abstractNumId) {
      continue;
    }

    const levels = abstractNumById.get(abstractNumId);

    if (levels) {
      numberingMap.set(numId, levels);
    }
  }

  return numberingMap;
}

function renderListPrefix(format: string, index: number) {
  if (format === "bullet") {
    return "-";
  }

  if (format === "lowerLetter") {
    return `${String.fromCharCode(96 + ((index - 1) % 26) + 1)}.`;
  }

  if (format === "upperLetter") {
    return `${String.fromCharCode(64 + ((index - 1) % 26) + 1)}.`;
  }

  if (format === "lowerRoman") {
    return `${toRoman(index).toLowerCase()}.`;
  }

  if (format === "upperRoman") {
    return `${toRoman(index)}.`;
  }

  return `${index}.`;
}

function toRoman(input: number) {
  const values = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ] as const;

  let remainder = input;
  let result = "";

  for (const [value, symbol] of values) {
    while (remainder >= value) {
      remainder -= value;
      result += symbol;
    }
  }

  return result || "I";
}

function incrementListCounter(
  counters: NumberingCounters,
  numId: string,
  ilvl: number
): number {
  const key = `${numId}:${ilvl}`;
  const current = counters.get(key) ?? 0;
  const next = current + 1;
  counters.set(key, next);

  for (const counterKey of counters.keys()) {
    const [counterNumId, counterLevel] = counterKey.split(":");

    if (counterNumId === numId && Number(counterLevel) > ilvl) {
      counters.delete(counterKey);
    }
  }

  return next;
}

export async function parseDocxDocument(input: Buffer): Promise<ParsedContractDocument> {
  const zip = await JSZip.loadAsync(input);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  const numberingXml = await zip.file("word/numbering.xml")?.async("string");

  if (!documentXml) {
    return {
      parser: "docx",
      text: "",
      metadata: {
        sourceFormat: "docx",
        paragraphCount: 0,
        listItemCount: 0
      }
    };
  }

  const parsedDocument = xmlParser.parse(documentXml) as Record<string, unknown>;
  const body = (parsedDocument["w:document"] as Record<string, unknown>)[
    "w:body"
  ] as Record<string, unknown>;
  const paragraphs = toArray(body["w:p"]);

  const numberingMap = parseNumberingMap(numberingXml ?? null);
  const counters: NumberingCounters = new Map();

  const outputParagraphs: string[] = [];
  let listItemCount = 0;

  for (const paragraphNode of paragraphs) {
    const paragraph = paragraphNode as Record<string, unknown>;
    const paragraphText = normalizeParagraphText(
      collectTextNodes(paragraph).join("")
    );

    if (!paragraphText) {
      continue;
    }

    const paragraphProperties = paragraph["w:pPr"] as Record<string, unknown> | undefined;
    const numberingProperties = paragraphProperties?.["w:numPr"] as
      | Record<string, unknown>
      | undefined;

    let renderedParagraph = paragraphText;

    if (numberingProperties) {
      const numIdNode = numberingProperties["w:numId"] as Record<string, unknown> | undefined;
      const ilvlNode = numberingProperties["w:ilvl"] as Record<string, unknown> | undefined;
      const numId = getXmlValue(numIdNode?.["w:val"] ?? numberingProperties["w:numId"]);
      const ilvl = Number(
        getXmlValue(ilvlNode?.["w:val"] ?? numberingProperties["w:ilvl"]) ?? 0
      );

      if (numId) {
        const nextIndex = incrementListCounter(counters, numId, ilvl);
        const numFmt = numberingMap.get(numId)?.get(ilvl) ?? "decimal";
        const prefix = renderListPrefix(numFmt, nextIndex);
        renderedParagraph = `${prefix} ${paragraphText}`;
        listItemCount += 1;
      }
    }

    outputParagraphs.push(renderedParagraph);
  }

  return {
    parser: "docx",
    text: outputParagraphs.join("\n\n"),
    metadata: {
      sourceFormat: "docx",
      paragraphCount: outputParagraphs.length,
      listItemCount
    }
  };
}
