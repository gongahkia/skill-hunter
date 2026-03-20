import { getPrefixColor, hexToRgbColor } from '../colors';
import { EditorAdapter, EditorContext, MutationAction, ScanResult, TagEntry } from '../types';
import { GoogleWorkspaceApiClient } from './client';
import { parseTaggedLine } from '../parser';
import { loadSettings } from '../storage';

interface SheetsCellData {
  formattedValue?: string;
}

interface SheetsRowData {
  values?: SheetsCellData[];
}

interface SheetsGridData {
  rowData?: SheetsRowData[];
}

interface SheetsSheet {
  properties?: {
    sheetId?: number;
    title?: string;
  };
  data?: SheetsGridData[];
}

interface SpreadsheetDocument {
  properties?: {
    title?: string;
  };
  sheets?: SheetsSheet[];
}

function toA1(row: number, col: number): string {
  let column = '';
  let current = col;
  while (current > 0) {
    current -= 1;
    column = String.fromCharCode(65 + (current % 26)) + column;
    current = Math.floor(current / 26);
  }
  return `${column}${row}`;
}

function encodeSheetRange(title: string, a1: string): string {
  return encodeURIComponent(`'${title}'!${a1}`);
}

async function loadSpreadsheet(
  context: EditorContext,
  accessToken: string
): Promise<SpreadsheetDocument> {
  const client = new GoogleWorkspaceApiClient(accessToken);
  const fields = [
    'properties(title)',
    'sheets(properties(sheetId,title),data.rowData.values.formattedValue)',
  ].join(',');

  return await client.getJson<SpreadsheetDocument>(
    `https://sheets.googleapis.com/v4/spreadsheets/${context.documentId}?includeGridData=true&fields=${encodeURIComponent(fields)}`
  );
}

