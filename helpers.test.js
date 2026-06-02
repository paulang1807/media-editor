import { describe, test, expect } from 'vitest';
import helpers from './helpers.js';

const { secondsToTimestamp, timestampToSeconds, isValidTimestampFormat, getAudioSpeedFilter, mapCropToNative, getSpeedRampFilterComplex } = helpers;

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

  describe('getAudioSpeedFilter', () => {
    test('returns standard single filter for multipliers within [0.5, 2.0]', () => {
      expect(getAudioSpeedFilter(1.0)).toBe('atempo=1');
      expect(getAudioSpeedFilter(1.5)).toBe('atempo=1.5');
      expect(getAudioSpeedFilter(0.5)).toBe('atempo=0.5');
      expect(getAudioSpeedFilter(2.0)).toBe('atempo=2');
    });

    test('chains filters for speed multipliers greater than 2.0', () => {
      // 3.0x speed -> atempo=2,atempo=1.5 (2 * 1.5 = 3)
      expect(getAudioSpeedFilter(3.0)).toBe('atempo=2,atempo=1.5');
      // 4.0x speed -> atempo=2,atempo=2 (2 * 2 = 4)
      expect(getAudioSpeedFilter(4.0)).toBe('atempo=2,atempo=2');
      // 5.0x speed -> atempo=2,atempo=2,atempo=1.25 (2 * 2 * 1.25 = 5)
      expect(getAudioSpeedFilter(5.0)).toBe('atempo=2,atempo=2,atempo=1.25');
    });

    test('chains filters for speed multipliers less than 0.5', () => {
      // 0.25x speed -> atempo=0.5,atempo=0.5 (0.5 * 0.5 = 0.25)
      expect(getAudioSpeedFilter(0.25)).toBe('atempo=0.5,atempo=0.5');
      // 0.125x speed -> atempo=0.5,atempo=0.5,atempo=0.5 (0.5 * 0.5 * 0.5 = 0.125)
      expect(getAudioSpeedFilter(0.125)).toBe('atempo=0.5,atempo=0.5,atempo=0.5');
    });

    test('handles invalid, zero, or negative inputs gracefully by returning atempo=1.0', () => {
      expect(getAudioSpeedFilter(-2.0)).toBe('atempo=1');
      expect(getAudioSpeedFilter(0)).toBe('atempo=1');
      expect(getAudioSpeedFilter(NaN)).toBe('atempo=1');
      expect(getAudioSpeedFilter('invalid')).toBe('atempo=1');
    });
  });

  describe('mapCropToNative', () => {
    test('scales coordinates correctly when native is larger than display', () => {
      const cropRect = { left: 100, top: 50, width: 200, height: 100 };
      const videoContent = { width: 500, height: 250 };
      const nativeW = 1000;
      const nativeH = 500;

      const result = mapCropToNative(cropRect, videoContent, nativeW, nativeH);
      expect(result).toEqual({ x: 200, y: 100, width: 400, height: 200 });
    });

    test('rounds coordinates to nearest integer', () => {
      const cropRect = { left: 10.4, top: 20.6, width: 30.1, height: 40.8 };
      const videoContent = { width: 100, height: 100 };
      const nativeW = 100;
      const nativeH = 100;

      const result = mapCropToNative(cropRect, videoContent, nativeW, nativeH);
      expect(result).toEqual({ x: 10, y: 21, width: 30, height: 41 });
    });

    test('clamps top-left coordinates to positive native bounds', () => {
      const cropRect = { left: -50, top: -10, width: 100, height: 100 };
      const videoContent = { width: 100, height: 100 };
      const nativeW = 100;
      const nativeH = 100;

      const result = mapCropToNative(cropRect, videoContent, nativeW, nativeH);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    test('clamps width and height to not exceed native bounds', () => {
      const cropRect = { left: 80, top: 80, width: 50, height: 50 };
      const videoContent = { width: 100, height: 100 };
      const nativeW = 100;
      const nativeH = 100;

      const result = mapCropToNative(cropRect, videoContent, nativeW, nativeH);
      expect(result.x).toBe(80);
      expect(result.y).toBe(80);
      expect(result.width).toBe(20);  // 100 - 80
      expect(result.height).toBe(20); // 100 - 80
    });

    test('handles empty or null parameters gracefully', () => {
      expect(mapCropToNative(null, null, 100, 100)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });
  });

  describe('getSpeedRampFilterComplex', () => {
    test('generates correct filter complexes with audio', () => {
      const complexStr = getSpeedRampFilterComplex(10, 2.0, true);
      // Symmetrical ramp speed multipliers: 1.25, 1.75, 2.0, 1.75, 1.25
      // 10 sec / 5 slices = 2 sec per slice
      expect(complexStr).toContain('trim=start=0.000000:end=2.000000,setpts=PTS-STARTPTS,setpts=0.800000*PTS[v0]');
      expect(complexStr).toContain('atrim=start=0.000000:end=2.000000,asetpts=PTS-STARTPTS,atempo=1.25[a0]');
      expect(complexStr).toContain('trim=start=2.000000:end=4.000000,setpts=PTS-STARTPTS,setpts=0.571429*PTS[v1]');
      expect(complexStr).toContain('trim=start=4.000000:end=6.000000,setpts=PTS-STARTPTS,setpts=0.500000*PTS[v2]');
      expect(complexStr).toContain('[v0][a0][v1][a1][v2][a2][v3][a3][v4][a4]concat=n=5:v=1:a=1[v][a]');
    });

    test('generates correct filter complexes without audio', () => {
      const complexStr = getSpeedRampFilterComplex(10, 2.0, false);
      expect(complexStr).toContain('trim=start=0.000000:end=2.000000,setpts=PTS-STARTPTS,setpts=0.800000*PTS[v0]');
      expect(complexStr).not.toContain('atrim');
      expect(complexStr).toContain('[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[v]');
    });

    test('handles invalid inputs gracefully by using defaults', () => {
      const complexStr = getSpeedRampFilterComplex('invalid', -1, false);
      expect(complexStr).toContain('trim=start=0.000000:end=0.200000');
    });
  });

});
