const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Opens native file dialog to select a video file.
   * @returns {Promise<{ filePath: string, name: string } | null>}
   */
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),

  /**
   * Opens native directory dialog to select where to save clips.
   * @param {string} [defaultPath] - Default directory to open.
   * @returns {Promise<string | null>}
   */
  selectOutputDirectory: (defaultPath) => ipcRenderer.invoke('select-output-directory', defaultPath),

  /**
   * Triggers the splitting process in the main process using FFmpeg.
   * @param {string} inputPath - Original video file path.
   * @param {string} outputDir - Directory to save clips in.
   * @param {string} accuracy - Splitting accuracy mode ("fast" or "accurate").
   * @param {Array<{ id: number, startTime: number, endTime: number, name: string }>} clips - Clip definitions.
   * @returns {Promise<{ success: boolean, message: string, error?: string }>}
   */
  splitVideo: (inputPath, outputDir, accuracy, clips) => 
    ipcRenderer.invoke('split-video', inputPath, outputDir, accuracy, clips),

  /**
   * Triggers the video speedup process in the main process.
   * @param {string} inputPath - Original video file path.
   * @param {string} outputPath - Path to save the modified video.
   * @param {number} multiplier - Speed multiplier (e.g. 2.0).
   * @returns {Promise<{ success: boolean, message: string, error?: string }>}
   */
  changeVideoSpeed: (inputPath, outputPath, multiplier, speedMode, duration) =>
    ipcRenderer.invoke('change-video-speed', inputPath, outputPath, multiplier, speedMode, duration),

  /**
   * Triggers the video reversing process in the main process.
   * @param {string} inputPath - Original video file path.
   * @param {string} outputPath - Path to save the modified video.
   * @param {boolean} reverseAudio - Whether to reverse and include audio.
   * @returns {Promise<{ success: boolean, message: string, error?: string }>}
   */
  reverseVideo: (inputPath, outputPath, reverseAudio) =>
    ipcRenderer.invoke('reverse-video', inputPath, outputPath, reverseAudio),

  /**
   * Triggers the video cropping process in the main process.
   * @param {string} inputPath - Original video file path.
   * @param {string} outputPath - Path to save the modified video.
   * @param {number} x - Native X coordinate of crop.
   * @param {number} y - Native Y coordinate of crop.
   * @param {number} width - Native width of crop.
   * @param {number} height - Native height of crop.
   * @returns {Promise<{ success: boolean, message: string, error?: string }>}
   */
  cropVideo: (inputPath, outputPath, x, y, width, height) =>
    ipcRenderer.invoke('crop-video', inputPath, outputPath, x, y, width, height),

  /**
   * Triggers the video text overlay removal (erase) process in the main process.
   * @param {string} inputPath - Original video file path.
   * @param {string} outputPath - Path to save the modified video.
   * @param {string} mode - Erase style mode ("blur", "solid", "interpolate").
   * @param {number} x - Native X coordinate of erase box.
   * @param {number} y - Native Y coordinate of erase box.
   * @param {number} width - Native width of erase box.
   * @param {number} height - Native height of erase box.
   * @returns {Promise<{ success: boolean, message: string, error?: string }>}
   */
  eraseVideo: (inputPath, outputPath, mode, x, y, width, height) =>
    ipcRenderer.invoke('erase-video', inputPath, outputPath, mode, x, y, width, height),

  /**
   * Opens the given directory in the macOS Finder.
   * @param {string} dirPath - Folder path.
   * @returns {Promise<void>}
   */
  openDirectory: (dirPath) => ipcRenderer.invoke('open-directory', dirPath),

  /**
   * Opens native file dialog to select an image file.
   * @returns {Promise<{ filePath: string, name: string, size: number } | null>}
   */
  selectImageFile: () => ipcRenderer.invoke('select-image-file'),

  /**
   * Saves image data url to a file.
   * @param {string} dataUrl - Image data URL.
   * @param {string} outputPath - Output file path.
   * @returns {Promise<{ success: boolean, message?: string }>}
   */
  saveImageFile: (dataUrl, outputPath) => ipcRenderer.invoke('save-image-file', dataUrl, outputPath),

  /**
   * Subscribes to splitting progress updates from the main process.
   * Returns a cleanup function to unsubscribe.
   * @param {function({ index: number, total: number, name: string, status: string, error?: string })} callback 
   * @returns {function()} Cleanup function
   */
  onSplitProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('split-progress', listener);
    return () => {
      ipcRenderer.removeListener('split-progress', listener);
    };
  }
});
