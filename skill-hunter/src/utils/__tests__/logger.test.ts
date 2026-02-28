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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log debug messages', () => {
    logger.setLogLevel(LogLevel.DEBUG);
    logger.debug('Debug message');
    
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Skill Hunter]'),
      'Debug message'
    );
  });

  it('should log info messages', () => {
    logger.setLogLevel(LogLevel.INFO);
    logger.info('Info message');
    
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Skill Hunter]'),
      'Info message'
    );
  });

  it('should log warn messages', () => {
    logger.setLogLevel(LogLevel.WARN);
    logger.warn('Warning message');
    
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Skill Hunter]'),
      'Warning message'
    );
  });

  it('should log error messages', () => {
    logger.setLogLevel(LogLevel.ERROR);
    const error = new Error('Test error');
    logger.error('Error message', error);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Skill Hunter]'),
      'Error message',
      error
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
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

