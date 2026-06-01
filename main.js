const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');

// Register custom protocol 'media' to allow loading local files in <video> player
// before the app is ready.
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
]);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    title: 'Media Splitter & Editor',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  // Print renderer console logs to terminal for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] ${message} (at ${path.basename(sourceId)}:${line})`);
  });

  // Open DevTools in development if needed
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Handle custom media protocol
  protocol.handle('media', (request) => {
    let filePath = decodeURIComponent(request.url.replace(/^media:\/\//i, ''));
    
    // Ensure absolute path on non-Windows starts with '/'
    if (process.platform !== 'win32' && !filePath.startsWith('/')) {
      filePath = '/' + filePath;
    }

    try {
      const fileUrl = pathToFileURL(filePath).toString();
      return net.fetch(fileUrl);
    } catch (error) {
      console.error('Failed to serve media:', error);
      return new Response('Media file not found', { status: 404 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler: File selector for video file
ipcMain.handle('select-video-file', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Video File',
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  return {
    filePath,
    name: path.basename(filePath)
  };
});

// IPC Handler: Save directory selector
ipcMain.handle('select-output-directory', async (event, defaultPath) => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Output Directory',
    defaultPath: defaultPath || app.getPath('downloads'),
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// IPC Handler: Open directory in Finder
ipcMain.handle('open-directory', async (event, dirPath) => {
  if (fs.existsSync(dirPath)) {
    shell.openPath(dirPath);
  }
});

// IPC Handler: Video splitting command execution
ipcMain.handle('split-video', async (event, inputPath, outputDir, accuracy, clips) => {
  if (!fs.existsSync(inputPath)) {
    return { success: false, message: 'Input video file does not exist.' };
  }

  if (!fs.existsSync(outputDir)) {
    try {
      fs.mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      return { success: false, message: `Could not create output directory: ${err.message}` };
    }
  }

  // Ensure ffmpeg-static binary is executable
  try {
    fs.chmodSync(ffmpegPath, 0o755);
  } catch (e) {
    // Ignore if already set or read-only filesystem
  }

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const outputPath = path.join(outputDir, clip.name);

    // Notify Renderer that we are processing this clip
    mainWindow.webContents.send('split-progress', {
      index: i,
      total: clips.length,
      name: clip.name,
      status: 'processing'
    });

    const duration = clip.endTime - clip.startTime;

    let ffmpegArgs = [];
    if (accuracy === 'fast') {
      // Fast, lossless stream copying.
      // -ss before -i makes it fast, seek to keyframe.
      // -t sets duration.
      ffmpegArgs = [
        '-ss', clip.startTime.toFixed(3),
        '-i', inputPath,
        '-t', duration.toFixed(3),
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-y',
        outputPath
      ];
    } else {
      // Frame-accurate re-encoding.
      ffmpegArgs = [
        '-ss', clip.startTime.toFixed(3),
        '-i', inputPath,
        '-t', duration.toFixed(3),
        '-c:v', 'libx264',
        '-preset', 'superfast',
        '-crf', '20',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-y',
        outputPath
      ];
    }

    try {
      await runFFmpegCommand(ffmpegArgs);
      
      // Notify Renderer of clip completion
      mainWindow.webContents.send('split-progress', {
        index: i,
        total: clips.length,
        name: clip.name,
        status: 'done'
      });
    } catch (error) {
      console.error(`Error splitting clip ${clip.name}:`, error);
      mainWindow.webContents.send('split-progress', {
        index: i,
        total: clips.length,
        name: clip.name,
        status: 'error',
        error: error.message
      });
      return { success: false, message: `Failed on clip "${clip.name}": ${error.message}` };
    }
  }

  return { success: true, message: 'All clips generated successfully!' };
});

/**
 * Runs a spawned FFmpeg process.
 * @param {Array<string>} args - Command-line arguments for FFmpeg.
 * @returns {Promise<void>}
 */
function runFFmpegCommand(args) {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, args);
    let stderr = '';

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg process failed with exit code ${code}.\nDetails: ${stderr}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}