async function ensureArchiveSheet(
  context: EditorContext,
  accessToken: string
): Promise<{ sheetId: number; title: string }> {
  const document = await loadSpreadsheet(context, accessToken);
  const existing = document.sheets?.find((sheet) => sheet.properties?.title === 'Owl Archive');
  if (existing?.properties?.sheetId) {
    return { sheetId: existing.properties.sheetId, title: 'Owl Archive' };
  }

  const client = new GoogleWorkspaceApiClient(accessToken);
  const response = await client.postJson<{
    replies?: Array<{ addSheet?: { properties?: { sheetId?: number; title?: string } } }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${context.documentId}:batchUpdate`,
    {
      requests: [
        {
          addSheet: {
            properties: {
              title: 'Owl Archive',
            },
          },
        },
      ],
    }
  );

  const createdSheet = response.replies?.[0]?.addSheet?.properties;
  return {
    sheetId: createdSheet?.sheetId ?? 0,
    title: createdSheet?.title ?? 'Owl Archive',
  };
}

export class SheetsAdapter implements EditorAdapter {
  async scan(context: EditorContext, prefixes: string[], accessToken: string): Promise<ScanResult> {
    const document = await loadSpreadsheet(context, accessToken);
    const targetSheet = document.sheets?.find((sheet) => {
      return sheet.properties?.sheetId === context.sheetGid;
    }) ?? document.sheets?.[0];

    const sheetId = targetSheet?.properties?.sheetId;
    const sheetTitle = targetSheet?.properties?.title;

    if (!sheetId || !sheetTitle) {
      throw new Error('Unable to resolve the current Google Sheet tab.');
    }

    const entries: TagEntry[] = [];
    const rows = targetSheet.data?.[0]?.rowData ?? [];

    rows.forEach((row, rowIndex) => {
      (row.values ?? []).forEach((cell, colIndex) => {
        if (!cell.formattedValue) {
          return;
        }

        const parsed = parseTaggedLine(cell.formattedValue, prefixes);
        if (!parsed) {
          return;
        }

        const oneBasedRow = rowIndex + 1;
        const oneBasedCol = colIndex + 1;
        const a1 = toA1(oneBasedRow, oneBasedCol);
        entries.push({
          id: `sheets:${context.documentId}:${sheetId}:${a1}`,
          editor: 'sheets',
          documentId: context.documentId,
          prefix: parsed.prefix,
          rawText: parsed.rawText,
          content: parsed.content,
          locationLabel: a1,
          logicalLocation: `sheet:${sheetId}:${a1}`,
          navigation: {
            queryText: parsed.rawText,
            locationLabel: a1,
            sheetId,
            cellA1: a1,
          },
          mutation: {
            sheetId,
            row: oneBasedRow,
            col: oneBasedCol,
            cellA1: a1,
          },
        });
      });
    });

    return {
      editor: 'sheets',
      documentId: context.documentId,
      title: document.properties?.title ?? 'Untitled spreadsheet',
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
      .filter((entry) => typeof entry.mutation.sheetId === 'number')
      .map((entry) => {
        const color = hexToRgbColor(
          getPrefixColor(colorscheme, entry.prefix, settings.customPrefixes)
        );

        return {
          repeatCell: {
            range: {
              sheetId: entry.mutation.sheetId,
              startRowIndex: (entry.mutation.row ?? 1) - 1,
              endRowIndex: entry.mutation.row,
              startColumnIndex: (entry.mutation.col ?? 1) - 1,
              endColumnIndex: entry.mutation.col,
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  foregroundColor: {
                    red: color.red,
                    green: color.green,
                    blue: color.blue,
                  },
                },
              },
            },
            fields: 'userEnteredFormat.textFormat.foregroundColor',
          },
        };
      });

    await client.postJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${context.documentId}:batchUpdate`,
      { requests }
    );
  }

  async markDone(context: EditorContext, entries: TagEntry[], accessToken: string): Promise<void> {
    const document = await loadSpreadsheet(context, accessToken);
    const client = new GoogleWorkspaceApiClient(accessToken);

    for (const entry of entries) {
      const sheet = document.sheets?.find((candidate) => {
        return candidate.properties?.sheetId === entry.mutation.sheetId;
      });

      if (!sheet?.properties?.title || !entry.mutation.cellA1) {
        continue;
      }

      const updatedValue = entry.rawText.replace(new RegExp(entry.prefix, 'i'), 'DONE');
      await client.putJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${context.documentId}/values/${encodeSheetRange(sheet.properties.title, entry.mutation.cellA1)}?valueInputOption=USER_ENTERED`,
        {
          range: `${sheet.properties.title}!${entry.mutation.cellA1}`,
          values: [[updatedValue]],
        }
      );
    }
  }

  async archive(
    context: EditorContext,
    entries: TagEntry[],
    accessToken: string
  ): Promise<void> {
    const document = await loadSpreadsheet(context, accessToken);
    const archiveSheet = await ensureArchiveSheet(context, accessToken);
    const client = new GoogleWorkspaceApiClient(accessToken);

    for (const entry of entries) {
      await client.postJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${context.documentId}/values/${encodeSheetRange(archiveSheet.title, 'A1')}:append?valueInputOption=USER_ENTERED`,
        {
          values: [[entry.prefix, entry.content, new Date().toISOString()]],
        }
      );

      const sourceSheet = document.sheets?.find((candidate) => {
        return candidate.properties?.sheetId === entry.mutation.sheetId;
      });
      if (!sourceSheet?.properties?.title || !entry.mutation.cellA1) {
        continue;
      }

      await client.clearRange(
        `https://sheets.googleapis.com/v4/spreadsheets/${context.documentId}/values/${encodeSheetRange(sourceSheet.properties.title, entry.mutation.cellA1)}:clear`
      );
    }
  }

  buildMutationPreview(action: MutationAction, entries: TagEntry[]): string {
    if (entries.length === 0) {
      return `No sheet tags selected for ${action}.`;
    }

    return `Sheets ${action} will affect ${entries.length} cell${entries.length === 1 ? '' : 's'} in the current spreadsheet.`;
  }
}
