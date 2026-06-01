import { describe, test, expect } from 'vitest';
import helpers from './helpers.js';

const { secondsToTimestamp, timestampToSeconds, isValidTimestampFormat } = helpers;

describe('Time conversion and validation helpers', () => {
  
  describe('secondsToTimestamp', () => {
    test('converts integer seconds to HH:MM:SS.mmm format', () => {
      expect(secondsToTimestamp(0)).toBe('00:00:00.000');
      expect(secondsToTimestamp(5)).toBe('00:00:05.000');
      expect(secondsToTimestamp(65)).toBe('00:01:05.000');
      expect(secondsToTimestamp(3665)).toBe('01:01:05.000');
    });

    test('converts decimal seconds including milliseconds', () => {
      expect(secondsToTimestamp(0.5)).toBe('00:00:00.500');
      expect(secondsToTimestamp(125.789)).toBe('00:02:05.789');
      expect(secondsToTimestamp(3665.001)).toBe('01:01:05.001');
    });

    test('handles invalid inputs gracefully by returning 00:00:00.000', () => {
      expect(secondsToTimestamp(-10)).toBe('00:00:00.000');
      expect(secondsToTimestamp('invalid')).toBe('00:00:00.000');
      expect(secondsToTimestamp(null)).toBe('00:00:00.000');
      expect(secondsToTimestamp(undefined)).toBe('00:00:00.000');
    });
  });

  describe('timestampToSeconds', () => {
    test('parses HH:MM:SS.mmm format', () => {
      expect(timestampToSeconds('00:00:00.000')).toBe(0);
      expect(timestampToSeconds('00:00:05.000')).toBe(5);
      expect(timestampToSeconds('00:01:05.000')).toBe(65);
      expect(timestampToSeconds('01:01:05.789')).toBe(3665.789);
    });

    test('parses HH:MM:SS format', () => {
      expect(timestampToSeconds('00:00:05')).toBe(5);
      expect(timestampToSeconds('00:01:05')).toBe(65);
      expect(timestampToSeconds('01:01:05')).toBe(3665);
    });

    test('parses MM:SS or MM:SS.mmm format', () => {
      expect(timestampToSeconds('01:05')).toBe(65);
      expect(timestampToSeconds('01:05.5')).toBe(65.5);
    });

    test('parses raw decimal/integer seconds', () => {
      expect(timestampToSeconds('125')).toBe(125);
      expect(timestampToSeconds('125.789')).toBe(125.789);
    });

    test('handles invalid or malformed strings by returning null', () => {
      expect(timestampToSeconds('invalid')).toBeNull();
      expect(timestampToSeconds('00:65:00')).toBeNull(); // minutes > 59
      expect(timestampToSeconds('00:00:65')).toBeNull(); // seconds > 59
      expect(timestampToSeconds('-00:01:00')).toBeNull();
      expect(timestampToSeconds('00:00:00:00')).toBeNull();
    });
  });

  describe('isValidTimestampFormat', () => {
    test('returns true for valid formats', () => {
      expect(isValidTimestampFormat('00:00:00.000')).toBe(true);
      expect(isValidTimestampFormat('01:05.5')).toBe(true);
      expect(isValidTimestampFormat('00:05')).toBe(true);
      expect(isValidTimestampFormat('123.45')).toBe(true);
      expect(isValidTimestampFormat('60')).toBe(true);
    });

    test('returns false for invalid formats', () => {
      expect(isValidTimestampFormat('invalid')).toBe(false);
      expect(isValidTimestampFormat('00:00:00:00.000')).toBe(false);
      expect(isValidTimestampFormat('-10')).toBe(false);
    });
  });

});
