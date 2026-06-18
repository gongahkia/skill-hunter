import { describe, expect, it } from 'vitest';
import { loadFixture } from './helpers.js';

function fixture(name) {
  return JSON.parse(loadFixture('fixtures/imports/notion/' + name + '.json'));
}

function blocks(doc) {
  return (doc.responses || []).flatMap((response) => response.results || []);
}

describe('Notion synthetic fixtures', () => {
  it('cover first-pass block types and scanner tags', () => {
    const doc = fixture('basic-page');
    const types = new Set(blocks(doc).map((block) => block.type));

    expect(types).toEqual(new Set([
      'heading_1',
      'paragraph',
      'bulleted_list_item',
      'numbered_list_item',
      'to_do',
      'code',
      'quote'
    ]));
    expect(doc.coverage).toContain('link');
    expect(JSON.stringify(doc)).toContain('TODO: publish launch checklist');
  });

  it('cover recursive child blocks', () => {
    const doc = fixture('nested-blocks');
    const byParent = new Map(doc.responses.map((response) => [response.block_id, response.results]));

    expect(byParent.get('page-nested').some((block) => block.has_children)).toBe(true);
    expect(byParent.get('toggle-1')).toHaveLength(2);
    expect(byParent.get('callout-1')).toHaveLength(1);
    expect(JSON.stringify(doc)).toContain('FIXME: verify recursive pagination');
  });

  it('cover empty and unsupported blocks', () => {
    const doc = fixture('unsupported-blocks');
    const types = blocks(doc).map((block) => block.type);

    expect(types).toContain('paragraph');
    expect(types).toContain('synced_block');
    expect(types).toContain('file');
    expect(types).toContain('child_database');
    expect(blocks(doc).find((block) => block.id === 'empty-1').paragraph.rich_text).toEqual([]);
  });

  it('cover paginated long pages', () => {
    const doc = fixture('long-page');
    const allBlocks = blocks(doc);

    expect(doc.responses).toHaveLength(3);
    expect(doc.responses[0].has_more).toBe(true);
    expect(doc.responses[1].has_more).toBe(true);
    expect(doc.responses[2].has_more).toBe(false);
    expect(allBlocks).toHaveLength(30);
    expect(JSON.stringify(doc)).toContain('PROMPT: summarize long import performance');
  });

  it('cover expected error states', () => {
    const doc = fixture('errors');
    const statuses = new Set(doc.cases.map((row) => row.status));

    expect(statuses).toEqual(new Set([401, 403, 404, 429, 529, 0]));
    expect(doc.cases.find((row) => row.status === 429).retry_after).toBe(2);
    expect(doc.cases.find((row) => row.status === 529).retry_after).toBe(5);
  });
});
