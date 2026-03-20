import { EditorAdapter, EditorType } from '../types';
import { DocsAdapter } from './docs-adapter';
import { SheetsAdapter } from './sheets-adapter';
import { SlidesAdapter } from './slides-adapter';

const adapters: Record<EditorType, EditorAdapter> = {
  docs: new DocsAdapter(),
  sheets: new SheetsAdapter(),
  slides: new SlidesAdapter(),
};

export function getEditorAdapter(editor: EditorType): EditorAdapter {
  return adapters[editor];
}
