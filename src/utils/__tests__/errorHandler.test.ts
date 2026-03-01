/**
 * Tests for error handler utilities
 */

import {
  SkillHunterError,
  DOMParsingError,
  ContentProcessingError,
  safeExecute,
  safeExecuteAsync,
} from '../errorHandler';

describe('Error Handlers', () => {
  describe('SkillHunterError', () => {
    it('should create error with code', () => {
      const error = new SkillHunterError('Test error', 'TEST_CODE');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('SkillHunterError');
    });

    it('should wrap original error', () => {
      const originalError = new Error('Original');
      const error = new SkillHunterError('Wrapped', 'CODE', originalError);
      
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('DOMParsingError', () => {
    it('should create DOM parsing error', () => {
      const error = new DOMParsingError('Parse failed');
      
      expect(error.message).toBe('Parse failed');
      expect(error.code).toBe('DOM_PARSING_ERROR');
      expect(error.name).toBe('DOMParsingError');
    });
  });

  describe('ContentProcessingError', () => {
    it('should create content processing error', () => {
      const error = new ContentProcessingError('Processing failed');
      
      expect(error.message).toBe('Processing failed');
      expect(error.code).toBe('CONTENT_PROCESSING_ERROR');
      expect(error.name).toBe('ContentProcessingError');
    });
  });

  describe('safeExecute', () => {
    it('should return result on success', () => {
      const result = safeExecute(() => 42, 0);
      expect(result).toBe(42);
    });

    it('should return fallback on error', () => {
      const result = safeExecute(() => {
        throw new Error('Test error');
      }, 'fallback');
      
      expect(result).toBe('fallback');
    });

    it('should handle non-error throws', () => {
      const result = safeExecute(() => {
        throw 'string error';
      }, 'fallback');
      
      expect(result).toBe('fallback');
    });
  });

  describe('safeExecuteAsync', () => {
    it('should return result on success', async () => {
      const result = await safeExecuteAsync(async () => 42, 0);
      expect(result).toBe(42);
    });

    it('should return fallback on error', async () => {
      const result = await safeExecuteAsync(async () => {
        throw new Error('Test error');
      }, 'fallback');
      
      expect(result).toBe('fallback');
    });

    it('should handle promise rejection', async () => {
      const result = await safeExecuteAsync(
        async () => Promise.reject('rejection'),
        'fallback'
      );
      
      expect(result).toBe('fallback');
    });
  });
});

