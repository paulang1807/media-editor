import { describe, test, expect } from 'vitest';
import helpers from './helpers.js';

const {
  secondsToTimestamp,
  timestampToSeconds,
  isValidTimestampFormat,
  validateAndNormalizeClips,
  getAudioSpeedFilter,
  mapCropToNative,
  getSpeedRampFilterComplex,
  getRotatedCanvasDimensions,
  getReverseFilterComplex,
  getEraseFilterComplex,
  getPrintDimensions,
  getSharpenKernel,
  getBlurKernel,
  applyConvolution,
  applyEnhancementFilters,
  getViewportClassForMode,
  replaceExtension,
  formatMediaTelemetry,
  getDefaultFilenameForTool
} = helpers;

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

  describe('validateAndNormalizeClips', () => {
    test('normalizes valid clips with numeric times', () => {
      const raw = [
        { id: 1, name: 'part1.mp4', startTime: 0, endTime: 10 },
        { id: 2, name: 'part2.mp4', startTime: 10, endTime: 25.5 }
      ];
      const result = validateAndNormalizeClips(raw, 30);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.clips).toHaveLength(2);
      expect(result.clips[0].startTime).toBe(0);
      expect(result.clips[0].endTime).toBe(10);
      expect(result.clips[1].startTime).toBe(10);
      expect(result.clips[1].endTime).toBe(25.5);
    });

    test('normalizes valid clips with string timestamps', () => {
      const raw = [
        { id: 1, name: 'intro.mp4', startTime: '00:00:05.500', endTime: '00:01:10.000' }
      ];
      const result = validateAndNormalizeClips(raw, 120);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.clips[0].startTime).toBe(5.5);
      expect(result.clips[0].endTime).toBe(70);
    });

    test('catches out of bounds and ordering errors', () => {
      const raw = [
        { id: 1, name: 'invalid1.mp4', startTime: -5, endTime: 10 },
        { id: 2, name: 'invalid2.mp4', startTime: 20, endTime: 15 },
        { id: 3, name: 'invalid3.mp4', startTime: 50, endTime: 75 }
      ];
      const result = validateAndNormalizeClips(raw, 60);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
      expect(result.errors.some(e => e.includes('negative'))).toBe(true);
      expect(result.errors.some(e => e.includes('before end time'))).toBe(true);
      expect(result.errors.some(e => e.includes('exceeds video duration'))).toBe(true);
    });

    test('catches empty filenames and malformed timestamp strings', () => {
      const raw = [
        { id: 1, name: '   ', startTime: 'invalid', endTime: '00:00:10' }
      ];
      const result = validateAndNormalizeClips(raw, 30);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('valid file name'))).toBe(true);
      expect(result.errors.some(e => e.includes('invalid start time format'))).toBe(true);
    });

    test('handles empty or non-array raw clips gracefully', () => {
      expect(validateAndNormalizeClips([], 100).valid).toBe(false);
      expect(validateAndNormalizeClips(null, 100).valid).toBe(false);
      expect(validateAndNormalizeClips(undefined, 100).valid).toBe(false);
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

    test('clamps coordinates when exceeding native bounds to valid ranges', () => {
      const cropRect = { left: 150, top: 150, width: 50, height: 50 };
      const videoContent = { width: 100, height: 100 };
      const nativeW = 100;
      const nativeH = 100;

      const result = mapCropToNative(cropRect, videoContent, nativeW, nativeH);
      expect(result.x).toBe(99);
      expect(result.y).toBe(99);
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
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

  describe('getRotatedCanvasDimensions', () => {
    test('calculates correct dimensions for 0 degrees (no change)', () => {
      expect(getRotatedCanvasDimensions(100, 200, 0)).toEqual({ width: 100, height: 200 });
      expect(getRotatedCanvasDimensions(100, 200, 360)).toEqual({ width: 100, height: 200 });
    });

    test('swaps dimensions for 90 and 270 degrees', () => {
      expect(getRotatedCanvasDimensions(100, 200, 90)).toEqual({ width: 200, height: 100 });
      expect(getRotatedCanvasDimensions(100, 200, 270)).toEqual({ width: 200, height: 100 });
    });

    test('retains dimensions for 180 degrees', () => {
      expect(getRotatedCanvasDimensions(100, 200, 180)).toEqual({ width: 100, height: 200 });
    });

    test('calculates correct dimensions for 45 degrees', () => {
      // W' = W*cos(45) + H*sin(45) = 100*0.7071 + 100*0.7071 = 141.42 -> 141
      expect(getRotatedCanvasDimensions(100, 100, 45)).toEqual({ width: 141, height: 141 });
    });

    test('handles negative angles correctly', () => {
      expect(getRotatedCanvasDimensions(100, 200, -90)).toEqual({ width: 200, height: 100 });
    });

    test('handles invalid inputs gracefully by returning 0 dimensions', () => {
      expect(getRotatedCanvasDimensions('invalid', 200, 90)).toEqual({ width: 0, height: 0 });
      expect(getRotatedCanvasDimensions(100, null, 90)).toEqual({ width: 0, height: 0 });
      expect(getRotatedCanvasDimensions(-10, 200, 90)).toEqual({ width: 0, height: 0 });
    });
  });

  describe('getReverseFilterComplex', () => {
    test('generates correct filter complexes with audio', () => {
      expect(getReverseFilterComplex(true)).toBe('[0:v]reverse[v];[0:a]areverse[a]');
    });

    test('generates correct filter complexes without audio', () => {
      expect(getReverseFilterComplex(false)).toBe('[0:v]reverse[v]');
    });
  });

  describe('getEraseFilterComplex', () => {
    test('generates correct filter for solid color box', () => {
      expect(getEraseFilterComplex('solid', 10, 20, 100, 50))
        .toBe('[0:v]drawbox=x=10:y=20:w=100:h=50:color=black:t=fill[v]');
    });

    test('generates correct filter for delogo interpolation', () => {
      expect(getEraseFilterComplex('interpolate', 10, 20, 100, 50))
        .toBe('[0:v]delogo=x=10:y=20:w=100:h=50[v]');
    });

    test('clamps coordinates to at least 1px for delogo to prevent ffmpeg boundary crashes', () => {
      expect(getEraseFilterComplex('interpolate', 0, 0, 100, 50))
        .toBe('[0:v]delogo=x=1:y=1:w=100:h=50[v]');
    });

    test('generates correct filter for boxblur', () => {
      expect(getEraseFilterComplex('blur', 10, 20, 100, 50))
        .toBe('[0:v]crop=w=100:h=50:x=10:y=20,boxblur=15:5[sub];[0:v][sub]overlay=x=10:y=20[v]');
    });
  });

  describe('Image enhancement and print size helpers', () => {
    describe('getPrintDimensions', () => {
      test('returns original/source dimensions for original preset', () => {
        expect(getPrintDimensions('original', 'portrait', 800, 600)).toEqual({ width: 800, height: 600 });
        expect(getPrintDimensions('', 'portrait', 800, 600)).toEqual({ width: 800, height: 600 });
      });

      test('multiplies dimensions for 2x, 3x, 4x presets', () => {
        expect(getPrintDimensions('2x', 'portrait', 800, 600)).toEqual({ width: 1600, height: 1200 });
        expect(getPrintDimensions('3x', 'landscape', 800, 600)).toEqual({ width: 2400, height: 1800 });
        expect(getPrintDimensions('4x', 'portrait', 800, 600)).toEqual({ width: 3200, height: 2400 });
      });

      test('returns standard print sizes in portrait orientation', () => {
        expect(getPrintDimensions('4x6', 'portrait', 800, 600)).toEqual({ width: 1200, height: 1800 });
        expect(getPrintDimensions('8x10', 'portrait', 800, 600)).toEqual({ width: 2400, height: 3000 });
        expect(getPrintDimensions('18x24', 'portrait', 800, 600)).toEqual({ width: 5400, height: 7200 });
      });

      test('returns standard print sizes in landscape orientation', () => {
        expect(getPrintDimensions('4x6', 'landscape', 800, 600)).toEqual({ width: 1800, height: 1200 });
        expect(getPrintDimensions('8x10', 'landscape', 800, 600)).toEqual({ width: 3000, height: 2400 });
        expect(getPrintDimensions('18x24', 'landscape', 800, 600)).toEqual({ width: 7200, height: 5400 });
      });

      test('handles invalid inputs gracefully by returning 0 dimensions', () => {
        expect(getPrintDimensions('8x10', 'portrait', 0, 600)).toEqual({ width: 0, height: 0 });
        expect(getPrintDimensions('8x10', 'portrait', 800, -5)).toEqual({ width: 0, height: 0 });
      });
    });

    describe('getSharpenKernel', () => {
      test('returns correct kernel values based on intensity', () => {
        expect(getSharpenKernel(0)).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
        expect(getSharpenKernel(1)).toEqual([0, -1, 0, -1, 5, -1, 0, -1, 0]);
        
        const kernelHalf = getSharpenKernel(0.5);
        expect(kernelHalf[1]).toBe(-0.5);
        expect(kernelHalf[4]).toBe(3);
      });
    });

    describe('getBlurKernel', () => {
      test('returns correct kernel values based on intensity', () => {
        expect(getBlurKernel(0)).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
        
        const kernelFull = getBlurKernel(1);
        expect(kernelFull[0]).toBe(1/16);
        expect(kernelFull[4]).toBe(4/16);
      });
    });

    describe('applyConvolution', () => {
      test('correctly convolves standard pixel array', () => {
        const pixels = new Uint8ClampedArray(36);
        pixels.fill(100);
        for(let i=3; i<36; i+=4) pixels[i] = 255;
        
        const identity = [0, 0, 0, 0, 1, 0, 0, 0, 0];
        const result = applyConvolution(pixels, 3, 3, identity);
        
        expect(result[0]).toBe(100);
        expect(result[3]).toBe(255);
      });
    });

    describe('applyEnhancementFilters', () => {
      test('performs color saturation adjustments', () => {
        const pixels = new Uint8ClampedArray([
          200, 50, 50, 255,
          50, 200, 50, 255,
          50, 50, 200, 255,
          100, 100, 100, 255
        ]);

        const result = applyEnhancementFilters(pixels, 2, 2, { colorBoost: 0.5 });
        expect(result[0]).toBeGreaterThan(200);
        expect(result[3]).toBe(255);
      });
    });

    describe('getViewportClassForMode', () => {
      test('returns view-mode-fit for fit mode', () => {
        expect(getViewportClassForMode('fit')).toBe('view-mode-fit');
      });

      test('returns view-mode-scroll-width for scroll-width mode', () => {
        expect(getViewportClassForMode('scroll-width')).toBe('view-mode-scroll-width');
      });

      test('returns view-mode-original for original mode', () => {
        expect(getViewportClassForMode('original')).toBe('view-mode-original');
      });

      test('defaults to view-mode-fit for invalid mode', () => {
        expect(getViewportClassForMode('invalid')).toBe('view-mode-fit');
        expect(getViewportClassForMode(null)).toBe('view-mode-fit');
        expect(getViewportClassForMode(undefined)).toBe('view-mode-fit');
      });
    });

    describe('replaceExtension', () => {
      test('replaces extension of filename with standard extension', () => {
        expect(replaceExtension('image.png', 'jpg')).toBe('image.jpg');
        expect(replaceExtension('archive.tar.gz', 'zip')).toBe('archive.tar.zip');
        expect(replaceExtension('photo.jpeg', 'webp')).toBe('photo.webp');
      });

      test('appends extension if filename has no extension', () => {
        expect(replaceExtension('image', 'png')).toBe('image.png');
        expect(replaceExtension('.hidden', 'png')).toBe('.png');
      });

      test('handles empty or non-string inputs gracefully', () => {
        expect(replaceExtension('', 'png')).toBe('');
        expect(replaceExtension(null, 'png')).toBe('');
        expect(replaceExtension(undefined, 'png')).toBe('');
      });
    });

    describe('formatMediaTelemetry', () => {
      test('formats complete telemetry info correctly', () => {
        const result = formatMediaTelemetry({
          duration: 125.5,
          width: 1920,
          height: 1080,
          size: '15.4 MB'
        });
        expect(result.duration).toBe('00:02:05.500');
        expect(result.resolution).toBe('1920 x 1080 px');
        expect(result.size).toBe('15.4 MB');
      });

      test('formats numeric size in bytes to KB', () => {
        const result = formatMediaTelemetry({
          duration: 10,
          width: 800,
          height: 600,
          size: 2048
        });
        expect(result.size).toBe('2.0 KB');
      });

      test('handles empty or missing info with safe defaults', () => {
        const emptyResult = formatMediaTelemetry(null);
        expect(emptyResult.duration).toBe('--:--:--.---');
        expect(emptyResult.resolution).toBe('-- x -- px');
        expect(emptyResult.size).toBe('--');

        const partialResult = formatMediaTelemetry({});
        expect(partialResult.duration).toBe('--:--:--.---');
        expect(partialResult.resolution).toBe('-- x -- px');
        expect(partialResult.size).toBe('--');
      });
    });

    describe('getDefaultFilenameForTool', () => {
      test('generates expected default filenames for various tools', () => {
        expect(getDefaultFilenameForTool('speed', 'vacation', 'mp4')).toBe('vacation_speed.mp4');
        expect(getDefaultFilenameForTool('crop', 'clip', 'mov')).toBe('clip_cropped.mov');
        expect(getDefaultFilenameForTool('rotate', 'video', 'mkv')).toBe('video_rotated.mkv');
        expect(getDefaultFilenameForTool('reverse', 'action', 'mp4')).toBe('action_reversed.mp4');
        expect(getDefaultFilenameForTool('delogo', 'screen', 'mp4')).toBe('screen_erased.mp4');
        expect(getDefaultFilenameForTool('mute', 'song', 'mp4')).toBe('song_muted.mp4');
        expect(getDefaultFilenameForTool('combine', 'movie', 'mp4')).toBe('movie_combined.mp4');
        expect(getDefaultFilenameForTool('audio', 'podcast', 'mp3')).toBe('podcast_audio.mp3');
        expect(getDefaultFilenameForTool('image_edit', 'photo', 'png')).toBe('photo_edited.png');
      });

      test('falls back gracefully to untitled when baseName is missing or empty', () => {
        expect(getDefaultFilenameForTool('speed', '', 'mp4')).toBe('untitled_speed.mp4');
        expect(getDefaultFilenameForTool('crop', null, 'mp4')).toBe('untitled_cropped.mp4');
      });
    });
  });

});
