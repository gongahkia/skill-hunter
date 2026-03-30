import { describe, it, expect } from 'vitest';
import { loadSrc } from './helpers.js';

function createLoggerHarness() {
  const storage = { runtimeDiagnostics: [] };
  const apiStub = {
    storage: {
      local: {
        async get(defaults) {
          return { ...defaults, ...storage };
        },
        async set(payload) {
          Object.assign(storage, payload);
        }
      }
    }
  };

  const code = [
    'var api = this._api;',
    'var module = undefined;',
    loadSrc('logger.js'),
    'this.logger = AppLogger;'
  ].join('\n');

  const fn = new Function(code);
  const ctx = { _api: apiStub, logger: null };
  fn.call(ctx);

  return { logger: ctx.logger, storage };
}

function flushWrites() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('AppLogger', () => {
  it('creates trace ids with expected prefix', () => {
    const { logger } = createLoggerHarness();
    const traceId = logger.createTraceId('export');
    expect(traceId.startsWith('export-')).toBe(true);
  });

  it('persists recent events to local storage', async () => {
    const { logger } = createLoggerHarness();
    logger.info('test.event', { message: 'hello' });
    await flushWrites();

    const logs = await logger.getRecent(10);
    expect(logs).toHaveLength(1);
    expect(logs[0].event).toBe('test.event');
    expect(logs[0].details.message).toBe('hello');
  });

  it('clears diagnostics state', async () => {
    const { logger } = createLoggerHarness();
    logger.warn('test.warn', { message: 'warned' });
    await flushWrites();
    await logger.clear();

    const logs = await logger.getRecent(10);
    expect(logs).toEqual([]);
  });

  it('serializes error metadata safely', () => {
    const { logger } = createLoggerHarness();
    const serialized = logger.serializeError(new Error('boom'));
    expect(serialized.name).toBe('Error');
    expect(serialized.message).toBe('boom');
    expect(typeof serialized.stack).toBe('string');
  });
});
