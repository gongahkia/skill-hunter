import { describe, it, expect } from 'vitest';
import { evalSrc } from './helpers.js';

const { FormatConverter } = evalSrc('converters.js');

const envelope = {
  exportVersion: '2.0',
  exportedAt: '2026-01-01T00:00:00.000Z',
  platform: 'chatgpt',
  chatTitle: 'Test Chat',
  model: 'gpt-4',
  messageCount: 2,
  messages: [
    { role: 'user', content: 'Hello', id: 'msg-1', timestamp: '', model: 'gpt-4', platform: 'chatgpt', index: 0, metadata: {} },
    { role: 'assistant', content: 'Hi there!', id: 'msg-2', timestamp: '', model: 'gpt-4', platform: 'chatgpt', index: 1, metadata: {} }
  ]
};

describe('FormatConverter', () => {
  it('toJSON produces valid JSON with envelope', () => {
    const result = FormatConverter.toJSON(envelope);
    const parsed = JSON.parse(result);
    expect(parsed.exportVersion).toBe('2.0');
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[0].role).toBe('user');
  });

  it('toCSV produces correct headers and rows', () => {
    const result = FormatConverter.toCSV(envelope);
    const lines = result.split('\n');
    expect(lines[0]).toBe('role,content,id,timestamp,model,platform,index');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toContain('"user"');
    expect(lines[1]).toContain('"Hello"');
  });

  it('toCSV escapes double quotes', () => {
    const env = { ...envelope, messages: [{ role: 'user', content: 'He said "hello"', id: '1', timestamp: '', model: '', platform: '', index: 0 }], messageCount: 1 };
    const result = FormatConverter.toCSV(env);
    expect(result).toContain('""hello""');
  });

  it('toTSV produces tab-separated output', () => {
    const result = FormatConverter.toTSV(envelope);
    const lines = result.split('\n');
    expect(lines[0]).toBe('role\tcontent\tid\ttimestamp\tmodel\tplatform\tindex');
    expect(lines[1].split('\t')[0]).toBe('user');
  });

  it('toTSV strips tabs from content', () => {
    const env = { ...envelope, messages: [{ role: 'user', content: 'col1\tcol2', id: '1', timestamp: '', model: '', platform: '', index: 0 }], messageCount: 1 };
    const result = FormatConverter.toTSV(env);
    expect(result).not.toContain('col1\tcol2'); // tab should be replaced
  });

  it('toNDJSON first line is metadata, rest are messages', () => {
    const result = FormatConverter.toNDJSON(envelope);
    const lines = result.split('\n');
    expect(lines).toHaveLength(3); // 1 meta + 2 messages
    const meta = JSON.parse(lines[0]);
    expect(meta.exportVersion).toBe('2.0');
    expect(meta.platform).toBe('chatgpt');
    const msg = JSON.parse(lines[1]);
    expect(msg.role).toBe('user');
  });

  it('toXML produces valid XML structure', () => {
    const result = FormatConverter.toXML(envelope);
    expect(result).toContain('<?xml version="1.0"');
    expect(result).toContain('<export>');
    expect(result).toContain('<platform>chatgpt</platform>');
    expect(result).toContain('<message>');
    expect(result).toContain('<role>user</role>');
    expect(result).toContain('</export>');
  });

  it('toXML escapes special chars', () => {
    const env = { ...envelope, chatTitle: '<script>alert("xss")</script>', messages: [], messageCount: 0 };
    const result = FormatConverter.toXML(env);
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('toYAML produces valid YAML structure', () => {
    const result = FormatConverter.toYAML(envelope);
    expect(result).toContain('exportVersion: 2.0');
    expect(result).toContain('platform: chatgpt');
    expect(result).toContain('  - role: user');
  });

  it('toMarkdown produces readable sections', () => {
    const result = FormatConverter.toMarkdown(envelope);
    expect(result).toContain('# Test Chat');
    expect(result).toContain('## USER');
    expect(result).toContain('## ASSISTANT');
    expect(result).toContain('Hello');
  });

  it('convert dispatches to correct method', () => {
    const json = FormatConverter.convert('json', envelope);
    expect(JSON.parse(json).platform).toBe('chatgpt');
    const csv = FormatConverter.convert('csv', envelope);
    expect(csv).toContain('role,content');
    const md = FormatConverter.convert('markdown', envelope);
    expect(md).toContain('# Test Chat');
  });

  it('convert throws on unknown format', () => {
    expect(() => FormatConverter.convert('xlsx', envelope)).toThrow('Unsupported');
  });

  it('formats map has correct entries', () => {
    expect(FormatConverter.formats.csv.ext).toBe('csv');
    expect(FormatConverter.formats.json.mime).toBe('application/json');
    expect(FormatConverter.formats.yaml.ext).toBe('yaml');
    expect(FormatConverter.formats.markdown.ext).toBe('md');
  });
});
