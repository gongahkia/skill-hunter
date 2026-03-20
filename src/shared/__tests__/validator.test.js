/**
 * Tests for validator utility.
 */

import {
  validateRequired,
  validateChallengeData,
  isLeetCodeURL,
  isAIChatbotURL,
} from '../utils/validator.js';

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

  describe('validateChallengeData', () => {
    test('should validate valid challenge data', () => {
      const problem = {
        source: 'leetcode',
        title: 'Two Sum',
        slug: 'two-sum',
        url: 'https://leetcode.com/problems/two-sum/description/',
        difficulty: 'Easy',
      };
      expect(() => validateChallengeData(problem)).not.toThrow();
    });

    test('should throw error for invalid challenge data', () => {
      const problem = {
        title: 'Two Sum',
      };
      expect(() => validateChallengeData(problem)).toThrow();
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
      expect(isAIChatbotURL('https://chatgpt.com/')).toBe(true);
    });

    test('should return true for Claude URL', () => {
      expect(isAIChatbotURL('https://claude.ai/')).toBe(true);
    });

    test('should return false for non-chatbot URLs', () => {
      expect(isAIChatbotURL('https://google.com/')).toBe(false);
    });
  });
});
