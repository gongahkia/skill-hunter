/**
 * Tests for logger utility.
 */

import { Logger } from '../utils/logger.js';

describe('Logger', () => {
  let logger;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    logger = new Logger('test');
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should log info messages', () => {
    logger.info('Test message', { key: 'value' });
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  test('should log error messages', () => {
    logger.error('Error message', { error: 'details' });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('should include context in logs', () => {
    logger.info('Test message');
    const call = consoleLogSpy.mock.calls[0];
    expect(call[1]).toBe('Test message');
  });

  test('should not log debug messages when level is INFO', () => {
    logger.setLevel('INFO');
    logger.debug('Debug message');
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
