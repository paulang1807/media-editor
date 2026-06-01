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

  // Export block supporting both Node.js environment (for Vitest) and Browser
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      secondsToTimestamp,
      timestampToSeconds,
      isValidTimestampFormat
    };
  } else {
    window.helpers = {
      secondsToTimestamp,
      timestampToSeconds,
      isValidTimestampFormat
    };
  }
})();
