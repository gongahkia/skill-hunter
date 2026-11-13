import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ChromeMessage, ChromeMessageResponse } from '@/types';
import { ENABLED_KEY } from '@/utils/constants';

jest.mock('../card', () => ({
  HoverCard: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })),
}));
let change: (changes: Record<string, { newValue: unknown }>, area: string) => void;
let message: (
  msg: ChromeMessage,
  sender: unknown,
  respond: (response: ChromeMessageResponse) => void
) => void;
async function start(): Promise<void> {
  document.documentElement.innerHTML = readFileSync(
    resolve(__dirname, '../../../tests/fixtures/legislation.html'),
    'utf8'
  );
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      runtime: {
        onMessage: {
          addListener: (fn: typeof message) => {
            message = fn;
          },
        },
      },
      storage: {
        local: { get: jest.fn().mockResolvedValue({}) },
        onChanged: {
          addListener: (fn: typeof change) => {
            change = fn;
          },
        },
      },
    },
  });
  await import('../../content');
  await Promise.resolve();
}
afterEach(() => {
  change?.({ [ENABLED_KEY]: { newValue: false } }, 'local');
  Reflect.deleteProperty(globalThis, 'chrome');
  jest.resetModules();
});
it('starts disabled, responds with metadata and applies the global toggle without touching the title or scrolling', async () => {
  await start();
  const title = document.title;
  const overflow = document.documentElement.style.overflow;
  const root = document.getElementById('legisContent') as HTMLElement;
  const original = root.textContent;
  const respond = jest.fn<void, [ChromeMessageResponse]>();
  message({ action: 'get_page_summary' }, {}, respond);
  const response = respond.mock.calls[0]?.[0];
  expect(response.enabled).toBe(false);
  expect(response.pageSummary?.title).toBe('Synthetic Test Act 2026');
  expect(root.querySelector('[data-skill-hunter-reference]')).toBeNull();
  change({ [ENABLED_KEY]: { newValue: true } }, 'local');
  expect(root.querySelector('[data-skill-hunter-reference]')).not.toBeNull();
  expect(document.title).toBe(title);
  expect(document.documentElement.style.overflow).toBe(overflow);
  expect(root.textContent).toBe(original);
  change({ [ENABLED_KEY]: { newValue: false } }, 'local');
  expect(root.querySelector('[data-skill-hunter-reference]')).toBeNull();
  expect(root.textContent).toBe(original);
});
it('handles document-root replacement after enabling', async () => {
  await start();
  change({ [ENABLED_KEY]: { newValue: true } }, 'local');
  const replacement = document.createElement('div');
  replacement.id = 'legisContent';
  replacement.innerHTML = '<p>SGCA and SLR</p>';
  document.getElementById('legisContent')?.replaceWith(replacement);
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(replacement.querySelectorAll('[data-skill-hunter-reference]')).toHaveLength(2);
  change({ [ENABLED_KEY]: { newValue: false } }, 'local');
  expect(replacement.textContent).toBe('SGCA and SLR');
});
