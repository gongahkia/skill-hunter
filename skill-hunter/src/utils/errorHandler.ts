/**
 * Error handling utilities
 */

import { logger } from './logger';

export class SkillHunterError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SkillHunterError';
    Object.setPrototypeOf(this, SkillHunterError.prototype);
  }
}

export class DOMParsingError extends SkillHunterError {
  constructor(message: string, originalError?: Error) {
    super(message, 'DOM_PARSING_ERROR', originalError);
    this.name = 'DOMParsingError';
  }
}

export class ContentProcessingError extends SkillHunterError {
  constructor(message: string, originalError?: Error) {
    super(message, 'CONTENT_PROCESSING_ERROR', originalError);
    this.name = 'ContentProcessingError';
  }
}

export function handleError(error: unknown, context?: string): void {
  const contextMsg = context ? `[${context}]` : '';
  
  if (error instanceof SkillHunterError) {
    logger.error(`${contextMsg} ${error.message}`, error.originalError);
  } else if (error instanceof Error) {
    logger.error(`${contextMsg} Unexpected error: ${error.message}`, error);
  } else {
    logger.error(`${contextMsg} Unknown error occurred`, error);
  }
}

export function safeExecute<T>(
  fn: () => T,
  fallback: T,
  context?: string
): T {
  try {
    return fn();
  } catch (error) {
    handleError(error, context);
    return fallback;
  }
}

export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context);
    return fallback;
  }
}

