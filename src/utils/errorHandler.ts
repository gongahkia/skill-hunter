/**
 * Error handling utilities
 */

import { logger } from './logger';

export interface NormalizedError {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  cause?: unknown;
  occurredAt: string;
}

function normalizeError(error: unknown): NormalizedError {
  const occurredAt = new Date().toISOString();

  if (error instanceof SkillHunterError) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      cause: error.originalError,
      occurredAt,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      occurredAt,
    };
  }

  return {
    name: 'UnknownError',
    message: typeof error === 'string' ? error : 'Unknown error occurred',
    cause: error,
    occurredAt,
  };
}

export class SkillHunterError extends Error {
  readonly code: string;
  readonly originalError?: Error;

  constructor(message: string, code: string, originalError?: Error) {
    super(message);
    this.name = 'SkillHunterError';
    this.code = code;
    this.originalError = originalError;
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

export function handleError(error: unknown, context = 'unknown'): NormalizedError {
  const normalized = normalizeError(error);
  logger.error(`Captured error in ${context}`, normalized, `context:${context}`);
  return normalized;
}

export function getUserFacingErrorMessage(
  normalizedError: NormalizedError,
  fallbackMessage: string
): string {
  if (!normalizedError.message.trim()) {
    return fallbackMessage;
  }

  if (normalizedError.code === 'DOM_PARSING_ERROR') {
    return 'Skill Hunter could not parse this legislation page safely.';
  }

  if (normalizedError.code === 'CONTENT_PROCESSING_ERROR') {
    return 'Skill Hunter could not process this legislation content safely.';
  }

  return fallbackMessage;
}

export function safeExecute<T>(fn: () => T, fallback: T, context = 'safeExecute'): T {
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
  context = 'safeExecuteAsync'
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context);
    return fallback;
  }
}
