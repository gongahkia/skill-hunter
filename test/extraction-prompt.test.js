import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadPrompt() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('extraction/prompt.js'));
  fn(module, module.exports);
  return module.exports;
}

const sampleMessages = [
  {
    messageId: 'm-1',
    role: 'user',
    content: 'Can we confirm whether Firefox supports direct Obsidian sync?'
  },
  {
    messageId: 'm-2',
    role: 'assistant',
    content: 'I am not sure. I can also add a fallback zip export if you want.'
  }
];

describe('ExtractionPrompt', () => {
  it('keeps exactly four few-shot examples per built-in tag', () => {
    const prompt = loadPrompt();
    const counts = prompt.tagCounts();

    expect(Object.keys(counts).sort()).toEqual(prompt.TAGS.slice().sort());
    for (const tag of prompt.TAGS) expect(counts[tag]).toBe(4);
    expect(prompt.FEW_SHOT_EXAMPLES).toHaveLength(prompt.TAGS.length * 4);
  });

  it('builds a chat prompt with schema instructions and transcript ids', () => {
    const prompt = loadPrompt();
    const built = prompt.buildExtractionPrompt(sampleMessages);

    expect(built).toHaveLength(2);
    expect(built[0]).toMatchObject({ role: 'system' });
    expect(built[0].content).toContain('Return only a JSON array');
    expect(built[0].content).toContain('messageId');
    expect(built[1]).toMatchObject({ role: 'user' });
    expect(built[1].content).toContain('Few-shot examples');
    expect(built[1].content).toContain('"messageId":"m-1"');
    expect(built[1].content).toContain('"messageId":"m-2"');
    expect(built[1].content).toContain('Use a messageId from Transcript JSON in each output object');
    expect(built[1].content).toContain('"messageId":"m-1"');
    expect(built[1].content).toContain('Negative examples that must return []');
    expect(built[1].content).toContain('FIXME example: messageId=fx-1');
    expect(built[1].content).toContain('Return only the output JSON array');
  });

  it('truncates long messages before inserting transcript JSON', () => {
    const prompt = loadPrompt();
    const built = prompt.buildExtractionPrompt([{ messageId: 'long', role: 'user', content: 'x'.repeat(500) }], {
      maxMessageChars: 100
    });

    expect(built[1].content).toContain('x'.repeat(97) + '...');
    expect(built[1].content).not.toContain('x'.repeat(101));
  });

  it('parses and validates fenced JSON extraction output', () => {
    const prompt = loadPrompt();
    const rows = prompt.parseExtractionOutput('```json\n[{"tag":"todo","text":"Update docs","messageId":"m-1","confidence":0.82}]\n```', {
      allowedMessageIds: ['m-1']
    });

    expect(rows).toEqual([{ tag: 'TODO', text: 'Update docs', messageId: 'm-1', confidence: 0.82 }]);
  });

  it('rejects schema violations', () => {
    const prompt = loadPrompt();

    expect(() => prompt.parseExtractionOutput('[{"tag":"BAD","text":"x","messageId":"m-1","confidence":0.5}]')).toThrow('unsupported tag');
    expect(() => prompt.parseExtractionOutput('[{"tag":"TODO","text":"","messageId":"m-1","confidence":0.5}]')).toThrow('missing text');
    expect(() => prompt.parseExtractionOutput('[{"tag":"TODO","text":"x","messageId":"m-2","confidence":0.5}]', {
      allowedMessageIds: ['m-1']
    })).toThrow('unknown messageId');
    expect(() => prompt.parseExtractionOutput('[{"tag":"TODO","text":"x","messageId":"m-1","confidence":2}]')).toThrow('confidence');
  });
});
