const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
const { getAudioSpeedFilter, getSpeedRampFilterComplex, getReverseFilterComplex, getEraseFilterComplex } = require('./helpers.js');

// Redirect stdout/stderr console logs to app.log file in User Data folder for troubleshooting
try {
  // Must check if app is ready or use path resolution after ready
  // app.getPath('userData') is available even before app ready
  const logDir = app.getPath('userData');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, 'app.log');
  const logStream = fs.createWriteStream(logPath, { flags: 'w' });

  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    logStream.write(`[INFO] [${new Date().toLocaleTimeString()}] ${msg}\n`);
    originalLog.apply(console, args);
  };

  console.error = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    logStream.write(`[ERROR] [${new Date().toLocaleTimeString()}] ${msg}\n`);
    originalError.apply(console, args);
  };
} catch (e) {
  // Ignore
}

// Register custom protocol 'media' to allow loading local files in <video> player
// before the app is ready.
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true, corsEnabled: true, standard: true } }
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
    icon: path.join(__dirname, 'icon.png'),
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
      return net.fetch(fileUrl).then(response => {
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      });
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
  app.quit();
});

// IPC Handler: File selector for video file
ipcMain.handle('select-video-file', async () => {
  console.log('Main Process: select-video-file IPC handler triggered');
  if (!mainWindow) {
    console.error('Main Process: select-video-file failed because mainWindow is null');
    return null;
  }

  try {
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
  } catch (err) {
    console.error('Main Process: select-video-file dialog error:', err);
    return null;
  }
});

