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
  changeVideoSpeed: (inputPath, outputPath, multiplier) =>
    ipcRenderer.invoke('change-video-speed', inputPath, outputPath, multiplier),

  /**
   * Opens the given directory in the macOS Finder.
   * @param {string} dirPath - Folder path.
   * @returns {Promise<void>}
   */
  openDirectory: (dirPath) => ipcRenderer.invoke('open-directory', dirPath),

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
