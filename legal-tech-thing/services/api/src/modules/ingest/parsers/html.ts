import { load } from "cheerio";

import type { ParsedContractDocument } from "./types";

type HeadingOffset = {
  heading: string;
  level: number;
  startOffset: number;
  endOffset: number;
  hierarchyPath: string;
};

function normalizeInlineText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function isHeadingTag(tagName: string): tagName is `h${1 | 2 | 3 | 4 | 5 | 6}` {
  return /^h[1-6]$/i.test(tagName);
}

export async function parseHtmlDocument(input: Buffer): Promise<ParsedContractDocument> {
  const $ = load(input.toString("utf8"));

  $("script, style, noscript, template").remove();

  const rootSelector = $("body").length ? "body" : "html";

  const lines: string[] = [];
  const headingOffsets: HeadingOffset[] = [];
  const headingStack: string[] = [];

  $(rootSelector)
    .find("h1, h2, h3, h4, h5, h6, p, li, td, th, pre")
    .each((_, element) => {
      const text = normalizeInlineText($(element).text());

      if (!text) {
        return;
      }

      const tagName = element.tagName.toLowerCase();

      if (isHeadingTag(tagName)) {
        const level = Number(tagName.slice(1));
        headingStack[level - 1] = text;
        headingStack.length = level;

        const renderedHeading = `${"#".repeat(level)} ${text}`;
        const currentLength = lines.length
          ? lines.join("\n\n").length + 2
          : 0;

        headingOffsets.push({
          heading: text,
          level,
          startOffset: currentLength,
          endOffset: currentLength + renderedHeading.length,
          hierarchyPath: headingStack.join(" > ")
        });

        lines.push(renderedHeading);
        return;
      }

      lines.push(text);
    });

  const outputText = lines.join("\n\n");

  return {
    parser: "html",
    text: outputText,
    metadata: {
      sourceFormat: "html",
      headingOffsets,
      headingCount: headingOffsets.length
    }
  };
}
