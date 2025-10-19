/**
 * Tests for validator utility.
 */

import {
  validateRequired,
  validateProblemData,
  isLeetCodeURL,
  isAIChatbotURL,
} from '../utils/validator.js';
import { LLM_REGEX } from '../core/constants.js';

describe('Validator', () => {
  describe('validateRequired', () => {
    test('should validate object with all required fields', () => {
      const obj = { name: 'test', value: 123 };
      expect(() => validateRequired(obj, ['name', 'value'])).not.toThrow();
    });

    test('should throw error for missing fields', () => {
      const obj = { name: 'test' };
      expect(() => validateRequired(obj, ['name', 'value'])).toThrow();
    });
  });

  describe('validateProblemData', () => {
    test('should validate valid problem data', () => {
      const problem = {
        questionId: '1',
        title: 'Two Sum',
        titleSlug: 'two-sum',
        content: '<p>Problem content</p>',
        difficulty: 'Easy',
      };
      expect(() => validateProblemData(problem)).not.toThrow();
    });

    test('should throw error for invalid problem data', () => {
      const problem = {
        questionId: '1',
        title: 'Two Sum',
      };
      expect(() => validateProblemData(problem)).toThrow();
    });
  });

  describe('isLeetCodeURL', () => {
    test('should return true for valid LeetCode URLs', () => {
      expect(isLeetCodeURL('https://leetcode.com/problems/two-sum')).toBe(true);
    });

    test('should return false for non-LeetCode URLs', () => {
      expect(isLeetCodeURL('https://example.com')).toBe(false);
    });

    test('should return false for invalid URLs', () => {
      expect(isLeetCodeURL('not-a-url')).toBe(false);
    });
  });

  describe('isAIChatbotURL', () => {
    test('should return true for ChatGPT URL', () => {
      expect(isAIChatbotURL('https://chatgpt.com/', LLM_REGEX)).toBe(true);
    });

    test('should return true for Claude URL', () => {
      expect(isAIChatbotURL('https://claude.ai/', LLM_REGEX)).toBe(true);
    });

    test('should return false for non-chatbot URLs', () => {
      expect(isAIChatbotURL('https://google.com/', LLM_REGEX)).toBe(false);
    });
  });
});
