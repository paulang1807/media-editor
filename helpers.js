/**
 * Helper utilities for time formatting and parsing.
 * Wrapped in an IIFE to prevent polluting the global window namespace.
 */
(function () {
  /**
   * Format a duration in seconds to a string of HH:MM:SS.mmm.
   * @param {number} seconds - The duration in seconds.
   * @returns {string} The formatted string.
   */
  function secondsToTimestamp(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      return '00:00:00.000';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    const pad = (num, size) => num.toString().padStart(size, '0');

    return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(remainingSeconds, 2)}.${pad(milliseconds, 3)}`;
  }

  /**
   * Parse a timestamp string (HH:MM:SS.mmm or MM:SS or SS) into seconds.
   * Supports various formats: "01:02:03.456", "02:03", "123.45"
   * @param {string} timestamp - The timestamp string.
   * @returns {number|null} The duration in seconds, or null if invalid.
   */
  function timestampToSeconds(timestamp) {
    if (typeof timestamp !== 'string') {
      return null;
    }

    const cleaned = timestamp.trim();
    if (!cleaned || cleaned.includes('-')) {
      return null;
    }

    // Check if it's just a number (e.g. "123.45")
    if (/^\d+(\.\d+)?$/.test(cleaned)) {
      return parseFloat(cleaned);
    }

    // Match formats: HH:MM:SS.mmm or HH:MM:SS
    // Also matches MM:SS.mmm or MM:SS
    const parts = cleaned.split(':');
    if (parts.length > 3 || parts.length < 2) {
      return null;
    }

    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    if (parts.length === 3) {
      // HH:MM:SS.mmm
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
      seconds = parseFloat(parts[2]);
    } else {
      // MM:SS.mmm
      minutes = parseInt(parts[0], 10);
      seconds = parseFloat(parts[1]);
    }

    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      return null;
    }

    if (hours < 0 || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) {
      return null;
    }

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Validates if a string matches a timestamp format (HH:MM:SS or HH:MM:SS.mmm or MM:SS)
   * @param {string} timestamp 
   * @returns {boolean}
   */
  function isValidTimestampFormat(timestamp) {
    if (typeof timestamp !== 'string') return false;
    const cleaned = timestamp.trim();
    
    // Format: SS.mmm or SS
    if (/^\d+(\.\d+)?$/.test(cleaned)) return true;
    
    // Format: MM:SS or MM:SS.mmm
    if (/^\d{1,2}:\d{2}(\.\d{1,3})?$/.test(cleaned)) return true;
    
    // Format: HH:MM:SS or HH:MM:SS.mmm
    if (/^\d{1,2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(cleaned)) return true;

    return false;
  }

  /**
   * Generates the FFmpeg 'atempo' filter chain string for a speed multiplier.
   * Since atempo only accepts values in [0.5, 2.0], values outside this range
   * must be chained (multiplied).
   * @param {number} multiplier
   * @returns {string} FFmpeg audio filter string
   */
  function getAudioSpeedFilter(multiplier) {
    if (typeof multiplier !== 'number' || isNaN(multiplier) || multiplier <= 0) {
      return 'atempo=1';
    }

    const filters = [];
    let temp = multiplier;

    if (temp > 2.0) {
      while (temp > 2.0) {
        filters.push('atempo=2.0');
        temp /= 2.0;
      }
      if (temp >= 0.5) {
        filters.push(`atempo=${temp.toFixed(6)}`);
      }
    } else if (temp < 0.5) {
      while (temp < 0.5) {
        filters.push('atempo=0.5');
        temp /= 0.5;
      }
      if (temp >= 0.5) {
        filters.push(`atempo=${temp.toFixed(6)}`);
      }
    } else {
      filters.push(`atempo=${temp.toFixed(6)}`);
    }

    return filters.map(f => {
      const val = parseFloat(f.split('=')[1]);
      return `atempo=${val.toString()}`;
    }).join(',');
  }

  /**
   * Projects a visual crop box coordinate (relative to display container bounds)
   * to the native pixel dimensions of the video.
   * @param {{ left: number, top: number, width: number, height: number }} cropRect
   * @param {{ width: number, height: number }} videoContentRect
   * @param {number} nativeWidth
   * @param {number} nativeHeight
   * @returns {{ x: number, y: number, width: number, height: number }} Native crop dimensions
   */
  function mapCropToNative(cropRect, videoContentRect, nativeWidth, nativeHeight) {
    if (!cropRect || !videoContentRect || !nativeWidth || !nativeHeight) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const scaleX = nativeWidth / videoContentRect.width;
    const scaleY = nativeHeight / videoContentRect.height;

    let x = Math.round(cropRect.left * scaleX);
    let y = Math.round(cropRect.top * scaleY);
    let w = Math.round(cropRect.width * scaleX);
    let h = Math.round(cropRect.height * scaleY);

    // Clamping
    x = Math.max(0, Math.min(x, nativeWidth));
    y = Math.max(0, Math.min(y, nativeHeight));

    if (x + w > nativeWidth) {
      w = nativeWidth - x;
    }
    if (y + h > nativeHeight) {
      h = nativeHeight - y;
    }

    w = Math.max(1, w);
    h = Math.max(1, h);

    return { x, y, width: w, height: h };
  }

  /**
   * Generates the complex filter graph for a 5-slice speed ramp.
   * @param {number} duration - Video duration in seconds.
   * @param {number} peakSpeed - Peak speed factor.
   * @param {boolean} hasAudio - Whether video contains audio.
   * @returns {string} The FFmpeg filter_complex filter graph.
   */
  function getSpeedRampFilterComplex(duration, peakSpeed, hasAudio) {
    if (typeof duration !== 'number' || isNaN(duration) || duration <= 0) {
      duration = 1.0;
    }
    if (typeof peakSpeed !== 'number' || isNaN(peakSpeed) || peakSpeed <= 0) {
      peakSpeed = 1.0;
    }

    const slices = 5;
    const sliceDuration = duration / slices;
    
    // Symmetrical bell-curve speed multipliers
    const multipliers = [
      1.0 + 0.25 * (peakSpeed - 1.0),
      1.0 + 0.75 * (peakSpeed - 1.0),
      peakSpeed,
      1.0 + 0.75 * (peakSpeed - 1.0),
      1.0 + 0.25 * (peakSpeed - 1.0)
    ];

    let filterParts = [];
    let concatInputs = '';

    for (let i = 0; i < slices; i++) {
      const start = (i * sliceDuration).toFixed(6);
      const end = ((i + 1) * sliceDuration).toFixed(6);
      // Ensure multiplier is positive and non-zero to avoid division-by-zero
      const m = Math.max(0.05, multipliers[i]);
      const setptsFactor = (1 / m).toFixed(6);

      // Video slice
      filterParts.push(`[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS,setpts=${setptsFactor}*PTS[v${i}]`);

      // Audio slice (if present)
      if (hasAudio) {
        const audioFilter = getAudioSpeedFilter(m);
        filterParts.push(`[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,${audioFilter}[a${i}]`);
      }
    }

    // Interleave concat input streams (v0, a0, v1, a1, ...)
    for (let i = 0; i < slices; i++) {
      concatInputs += `[v${i}]`;
      if (hasAudio) {
        concatInputs += `[a${i}]`;
      }
    }

    // Concatenate all slices
    if (hasAudio) {
      filterParts.push(`${concatInputs}concat=n=${slices}:v=1:a=1[v][a]`);
    } else {
      filterParts.push(`${concatInputs}concat=n=${slices}:v=1:a=0[v]`);
    }

    return filterParts.join(';');
  }

  /**
   * Calculates the bounding box of a rotated rectangle.
   * @param {number} width - Original width.
   * @param {number} height - Original height.
   * @param {number} degrees - Angle in degrees.
   * @returns {{ width: number, height: number }} Bounding box dimensions.
   */
  function getRotatedCanvasDimensions(width, height, degrees) {
    if (typeof width !== 'number' || isNaN(width) || width <= 0 ||
        typeof height !== 'number' || isNaN(height) || height <= 0) {
      return { width: 0, height: 0 };
    }
    const radians = (degrees * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    const newWidth = Math.round(width * cos + height * sin);
    const newHeight = Math.round(width * sin + height * cos);
    return { width: newWidth, height: newHeight };
  }

  /**
   * Generates FFmpeg complex filter string for reversing video and optionally audio.
   * @param {boolean} hasAudio - Whether video contains audio to reverse.
   * @returns {string} FFmpeg filter_complex string.
   */
  function getReverseFilterComplex(hasAudio) {
    if (hasAudio) {
      return '[0:v]reverse[v];[0:a]areverse[a]';
    } else {
      return '[0:v]reverse[v]';
    }
  }

  /**
   * Generates FFmpeg complex filter graph for erasing a region.
   * @param {string} mode - "blur", "solid", or "interpolate".
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @returns {string} Complex filter graph string.
   */
  function getEraseFilterComplex(mode, x, y, w, h) {
    if (mode === 'solid') {
      return `[0:v]drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=black:t=fill[v]`;
    } else if (mode === 'interpolate') {
      return `[0:v]delogo=x=${x}:y=${y}:w=${w}:h=${h}[v]`;
    } else {
      // Default: Smooth Blur using crop, boxblur, and overlay
      return `[0:v]crop=w=${w}:h=${h}:x=${x}:y=${y},boxblur=15:5[sub];[0:v][sub]overlay=x=${x}:y=${y}[v]`;
    }
  }

  /**
   * Calculates target width and height based on print size presets or scale factors.
   * @param {string} preset - e.g. "original", "2x", "4x6", "8x10", "18x24", "a4"
   * @param {string} orientation - "portrait" or "landscape"
   * @param {number} sourceWidth - input width
   * @param {number} sourceHeight - input height
   * @returns {{ width: number, height: number }}
   */
  function getPrintDimensions(preset, orientation, sourceWidth, sourceHeight) {
    if (typeof sourceWidth !== 'number' || isNaN(sourceWidth) || sourceWidth <= 0 ||
        typeof sourceHeight !== 'number' || isNaN(sourceHeight) || sourceHeight <= 0) {
      return { width: 0, height: 0 };
    }

    if (!preset || preset === 'original') {
      return { width: sourceWidth, height: sourceHeight };
    }
    
    if (preset === '2x') {
      return { width: Math.round(sourceWidth * 2), height: Math.round(sourceHeight * 2) };
    }
    if (preset === '3x') {
      return { width: Math.round(sourceWidth * 3), height: Math.round(sourceHeight * 3) };
    }
    if (preset === '4x') {
      return { width: Math.round(sourceWidth * 4), height: Math.round(sourceHeight * 4) };
    }

    let w = 0;
    let h = 0;

    switch (preset) {
      case '4x6':
        w = 1200;
        h = 1800;
        break;
      case '5x7':
        w = 1500;
        h = 2100;
        break;
      case '8x10':
        w = 2400;
        h = 3000;
        break;
      case '11x14':
        w = 3300;
        h = 4200;
        break;
      case '18x24':
        w = 5400;
        h = 7200;
        break;
      case 'a4':
        w = 2480;
        h = 3508;
        break;
      default:
        return { width: sourceWidth, height: sourceHeight };
    }

    if (orientation === 'landscape') {
      return { width: h, height: w };
    }
    return { width: w, height: h };
  }

  /**
   * Generates a 3x3 sharpen kernel matrix.
   * @param {number} intensity - 0 to 1
   * @returns {number[]} 9-element array
   */
  function getSharpenKernel(intensity) {
    if (typeof intensity !== 'number' || isNaN(intensity) || intensity < 0) {
      intensity = 0;
    }
    intensity = Math.min(1, intensity);
    const edge = intensity === 0 ? 0 : -intensity;
    const center = 1 + 4 * intensity;
    return [
      0, edge, 0,
      edge, center, edge,
      0, edge, 0
    ];
  }

  /**
   * Generates a 3x3 gaussian-like blur kernel matrix for noise reduction.
   * @param {number} intensity - 0 to 1
   * @returns {number[]} 9-element array
   */
  function getBlurKernel(intensity) {
    if (typeof intensity !== 'number' || isNaN(intensity) || intensity < 0) {
      intensity = 0;
    }
    intensity = Math.min(1, intensity);
    const blur = [
      1/16, 2/16, 1/16,
      2/16, 4/16, 2/16,
      1/16, 2/16, 1/16
    ];
    const identity = [
      0, 0, 0,
      0, 1, 0,
      0, 0, 0
    ];
    const kernel = [];
    for (let i = 0; i < 9; i++) {
      kernel.push(identity[i] * (1 - intensity) + blur[i] * intensity);
    }
    return kernel;
  }

  /**
   * Applies a 3x3 convolution matrix to an RGBA pixel array.
   * @param {Uint8ClampedArray} pixels
   * @param {number} width
   * @param {number} height
   * @param {number[]} kernel
   * @returns {Uint8ClampedArray}
   */
  function applyConvolution(pixels, width, height, kernel) {
    const side = Math.round(Math.sqrt(kernel.length));
    const halfSide = Math.floor(side / 2);
    const src = pixels;
    const dst = new Uint8ClampedArray(src.length);

    for (let y = 0; y < height; y++) {
      const yOffset = y * width;
      for (let x = 0; x < width; x++) {
        const dstIdx = (yOffset + x) * 4;
        let r = 0, g = 0, b = 0;

        for (let cy = 0; cy < side; cy++) {
          const scy = Math.min(height - 1, Math.max(0, y + cy - halfSide));
          const scyOffset = scy * width;
          const kRowOffset = cy * side;
          for (let cx = 0; cx < side; cx++) {
            const scx = Math.min(width - 1, Math.max(0, x + cx - halfSide));
            const srcIdx = (scyOffset + scx) * 4;
            const wt = kernel[kRowOffset + cx];

            r += src[srcIdx] * wt;
            g += src[srcIdx + 1] * wt;
            b += src[srcIdx + 2] * wt;
          }
        }

        dst[dstIdx] = Math.max(0, Math.min(255, r));
        dst[dstIdx + 1] = Math.max(0, Math.min(255, g));
        dst[dstIdx + 2] = Math.max(0, Math.min(255, b));
        dst[dstIdx + 3] = src[dstIdx + 3]; // Keep alpha intact
      }
    }
    return dst;
  }

  /**
   * Applies image enhancement pipeline.
   * @param {Uint8ClampedArray} pixelData
   * @param {number} width
   * @param {number} height
   * @param {{ sharpen?: number, denoise?: number, colorBoost?: number, autoContrast?: boolean }} options
   * @returns {Uint8ClampedArray}
   */
  function applyEnhancementFilters(pixelData, width, height, options) {
    let currentPixels = pixelData;

    // 1. Denoise
    if (options.denoise && options.denoise > 0) {
      const blurKernel = getBlurKernel(options.denoise);
      currentPixels = applyConvolution(currentPixels, width, height, blurKernel);
    }

    // 2. Sharpen
    if (options.sharpen && options.sharpen > 0) {
      const sharpenKernel = getSharpenKernel(options.sharpen);
      currentPixels = applyConvolution(currentPixels, width, height, sharpenKernel);
    }

    // 3. Contrast, Auto-Contrast & Color Boost
    const doColorBoost = options.colorBoost && options.colorBoost > 0;
    const doAutoContrast = options.autoContrast;

    if (doColorBoost || doAutoContrast) {
      let minL = 255;
      let maxL = 0;

      if (doAutoContrast) {
        for (let i = 0; i < currentPixels.length; i += 4) {
          const lum = 0.299 * currentPixels[i] + 0.587 * currentPixels[i + 1] + 0.114 * currentPixels[i + 2];
          if (lum < minL) minL = lum;
          if (lum > maxL) maxL = lum;
        }
        if (maxL === minL) {
          maxL = 255;
          minL = 0;
        }
      }

      const satFactor = doColorBoost ? (1.0 + options.colorBoost) : 1.0;
      let outputPixels = currentPixels === pixelData ? new Uint8ClampedArray(pixelData) : currentPixels;

      for (let i = 0; i < outputPixels.length; i += 4) {
        let r = outputPixels[i];
        let g = outputPixels[i + 1];
        let b = outputPixels[i + 2];

        if (doAutoContrast) {
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const targetLum = ((lum - minL) / (maxL - minL)) * 255;
          const scale = lum > 0 ? (targetLum / lum) : 0;
          r = Math.max(0, Math.min(255, r * scale));
          g = Math.max(0, Math.min(255, g * scale));
          b = Math.max(0, Math.min(255, b * scale));
        }

        if (doColorBoost) {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          r = Math.max(0, Math.min(255, gray + (r - gray) * satFactor));
          g = Math.max(0, Math.min(255, gray + (g - gray) * satFactor));
          b = Math.max(0, Math.min(255, gray + (b - gray) * satFactor));
        }

        outputPixels[i] = r;
        outputPixels[i + 1] = g;
        outputPixels[i + 2] = b;
      }

      currentPixels = outputPixels;
    }

    return currentPixels;
  }

  /**
   * Helper to map view modes to styling class names for the image viewport.
   * @param {string} mode - The selected view mode.
   * @returns {string} The CSS class name.
   */
  function getViewportClassForMode(mode) {
    const validModes = ['fit', 'scroll-width', 'original'];
    const activeMode = validModes.includes(mode) ? mode : 'fit';
    return `view-mode-${activeMode}`;
  }

  /**
   * Replaces the file extension of a filename with a new extension.
   * @param {string} filename - The original filename.
   * @param {string} newExt - The new extension (without the dot, e.g., 'jpg', 'png', 'webp').
   * @returns {string} The filename with the new extension.
   */
  function replaceExtension(filename, newExt) {
    if (typeof filename !== 'string' || !filename) return '';
    const lastDot = filename.lastIndexOf('.');
    const base = lastDot !== -1 ? filename.substring(0, lastDot) : filename;
    return `${base}.${newExt}`;
  }

  // Export block supporting both Node.js environment (for Vitest) and Browser
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
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
    };
  } else {
    window.helpers = {
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
    };
  }
})();
