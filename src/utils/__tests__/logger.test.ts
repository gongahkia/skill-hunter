/**
 * Tests for logger utility
 */

import { logger, LogLevel } from '../logger';

describe('Logger', () => {
  let consoleDebugSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    logger.clearBufferedEntries();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log debug messages with payload metadata', () => {
    logger.setLogLevel(LogLevel.DEBUG);
    logger.debug('Debug message', { tokenCount: 3 });

    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Skill Hunter]'),
      'Debug message',
      expect.objectContaining({ context: 'app' })
    );
  });

  it('should log info messages', () => {
    logger.setLogLevel(LogLevel.INFO);
    logger.info('Info message');

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Skill Hunter]'),
      'Info message',
      expect.objectContaining({ context: 'app' })
    );
  });

  it('should log warn messages', () => {
    logger.setLogLevel(LogLevel.WARN);
    logger.warn('Warning message');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Skill Hunter]'),
      'Warning message',
      expect.objectContaining({ context: 'app' })
    );
  });

  it('should log error messages', () => {
    logger.setLogLevel(LogLevel.ERROR);
    const error = new Error('Test error');
    logger.error('Error message', error);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Skill Hunter]'),
      'Error message',
      expect.objectContaining({ context: 'app' })
    );
  });

  it('should respect log level settings', () => {
    logger.setLogLevel(LogLevel.ERROR);

    logger.debug('Debug');
    logger.info('Info');
    logger.warn('Warn');
    logger.error('Error');

    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('should buffer diagnostic entries', () => {
    logger.setLogLevel(LogLevel.DEBUG);
    logger.info('Buffered info');

    const entries = logger.getBufferedEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.message).toBe('Buffered info');
    expect(entries[0]?.sessionId).toBe(logger.getSessionId());
  });
});