// IPC Handler: File selector for image file
ipcMain.handle('select-image-file', async () => {
  console.log('Main Process: select-image-file IPC handler triggered');
  if (!mainWindow) {
    console.error('Main Process: select-image-file failed because mainWindow is null');
    return null;
  }

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Image File',
      filters: [
        { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const stats = fs.statSync(filePath);
    return {
      filePath,
      name: path.basename(filePath),
      size: stats.size
    };
  } catch (err) {
    console.error('Main Process: select-image-file dialog error:', err);
    return null;
  }
});

// IPC Handler: Save image file from base64 data URL
ipcMain.handle('save-image-file', async (event, dataUrl, outputPath) => {
  console.log('Main Process: save-image-file IPC handler triggered for', outputPath);
  try {
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(outputPath, buffer);
    return { success: true };
  } catch (err) {
    console.error('Main Process: save-image-file failed:', err);
    return { success: false, message: err.message };
  }
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

// IPC Handler: Video speedup execution
ipcMain.handle('change-video-speed', async (event, inputPath, outputPath, multiplier, speedMode, duration) => {
  if (!fs.existsSync(inputPath)) {
    return { success: false, message: 'Input video file does not exist.' };
  }

  const outputDir = path.dirname(outputPath);
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
    // Ignore
  }

  // Send progress notice
  mainWindow.webContents.send('split-progress', {
    index: 0,
    total: 1,
    name: path.basename(outputPath),
    status: 'processing'
  });

  try {
    if (speedMode === 'timelapse') {
      const filterVideoOnly = `[0:v]setpts=${(1 / multiplier).toFixed(6)}*PTS[v]`;
      const argsTimelapse = [
        '-i', inputPath,
        '-filter_complex', filterVideoOnly,
        '-map', '[v]',
        '-an',
        '-r', '30',
        '-c:v', 'libx264',
        '-preset', 'superfast',
        '-crf', '20',
        '-y',
        outputPath
      ];
      await runFFmpegCommand(argsTimelapse);
      
      mainWindow.webContents.send('split-progress', {
        index: 0,
        total: 1,
        name: path.basename(outputPath),
        status: 'done'
      });
      return { success: true, message: 'Time Lapse completed successfully!' };
    }

    let filterComplex;
    if (speedMode === 'ramp') {
      filterComplex = getSpeedRampFilterComplex(duration, multiplier, true);
    } else {
      const videoFilter = `setpts=${(1 / multiplier).toFixed(6)}*PTS`;
      const audioFilter = getAudioSpeedFilter(multiplier);
      filterComplex = `[0:v]${videoFilter}[v];[0:a]${audioFilter}[a]`;
    }

    const argsWithAudio = [
      '-i', inputPath,
      '-filter_complex', filterComplex,
      '-map', '[v]',
      '-map', '[a]',
      '-c:v', 'libx264',
      '-preset', 'superfast',
      '-crf', '20',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-y',
      outputPath
    ];

    await runFFmpegCommand(argsWithAudio);
    
    mainWindow.webContents.send('split-progress', {
      index: 0,
      total: 1,
      name: path.basename(outputPath),
      status: 'done'
    });
    return { success: true, message: 'Speed change completed successfully!' };
  } catch (error) {
    const errorStr = error.message.toLowerCase();
    
    // Check if the error is due to missing audio stream
    if (
      errorStr.includes('matches no streams') || 
      errorStr.includes('no audio') || 
      errorStr.includes('invalid stream') ||
      errorStr.includes('specifier \':a\'') ||
      errorStr.includes('stream copy')
    ) {
      console.log('Video does not have audio stream. Retrying with video-only filters...');
      
      let filterVideoOnly;
      if (speedMode === 'ramp') {
        filterVideoOnly = getSpeedRampFilterComplex(duration, multiplier, false);
      } else {
        filterVideoOnly = `[0:v]setpts=${(1 / multiplier).toFixed(6)}*PTS[v]`;
      }

      const argsVideoOnly = [
        '-i', inputPath,
        '-filter_complex', filterVideoOnly,
        '-map', '[v]',
        '-an',
        '-c:v', 'libx264',
        '-preset', 'superfast',
        '-crf', '20',
        '-y',
        outputPath
      ];

      try {
        await runFFmpegCommand(argsVideoOnly);
        
        mainWindow.webContents.send('split-progress', {
          index: 0,
          total: 1,
          name: path.basename(outputPath),
          status: 'done'
        });
        return { success: true, message: 'Speed change completed successfully (video-only)!' };
      } catch (videoError) {
        console.error('Video-only speed change failed:', videoError);
        mainWindow.webContents.send('split-progress', {
          index: 0,
          total: 1,
          name: path.basename(outputPath),
          status: 'error',
          error: videoError.message
        });
        return { success: false, message: `Failed to speed up video: ${videoError.message}` };
      }
    } else {
      console.error('Speed change failed:', error);
      mainWindow.webContents.send('split-progress', {
        index: 0,
        total: 1,
        name: path.basename(outputPath),
        status: 'error',
        error: error.message
      });
      return { success: false, message: `Failed to speed up video: ${error.message}` };
    }
  }
});

// IPC Handler: Video cropping execution
ipcMain.handle('crop-video', async (event, inputPath, outputPath, x, y, width, height) => {
  if (!fs.existsSync(inputPath)) {
    return { success: false, message: 'Input video file does not exist.' };
  }

  const outputDir = path.dirname(outputPath);
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
    // Ignore
  }

  const cropFilter = `crop=${width}:${height}:${x}:${y}`;

  const argsWithAudio = [
    '-i', inputPath,
    '-vf', cropFilter,
    '-c:v', 'libx264',
    '-preset', 'superfast',
    '-crf', '20',
    '-c:a', 'copy',
    '-y',
    outputPath
  ];

  // Send progress notice
  mainWindow.webContents.send('split-progress', {
    index: 0,
    total: 1,
    name: path.basename(outputPath),
    status: 'processing'
  });

  try {
    await runFFmpegCommand(argsWithAudio);
    
    mainWindow.webContents.send('split-progress', {
      index: 0,
      total: 1,
      name: path.basename(outputPath),
      status: 'done'
    });
    return { success: true, message: 'Cropping completed successfully!' };
  } catch (error) {
    const errorStr = error.message.toLowerCase();
    
    // Check if the error is due to missing audio stream
    if (
      errorStr.includes('matches no streams') || 
      errorStr.includes('no audio') || 
      errorStr.includes('invalid stream') ||
      errorStr.includes('specifier \':a\'') ||
      errorStr.includes('stream copy')
    ) {
      console.log('Video does not have audio stream. Retrying with video-only crop...');
      
      const argsVideoOnly = [
        '-i', inputPath,
        '-vf', cropFilter,
        '-an',
        '-c:v', 'libx264',
        '-preset', 'superfast',
        '-crf', '20',
        '-y',
        outputPath
      ];

      try {
        await runFFmpegCommand(argsVideoOnly);
        
        mainWindow.webContents.send('split-progress', {
          index: 0,
          total: 1,
          name: path.basename(outputPath),
          status: 'done'
        });
        return { success: true, message: 'Cropping completed successfully (video-only)!' };
      } catch (videoError) {
        console.error('Video-only cropping failed:', videoError);
        mainWindow.webContents.send('split-progress', {
          index: 0,
          total: 1,
          name: path.basename(outputPath),
          status: 'error',
          error: videoError.message
        });
        return { success: false, message: `Failed to crop video: ${videoError.message}` };
      }
    } else {
      console.error('Cropping failed:', error);
      mainWindow.webContents.send('split-progress', {
        index: 0,
        total: 1,
        name: path.basename(outputPath),
        status: 'error',
        error: error.message
      });
      return { success: false, message: `Failed to crop video: ${error.message}` };
    }
  }
});

// IPC Handler: Video reversing execution
ipcMain.handle('reverse-video', async (event, inputPath, outputPath, reverseAudio) => {
  if (!fs.existsSync(inputPath)) {
    return { success: false, message: 'Input video file does not exist.' };
  }

  const outputDir = path.dirname(outputPath);
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
    // Ignore
  }

  // Send progress notice
  mainWindow.webContents.send('split-progress', {
    index: 0,
    total: 1,
    name: path.basename(outputPath),
    status: 'processing'
  });

  const runReverse = async (useAudio) => {
    const filter = getReverseFilterComplex(useAudio);
    const args = [
      '-i', inputPath,
      '-filter_complex', filter,
      '-map', '[v]',
    ];
    if (useAudio) {
      args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '192k');
    } else {
      args.push('-an');
    }
    args.push(
      '-c:v', 'libx264',
      '-preset', 'superfast',
      '-crf', '20',
      '-y',
      outputPath
    );
    await runFFmpegCommand(args);
  };

  try {
    await runReverse(reverseAudio);
    mainWindow.webContents.send('split-progress', {
      index: 0,
      total: 1,
      name: path.basename(outputPath),
      status: 'done'
    });
    return { success: true, message: 'Reversing completed successfully!' };
  } catch (error) {
    const errorStr = error.message.toLowerCase();
    
    // Check if the error is due to missing audio stream
    if (
      reverseAudio && (
        errorStr.includes('matches no streams') || 
        errorStr.includes('no audio') || 
        errorStr.includes('invalid stream') ||
        errorStr.includes('specifier \':a\'') ||
        errorStr.includes('stream copy')
      )
    ) {
      console.log('Video does not have audio stream. Retrying with video-only reverse...');
      try {
        await runReverse(false);
        mainWindow.webContents.send('split-progress', {
          index: 0,
          total: 1,
          name: path.basename(outputPath),
          status: 'done'
        });
        return { success: true, message: 'Reversing completed successfully (video-only)!' };
      } catch (videoError) {
        console.error('Video-only reversing failed:', videoError);
        mainWindow.webContents.send('split-progress', {
          index: 0,
          total: 1,
          name: path.basename(outputPath),
          status: 'error',
          error: videoError.message
        });
        return { success: false, message: `Failed to reverse video: ${videoError.message}` };
      }
    } else {
      console.error('Reversing failed:', error);
      mainWindow.webContents.send('split-progress', {
        index: 0,
        total: 1,
        name: path.basename(outputPath),
        status: 'error',
        error: error.message
      });
      return { success: false, message: `Failed to reverse video: ${error.message}` };
    }
  }
});

