import { getPrefixColor, hexToRgbColor } from '../colors';
import { EditorAdapter, EditorContext, MutationAction, ScanResult, TagEntry } from '../types';
import { GoogleWorkspaceApiClient } from './client';
import { parseTaggedLine } from '../parser';
import { loadSettings } from '../storage';

interface SlidesTextElement {
  startIndex?: number;
  endIndex?: number;
  textRun?: {
    content?: string;
  };
}

interface SlidesShape {
  text?: {
    textElements?: SlidesTextElement[];
  };
}

interface SlidesPageElement {
  objectId?: string;
  shape?: SlidesShape;
}

interface SlidesSlide {
  objectId?: string;
  pageElements?: SlidesPageElement[];
}

interface SlidesPresentation {
  title?: string;
  slides?: SlidesSlide[];
}

function flattenShapeText(elements: SlidesTextElement[]): string {
  return elements
    .map((element) => element.textRun?.content ?? '')
    .join('');
}

export class SlidesAdapter implements EditorAdapter {
  async scan(context: EditorContext, prefixes: string[], accessToken: string): Promise<ScanResult> {
    const client = new GoogleWorkspaceApiClient(accessToken);
    const presentation = await client.getJson<SlidesPresentation>(
      `https://slides.googleapis.com/v1/presentations/${context.documentId}`
    );

    const entries: TagEntry[] = [];
    (presentation.slides ?? []).forEach((slide, slideIndex) => {
      (slide.pageElements ?? []).forEach((pageElement) => {
        const elements = pageElement.shape?.text?.textElements ?? [];
        if (elements.length === 0 || !pageElement.objectId) {
          return;
        }

        const fullText = flattenShapeText(elements);
        let globalOffset = 0;
        for (const line of fullText.split('\n')) {
          const parsed = parseTaggedLine(line, prefixes);
          if (parsed) {
            const textRange = {
              start: globalOffset + parsed.prefixStart,
              end: globalOffset + parsed.prefixEnd,
            };

            entries.push({
              id: `slides:${context.documentId}:${slideIndex}:${pageElement.objectId}:${textRange.start}`,
              editor: 'slides',
              documentId: context.documentId,
              prefix: parsed.prefix,
              rawText: parsed.rawText,
              content: parsed.content,
              locationLabel: `Slide ${slideIndex + 1}`,
              logicalLocation: `slide:${slideIndex + 1}:${pageElement.objectId}`,
              navigation: {
                queryText: parsed.rawText,
                locationLabel: `Slide ${slideIndex + 1}`,
              },
              mutation: {
                objectId: pageElement.objectId,
                textRange,
              },
            });
          }
          globalOffset += line.length + 1;
        }
      });
    });

    return {
      editor: 'slides',
      documentId: context.documentId,
      title: presentation.title ?? 'Untitled presentation',
      entries,
    };
  }

  async highlight(
    context: EditorContext,
    entries: TagEntry[],
    accessToken: string,
    colorscheme: string
  ): Promise<void> {
    const settings = await loadSettings();
    const client = new GoogleWorkspaceApiClient(accessToken);
    const requests = entries
      .filter((entry) => entry.mutation.objectId && entry.mutation.textRange)
      .map((entry) => {
        const color = hexToRgbColor(
          getPrefixColor(colorscheme, entry.prefix, settings.customPrefixes)
        );
        return {
          updateTextStyle: {
            objectId: entry.mutation.objectId,
            style: {
              foregroundColor: {
                opaqueColor: {
                  rgbColor: color,
                },
              },
            },
            fields: 'foregroundColor',
            textRange: {
              type: 'FIXED_RANGE',
              startIndex: entry.mutation.textRange?.start,
              endIndex: entry.mutation.textRange?.end,
            },
          },
        };
      });

    await client.postJson(
      `https://slides.googleapis.com/v1/presentations/${context.documentId}:batchUpdate`,
      { requests }
    );
  }

  async markDone(context: EditorContext, entries: TagEntry[], accessToken: string): Promise<void> {
    const client = new GoogleWorkspaceApiClient(accessToken);
    const sorted = [...entries].sort((left, right) => {
      return (right.mutation.textRange?.start ?? 0) - (left.mutation.textRange?.start ?? 0);
    });

    const requests = sorted.flatMap((entry) => {
      if (!entry.mutation.objectId || !entry.mutation.textRange) {
        return [];
      }

      return [
        {
          deleteText: {
            objectId: entry.mutation.objectId,
            textRange: {
              type: 'FIXED_RANGE',
              startIndex: entry.mutation.textRange.start,
              endIndex: entry.mutation.textRange.end,
            },
          },
        },
        {
          insertText: {
            objectId: entry.mutation.objectId,
            insertionIndex: entry.mutation.textRange.start,
            text: 'DONE',
          },
        },
      ];
    });

    await client.postJson(
      `https://slides.googleapis.com/v1/presentations/${context.documentId}:batchUpdate`,
      { requests }
    );
  }

  async archive(context: EditorContext, entries: TagEntry[], accessToken: string): Promise<void> {
    await this.markDone(context, entries, accessToken);
  }

  buildMutationPreview(action: MutationAction, entries: TagEntry[]): string {
    if (entries.length === 0) {
      return `No slide tags selected for ${action}.`;
    }

    return `Slides ${action} will affect ${entries.length} text block${entries.length === 1 ? '' : 's'} in the current presentation.`;
  }
}
