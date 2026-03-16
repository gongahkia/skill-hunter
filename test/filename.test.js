import { describe, it, expect } from 'vitest';
import { evalSrc } from './helpers.js';

const { FilenameBuilder } = evalSrc('filename.js');

describe('FilenameBuilder', () => {
  it('replaces all template variables', () => {
    const result = FilenameBuilder.build('{platform}_{title}_{date}.{ext}', {
      platform: 'chatgpt',
      title: 'My Chat',
      format: 'json',
      ext: 'json'
    });
    expect(result).toContain('chatgpt');
    expect(result).toContain('My_Chat');
    expect(result).toContain('.json');
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/); // date
  });

  it('sanitizes dangerous characters', () => {
    expect(FilenameBuilder.sanitize('file<>:"/\\|?*name')).toBe('file_________name');
  });

  it('replaces whitespace with underscores', () => {
    expect(FilenameBuilder.sanitize('hello world  test')).toBe('hello_world_test');
  });

  it('truncates to 100 chars', () => {
    const long = 'a'.repeat(200);
    expect(FilenameBuilder.sanitize(long).length).toBe(100);
  });

  it('uses defaults for missing context', () => {
    const result = FilenameBuilder.build('{platform}_{title}.{ext}', {});
    expect(result).toContain('unknown');
    expect(result).toContain('untitled');
    expect(result).toContain('.json');
  });

  it('handles {time} variable', () => {
    const result = FilenameBuilder.build('{time}', {});
    expect(result).toMatch(/^\d+$/);
  });

  it('handles {format} variable', () => {
    const result = FilenameBuilder.build('{format}', { format: 'csv' });
    expect(result).toBe('csv');
  });
});
