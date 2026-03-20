import { describe, expect, it, vi } from 'vitest';
import { DocsAdapter } from '../src/google/docs-adapter';

describe('DocsAdapter.scan', () => {
  it('extracts tag entries from paragraph content', async () => {
    const adapter = new DocsAdapter();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Example',
        body: {
          content: [
            {
              startIndex: 1,
              endIndex: 18,
              paragraph: {
                elements: [
                  {
                    startIndex: 1,
                    endIndex: 18,
                    textRun: { content: 'TODO revise this\n' },
                  },
                ],
              },
            },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await adapter.scan(
      {
        editor: 'docs',
        documentId: 'doc-1',
        url: 'https://docs.google.com/document/d/doc-1/edit',
      },
      ['TODO'],
      'token'
    );

    expect(result.title).toBe('Example');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      prefix: 'TODO',
      content: 'revise this',
      locationLabel: 'Paragraph 1',
    });

    vi.unstubAllGlobals();
  });
});
