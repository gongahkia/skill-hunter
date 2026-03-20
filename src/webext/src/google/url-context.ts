import { EditorContext } from '../types';

const DOCS_RE = /^https:\/\/docs\.google\.com\/document\/d\/([^/]+)/;
const SHEETS_RE = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([^/]+)/;
const SLIDES_RE = /^https:\/\/docs\.google\.com\/presentation\/d\/([^/]+)/;

function getHashParam(url: URL, key: string): string | null {
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const params = new URLSearchParams(hash);
  return params.get(key);
}

export function parseEditorContext(urlValue: string): EditorContext | null {
  const url = new URL(urlValue);
  const docsMatch = DOCS_RE.exec(urlValue);
  if (docsMatch) {
    return {
      editor: 'docs',
      documentId: docsMatch[1]!,
      url: urlValue,
    };
  }

  const sheetsMatch = SHEETS_RE.exec(urlValue);
  if (sheetsMatch) {
    const gid = getHashParam(url, 'gid');
    const context: EditorContext = {
      editor: 'sheets',
      documentId: sheetsMatch[1]!,
      url: urlValue,
    };

    if (gid) {
      context.sheetGid = Number.parseInt(gid, 10);
    }

    return context;
  }

  const slidesMatch = SLIDES_RE.exec(urlValue);
  if (slidesMatch) {
    const slideId = url.hash.includes('slide=id.')
      ? url.hash.split('slide=id.')[1]
      : undefined;

    const context: EditorContext = {
      editor: 'slides',
      documentId: slidesMatch[1]!,
      url: urlValue,
    };

    if (slideId) {
      context.slideObjectId = slideId;
    }

    return context;
  }

  return null;
}
