import { describe, test, expect } from 'vitest';
import helpers from './helpers.js';

const {
  secondsToTimestamp,
  timestampToSeconds,
  isValidTimestampFormat,
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
  replaceExtension
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
  });

});
