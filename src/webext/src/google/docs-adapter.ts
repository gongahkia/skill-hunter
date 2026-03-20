import { getPrefixColor, hexToRgbColor } from '../colors';
import { EditorAdapter, EditorContext, MutationAction, ScanResult, TagEntry } from '../types';
import { GoogleWorkspaceApiClient } from './client';
import { parseTaggedLine } from '../parser';
import { loadSettings } from '../storage';

interface DocsTextRunElement {
  startIndex?: number;
  endIndex?: number;
  textRun?: {
    content?: string;
  };
}

interface DocsContentNode {
  startIndex?: number;
  endIndex?: number;
  paragraph?: {
    elements?: DocsTextRunElement[];
  };
}

interface DocsDocument {
  title?: string;
  body?: {
    content?: DocsContentNode[];
  };
}

function getParagraphText(node: DocsContentNode): string {
  const parts = node.paragraph?.elements?.map((element) => {
    return element.textRun?.content ?? '';
  }) ?? [];
  return parts.join('').replace(/\n$/, '');
}

function getNodeStartIndex(node: DocsContentNode): number {
  return node.startIndex ?? node.paragraph?.elements?.[0]?.startIndex ?? 1;
}

export class DocsAdapter implements EditorAdapter {
  async scan(context: EditorContext, prefixes: string[], accessToken: string): Promise<ScanResult> {
    const client = new GoogleWorkspaceApiClient(accessToken);
    const document = await client.getJson<DocsDocument>(
      `https://docs.googleapis.com/v1/documents/${context.documentId}`
    );

    const entries: TagEntry[] = [];
    const content = document.body?.content ?? [];

    content.forEach((node, index) => {
      if (!node.paragraph) {
        return;
      }

      const paragraphText = getParagraphText(node);
      const parsed = parseTaggedLine(paragraphText, prefixes);
      if (!parsed) {
        return;
      }

      const nodeStart = getNodeStartIndex(node);
      const prefixRange = {
        start: nodeStart + parsed.prefixStart,
        end: nodeStart + parsed.prefixEnd,
      };

      entries.push({
        id: `docs:${context.documentId}:${index}:${prefixRange.start}`,
        editor: 'docs',
        documentId: context.documentId,
        prefix: parsed.prefix,
        rawText: parsed.rawText,
        content: parsed.content,
        locationLabel: `Paragraph ${index + 1}`,
        logicalLocation: `paragraph:${index + 1}`,
        navigation: {
          queryText: parsed.rawText,
          locationLabel: `Paragraph ${index + 1}`,
        },
        mutation: {
          prefixRange,
          blockRange: {
            start: nodeStart,
            end: node.endIndex ?? prefixRange.end,
          },
        },
      });
    });

    return {
      editor: 'docs',
      documentId: context.documentId,
      title: document.title ?? 'Untitled document',
      entries,
    };
  }

  async highlight(
    _context: EditorContext,
    entries: TagEntry[],
    accessToken: string,
    colorscheme: string
  ): Promise<void> {
    const settings = await loadSettings();
    const client = new GoogleWorkspaceApiClient(accessToken);
    const requests = entries
      .filter((entry) => entry.mutation.prefixRange)
      .map((entry) => {
        const color = hexToRgbColor(
          getPrefixColor(colorscheme, entry.prefix, settings.customPrefixes)
        );

        return {
          updateTextStyle: {
            range: {
              startIndex: entry.mutation.prefixRange?.start,
              endIndex: entry.mutation.prefixRange?.end,
            },
            textStyle: {
              foregroundColor: {
                color: {
                  rgbColor: color,
                },
              },
            },
            fields: 'foregroundColor',
          },
        };
      });

    await client.postJson(
      `https://docs.googleapis.com/v1/documents/${entries[0]?.documentId}:batchUpdate`,
      { requests }
    );
  }

  async markDone(_context: EditorContext, entries: TagEntry[], accessToken: string): Promise<void> {
    const client = new GoogleWorkspaceApiClient(accessToken);
    const sorted = [...entries].sort((left, right) => {
      return (right.mutation.prefixRange?.start ?? 0) - (left.mutation.prefixRange?.start ?? 0);
    });

    const requests = sorted.flatMap((entry) => {
      const range = entry.mutation.prefixRange;
      if (!range) {
        return [];
      }

      return [
        {
          deleteContentRange: {
            range: {
              startIndex: range.start,
              endIndex: range.end,
            },
          },
        },
        {
          insertText: {
            location: {
              index: range.start,
            },
            text: 'DONE',
          },
        },
      ];
    });

    await client.postJson(
      `https://docs.googleapis.com/v1/documents/${entries[0]?.documentId}:batchUpdate`,
      { requests }
    );
  }

  async archive(
    context: EditorContext,
    entries: TagEntry[],
    accessToken: string
  ): Promise<void> {
    const client = new GoogleWorkspaceApiClient(accessToken);
    const document = await client.getJson<DocsDocument>(
      `https://docs.googleapis.com/v1/documents/${context.documentId}`
    );
    const lastNode = document.body?.content?.at(-1);
    const archiveInsertIndex = Math.max((lastNode?.endIndex ?? 1) - 1, 1);
    const archiveText = [
      '',
      '--- Owl Archive ---',
      ...entries.map((entry) => `DONE ${entry.prefix}: ${entry.content}`),
      '',
    ].join('\n');

    const deleteRequests = [...entries]
      .filter((entry) => entry.mutation.blockRange)
      .sort((left, right) => {
        return (right.mutation.blockRange?.start ?? 0) - (left.mutation.blockRange?.start ?? 0);
      })
      .map((entry) => ({
        deleteContentRange: {
          range: {
            startIndex: entry.mutation.blockRange?.start,
            endIndex: entry.mutation.blockRange?.end,
          },
        },
      }));

    await client.postJson(
      `https://docs.googleapis.com/v1/documents/${context.documentId}:batchUpdate`,
      {
        requests: [
          {
            insertText: {
              location: { index: archiveInsertIndex },
              text: archiveText,
            },
          },
          ...deleteRequests,
        ],
      }
    );
  }

  buildMutationPreview(action: MutationAction, entries: TagEntry[]): string {
    if (entries.length === 0) {
      return `No document tags selected for ${action}.`;
    }

    return `Docs ${action} will affect ${entries.length} tag${entries.length === 1 ? '' : 's'} in the current document.`;
  }
}
