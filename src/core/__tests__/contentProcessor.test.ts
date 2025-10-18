/**
 * Tests for content processor utilities
 */

import {
  needsIndentation,
  formatLogicalConnectors,
  sortDefinitionsByLength,
  PerformanceMonitor,
} from '../contentProcessor';
import type { Definition } from '@/types';

describe('contentProcessor', () => {
  describe('needsIndentation', () => {
    it('should detect lines that need indentation', () => {
      expect(needsIndentation('(a) some text')).toBe(true);
      expect(needsIndentation('(b) another line')).toBe(true);
      expect(needsIndentation('(1) numbered item')).toBe(true);
      expect(needsIndentation('(10) double digit')).toBe(true);
    });

    it('should not indent lines without the pattern', () => {
      expect(needsIndentation('regular text')).toBe(false);
      expect(needsIndentation('(A) uppercase')).toBe(false);
      expect(needsIndentation('( a) space before letter')).toBe(false);
      expect(needsIndentation('text (a) in middle')).toBe(false);
    });
  });

  describe('formatLogicalConnectors', () => {
    it('should format logical connectors with bold and italic', () => {
      const input = 'You must do this and that or something else';
      const output = formatLogicalConnectors(input);
      
      expect(output).toContain('<b><i>and</i></b>');
      expect(output).toContain('<b><i>or</i></b>');
    });

    it('should handle multiple connectors in one sentence', () => {
      const input = 'If you do this, then you must also do that';
      const output = formatLogicalConnectors(input);
      
      expect(output).toContain('<b><i>If</i></b>');
      expect(output).toContain('<b><i>then</i></b>');
      expect(output).toContain('<b><i>also</i></b>');
    });

    it('should not format partial word matches', () => {
      const input = 'The standard procedure';
      const output = formatLogicalConnectors(input);
      
      // 'and' in 'standard' should not be formatted
      expect(output).toBe(input);
    });

    it('should handle empty strings', () => {
      expect(formatLogicalConnectors('')).toBe('');
    });
  });

  describe('sortDefinitionsByLength', () => {
    it('should sort definitions by term length descending', () => {
      const definitions: Definition[] = [
        { 'a': 'definition a' },
        { 'abc': 'definition abc' },
        { 'ab': 'definition ab' },
      ];

      const sorted = sortDefinitionsByLength(definitions);
      const terms = sorted.map((d) => Object.keys(d)[0]);

      expect(terms).toEqual(['abc', 'ab', 'a']);
    });

    it('should handle empty array', () => {
      const sorted = sortDefinitionsByLength([]);
      expect(sorted).toEqual([]);
    });

    it('should not mutate original array', () => {
      const definitions: Definition[] = [
        { 'a': 'def a' },
        { 'abc': 'def abc' },
      ];

      const original = [...definitions];
      sortDefinitionsByLength(definitions);

      expect(definitions).toEqual(original);
    });
  });

  describe('PerformanceMonitor', () => {
    it('should track performance marks', () => {
      const monitor = new PerformanceMonitor();
      monitor.start();
      
      monitor.mark('test1');
      monitor.mark('test2');
      
      const marks = monitor.getMarks();
      expect(marks.size).toBe(2);
      expect(marks.has('test1')).toBe(true);
      expect(marks.has('test2')).toBe(true);
    });

    it('should return elapsed time', () => {
      const monitor = new PerformanceMonitor();
      monitor.start();
      
      const totalTime = monitor.end();
      expect(totalTime).toBeGreaterThanOrEqual(0);
    });

    it('should reset marks on new start', () => {
      const monitor = new PerformanceMonitor();
      
      monitor.start();
      monitor.mark('first');
      
      monitor.start();
      const marks = monitor.getMarks();
      
      expect(marks.size).toBe(0);
    });
  });
});

