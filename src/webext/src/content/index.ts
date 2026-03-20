import { extensionBrowser } from '../browser-api';
import { TagEntry } from '../types';

interface ContentRequest {
  type: 'owl:navigate';
  payload: TagEntry;
}

function findTextNode(queryText: string): HTMLElement | null {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();

  while (node) {
    if (node.textContent?.includes(queryText)) {
      return node.parentElement;
    }
    node = walker.nextNode();
  }

  return null;
}

function flashElement(element: HTMLElement): void {
  const originalOutline = element.style.outline;
  const originalOutlineOffset = element.style.outlineOffset;
  element.style.outline = '2px solid #fb4934';
  element.style.outlineOffset = '4px';
  setTimeout(() => {
    element.style.outline = originalOutline;
    element.style.outlineOffset = originalOutlineOffset;
  }, 1500);
}

function navigateSheets(entry: TagEntry): boolean {
  if (!entry.navigation.sheetId || !entry.navigation.cellA1) {
    return false;
  }

  location.hash = `gid=${entry.navigation.sheetId}&range=${entry.navigation.cellA1}`;
  return true;
}

function navigateByText(entry: TagEntry): boolean {
  const target = findTextNode(entry.navigation.queryText)
    ?? findTextNode(entry.content)
    ?? findTextNode(entry.rawText);

  if (!target) {
    return false;
  }

  target.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest',
  });
  flashElement(target);
  return true;
}

function handleNavigate(entry: TagEntry): boolean {
  if (entry.editor === 'sheets' && navigateSheets(entry)) {
    return true;
  }

  return navigateByText(entry);
}

extensionBrowser.runtime.onMessage.addListener((request: ContentRequest) => {
  if (request.type !== 'owl:navigate') {
    return false;
  }

  return Promise.resolve({ ok: handleNavigate(request.payload) });
});
