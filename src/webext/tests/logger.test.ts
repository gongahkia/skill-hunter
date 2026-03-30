import { describe, expect, it } from 'vitest';
import {
  clearDiagnostics,
  formatDiagnosticsText,
  getDiagnostics,
  logError,
  logInfo,
} from '../src/logger';

describe('logger', () => {
  it('records and clears diagnostics', () => {
    clearDiagnostics();
    logInfo('test', 'hello world');
    logError('test', 'something failed', new Error('boom'));

    const diagnostics = getDiagnostics();
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0]).toMatchObject({
      level: 'info',
      scope: 'test',
      message: 'hello world',
    });
    expect(diagnostics[1]).toMatchObject({
      level: 'error',
      scope: 'test',
      message: 'something failed',
    });

    clearDiagnostics();
    expect(getDiagnostics()).toHaveLength(0);
  });

  it('formats diagnostics for clipboard export', () => {
    clearDiagnostics();
    logInfo('popup', 'scan complete', { entries: 4 });
    const text = formatDiagnosticsText(getDiagnostics());
    expect(text).toContain('[INFO]');
    expect(text).toContain('(popup)');
    expect(text).toContain('scan complete');
  });
});
