/**
 * Centralized logging utility for the extension
 */
/* eslint-disable no-console */

import type { DiagnosticLogEntry, LogLevelName } from '@/types';
import { UX_LIMITS } from '@/utils/constants';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

type LogMethodName = 'debug' | 'info' | 'warn' | 'error';

function levelToName(level: LogLevel): LogLevelName {
  switch (level) {
    case LogLevel.DEBUG:
      return 'debug';
    case LogLevel.INFO:
      return 'info';
    case LogLevel.WARN:
      return 'warn';
    case LogLevel.ERROR:
      return 'error';
    default:
      return 'error';
  }
}

function shouldCaptureData(data: unknown): boolean {
  return typeof data !== 'undefined';
}

function createSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private readonly prefix = '[Skill Hunter]';
  private readonly sessionId = createSessionId();
  private readonly logEntries: DiagnosticLogEntry[] = [];

  private constructor() {
    if (process.env.NODE_ENV === 'development') {
      this.logLevel = LogLevel.DEBUG;
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }

    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getBufferedEntries(): DiagnosticLogEntry[] {
    return [...this.logEntries];
  }

  clearBufferedEntries(): void {
    this.logEntries.length = 0;
  }

  withContext(context: string): {
    debug: (message: string, data?: unknown, ...args: unknown[]) => void;
    info: (message: string, data?: unknown, ...args: unknown[]) => void;
    warn: (message: string, data?: unknown, ...args: unknown[]) => void;
    error: (message: string, error?: unknown, ...args: unknown[]) => void;
  } {
    const contextMarker = `context:${context}`;
    return {
      debug: (message, data, ...args) => this.debug(message, data, ...args, contextMarker),
      info: (message, data, ...args) => this.info(message, data, ...args, contextMarker),
      warn: (message, data, ...args) => this.warn(message, data, ...args, contextMarker),
      error: (message, error, ...args) => this.error(message, error, ...args, contextMarker),
    };
  }

  debug(message: string, data?: unknown, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, 'debug', message, data, args);
  }

  info(message: string, data?: unknown, ...args: unknown[]): void {
    this.log(LogLevel.INFO, 'info', message, data, args);
  }

  warn(message: string, data?: unknown, ...args: unknown[]): void {
    this.log(LogLevel.WARN, 'warn', message, data, args);
  }

  error(message: string, error?: unknown, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, 'error', message, error, args);
  }

  private captureEntry(level: LogLevel, message: string, data?: unknown, context = 'app'): void {
    const entry: DiagnosticLogEntry = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      level: levelToName(level),
      context,
      message,
      ...(shouldCaptureData(data) ? { data } : {}),
    };

    this.logEntries.push(entry);
    if (this.logEntries.length > UX_LIMITS.MAX_LOG_ENTRIES) {
      this.logEntries.splice(0, this.logEntries.length - UX_LIMITS.MAX_LOG_ENTRIES);
    }
  }

  private log(
    level: LogLevel,
    method: LogMethodName,
    message: string,
    data: unknown,
    args: unknown[]
  ): void {
    let context = 'app';
    const finalArgs = [...args];
    const maybeContext = finalArgs.length > 0 ? finalArgs[finalArgs.length - 1] : undefined;

    if (typeof maybeContext === 'string' && maybeContext.startsWith('context:')) {
      context = maybeContext.replace('context:', '');
      finalArgs.pop();
    }

    this.captureEntry(level, message, data, context);

    if (this.logLevel > level) {
      return;
    }

    const payload = shouldCaptureData(data)
      ? { data, sessionId: this.sessionId, context }
      : { sessionId: this.sessionId, context };
    const prefix = `${this.prefix} [${method.toUpperCase()}]`;

    switch (method) {
      case 'debug':
        console.debug(prefix, message, payload, ...finalArgs);
        break;
      case 'info':
        console.info(prefix, message, payload, ...finalArgs);
        break;
      case 'warn':
        console.warn(prefix, message, payload, ...finalArgs);
        break;
      case 'error':
        console.error(prefix, message, payload, ...finalArgs);
        break;
      default:
        console.error(prefix, message, payload, ...finalArgs);
    }
  }
}

export const logger = Logger.getInstance();
export { LogLevel };