// IPC Handler: Video erase execution
ipcMain.handle('erase-video', async (event, inputPath, outputPath, mode, x, y, width, height) => {
  if (!fs.existsSync(inputPath)) {
    return { success: false, message: 'Input video file does not exist.' };
  }

  const outputDir = path.dirname(outputPath);
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
    // Ignore
  }

  // Send progress notice
  mainWindow.webContents.send('split-progress', {
    index: 0,
    total: 1,
    name: path.basename(outputPath),
    status: 'processing'
  });

  const runErase = async (useAudio) => {
    const filterComplex = getEraseFilterComplex(mode, x, y, width, height);
    const args = [
      '-i', inputPath,
      '-filter_complex', filterComplex,
      '-map', '[v]'
    ];
    if (useAudio) {
      args.push('-map', '0:a', '-c:a', 'copy');
    } else {
      args.push('-an');
    }
    args.push(
      '-c:v', 'libx264',
      '-preset', 'superfast',
      '-crf', '20',
      '-y',
      outputPath
    );
    await runFFmpegCommand(args);
  };

  try {
    await runErase(true);
    mainWindow.webContents.send('split-progress', {
      index: 0,
      total: 1,
      name: path.basename(outputPath),
      status: 'done'
    });
    return { success: true, message: 'Text overlay removal completed successfully!' };
  } catch (error) {
    const errorStr = error.message.toLowerCase();
    
    // Check if the error is due to missing audio stream
    if (
      errorStr.includes('matches no streams') || 
      errorStr.includes('no audio') || 
      errorStr.includes('invalid stream') ||
      errorStr.includes('specifier \':a\'') ||
      errorStr.includes('stream copy')
    ) {
      console.log('Video does not have audio stream. Retrying with video-only erase...');
      try {
        await runErase(false);
        mainWindow.webContents.send('split-progress', {
          index: 0,
          total: 1,
          name: path.basename(outputPath),
          status: 'done'
        });
        return { success: true, message: 'Text overlay removal completed successfully (video-only)!' };
      } catch (videoError) {
        console.error('Video-only erase failed:', videoError);
        mainWindow.webContents.send('split-progress', {
          index: 0,
          total: 1,
          name: path.basename(outputPath),
          status: 'error',
          error: videoError.message
        });
        return { success: false, message: `Failed to remove text overlay: ${videoError.message}` };
      }
    } else {
      console.error('Erase failed:', error);
      mainWindow.webContents.send('split-progress', {
        index: 0,
        total: 1,
        name: path.basename(outputPath),
        status: 'error',
        error: error.message
      });
      return { success: false, message: `Failed to remove text overlay: ${error.message}` };
    }
  }
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
