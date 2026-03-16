import { describe, it, expect } from 'vitest';
import { evalSrc } from './helpers.js';

const { MessageSchema } = evalSrc('schema.js');

describe('MessageSchema', () => {
  it('creates message with all fields', () => {
    const msg = MessageSchema.create({
      role: 'user',
      content: 'Hello',
      id: 'msg-1',
      timestamp: '2026-01-01',
      model: 'gpt-4',
      platform: 'chatgpt',
      index: 0,
      metadata: { foo: 'bar' }
    });
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
    expect(msg.id).toBe('msg-1');
    expect(msg.timestamp).toBe('2026-01-01');
    expect(msg.model).toBe('gpt-4');
    expect(msg.platform).toBe('chatgpt');
    expect(msg.index).toBe(0);
    expect(msg.metadata.foo).toBe('bar');
  });

  it('uses defaults for missing fields', () => {
    const msg = MessageSchema.create({});
    expect(msg.role).toBe('unknown');
    expect(msg.content).toBe('');
    expect(msg.id).toBe('');
    expect(msg.timestamp).toBe('');
    expect(msg.model).toBe('');
    expect(msg.platform).toBe('');
    expect(msg.index).toBe(-1);
    expect(msg.metadata).toEqual({});
  });

  it('preserves index 0', () => {
    const msg = MessageSchema.create({ index: 0 });
    expect(msg.index).toBe(0);
  });
});
