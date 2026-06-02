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

  // Export block supporting both Node.js environment (for Vitest) and Browser
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      secondsToTimestamp,
      timestampToSeconds,
      isValidTimestampFormat,
      getAudioSpeedFilter,
      mapCropToNative,
      getSpeedRampFilterComplex
    };
  } else {
    window.helpers = {
      secondsToTimestamp,
      timestampToSeconds,
      isValidTimestampFormat,
      getAudioSpeedFilter,
      mapCropToNative,
      getSpeedRampFilterComplex
    };
  }
})();
