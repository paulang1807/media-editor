// Access helpers from global window object
const { secondsToTimestamp, timestampToSeconds, isValidTimestampFormat, getAudioSpeedFilter, mapCropToNative } = window.helpers;

// State management
let videoPath = null;
let videoName = null;
let videoBaseName = '';
let videoExt = 'mp4';
let videoDuration = 0;
let outputDir = null;
let clips = [];
let activeClipIndex = null; // Track which clip is currently being played/previewed
let speedMultiplier = 1.0;

// Cropper State
let cropRect = { left: 0, top: 0, width: 0, height: 0 };
let cropNormalized = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
let currentAspectRatio = 'free'; // 'free', '1:1', '16:9', '9:16', '4:3'
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragMode = null; // 'move', 'tl', 'tr', 'bl', 'br'
let cropBoxStart = { left: 0, top: 0, width: 0, height: 0 };

// Color palette for clip timelines (Dark mode glowing translucent colors)
const CLIP_COLORS = [
  { bg: 'rgba(139, 92, 246, 0.25)', border: 'rgb(139, 92, 246)' }, // Purple
  { bg: 'rgba(16, 185, 129, 0.25)', border: 'rgb(16, 185, 129)' }, // Emerald
  { bg: 'rgba(245, 158, 11, 0.25)', border: 'rgb(245, 158, 11)' }, // Amber
  { bg: 'rgba(6, 182, 212, 0.25)', border: 'rgb(6, 182, 212)' },  // Cyan
  { bg: 'rgba(236, 72, 153, 0.25)', border: 'rgb(236, 72, 153)' }, // Rose
  { bg: 'rgba(59, 130, 246, 0.25)', border: 'rgb(59, 130, 246)' }, // Blue
  { bg: 'rgba(20, 184, 166, 0.25)', border: 'rgb(20, 184, 166)' }, // Teal
  { bg: 'rgba(249, 115, 22, 0.25)', border: 'rgb(249, 115, 22)' }  // Orange
];

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInputBtn = document.getElementById('file-input-btn');
const changeFileBtn = document.getElementById('change-file-btn');
const emptyState = document.getElementById('empty-state');
const editorWorkspace = document.getElementById('editor-workspace');
const videoPlayer = document.getElementById('video-player');
const loadedFileName = document.getElementById('loaded-file-name');
const loadedFileDuration = document.getElementById('loaded-file-duration');

// Playback Controls
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const currentTimeDisplay = document.getElementById('current-time-display');
const totalTimeDisplay = document.getElementById('total-time-display');
const timelineScrubber = document.getElementById('timeline-scrubber');
const timelineRangesContainer = document.getElementById('timeline-ranges-container');

// Sidebar / Configuration
const clipCountInput = document.getElementById('clip-count');
const clipsContainer = document.getElementById('clips-container');
const splitAccuracySelect = document.getElementById('split-accuracy');
const generateBtn = document.getElementById('generate-btn');

// Sidebar Tabs & Panels
const tabSplit = document.getElementById('tab-split');
const tabSpeed = document.getElementById('tab-speed');
const tabCrop = document.getElementById('tab-crop');
const panelSplit = document.getElementById('panel-split');
const panelSpeed = document.getElementById('panel-speed');
const panelCrop = document.getElementById('panel-crop');

// Speed Changer Elements
const speedSlider = document.getElementById('speed-slider');
const speedInput = document.getElementById('speed-input');
const speedFilenameInput = document.getElementById('speed-filename-input');
const speedGenerateBtn = document.getElementById('speed-generate-btn');
const btnSpeedModeConstant = document.getElementById('speed-mode-constant');
const btnSpeedModeRamp = document.getElementById('speed-mode-ramp');
let speedMode = 'constant';

// Cropper UI Elements
const cropOverlayContainer = document.getElementById('crop-overlay-container');
const cropBox = document.getElementById('crop-box');
const cropValX = document.getElementById('crop-val-x');
const cropValY = document.getElementById('crop-val-y');
const cropValW = document.getElementById('crop-val-w');
const cropValH = document.getElementById('crop-val-h');
const cropFilenameInput = document.getElementById('crop-filename-input');
const cropGenerateBtn = document.getElementById('crop-generate-btn');

// Masks
const maskTop = document.getElementById('crop-mask-top');
const maskBottom = document.getElementById('crop-mask-bottom');
const maskLeft = document.getElementById('crop-mask-left');
const maskRight = document.getElementById('crop-mask-right');

// Progress & Overlays
const progressOverlay = document.getElementById('progress-overlay');
const progressStatusText = document.getElementById('progress-status');
const progressProgressBar = document.getElementById('progress-bar-fill');
const progressPercentText = document.getElementById('progress-percent');
const resultsOverlay = document.getElementById('results-overlay');
const openFinderBtn = document.getElementById('open-finder-btn');
const closeResultsBtn = document.getElementById('close-results-btn');

// Settings Preference Elements
const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const settingsDirPath = document.getElementById('settings-dir-path');
const settingsBrowseBtn = document.getElementById('settings-browse-btn');
const settingsAlwaysPrompt = document.getElementById('settings-always-prompt');
const settingsDefaultAccuracy = document.getElementById('settings-default-accuracy');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');

let settings = {
  defaultExportDir: null,
  alwaysPrompt: true,
  defaultAccuracy: 'fast'
};

// Initialize Events
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupFileImportEvents();
  setupPlayerEvents();
  setupSidebarEvents();
  setupExportEvents();
  setupTabEvents();
  setupSpeedChangerEvents();
  setupCropperEvents();
  setupSettingsEvents();
});

// 1. File Import Handlers
function setupFileImportEvents() {
  fileInputBtn.addEventListener('click', async () => {
    console.log('Renderer: Browse File button clicked');
    try {
      const fileData = await window.electronAPI.selectVideoFile();
      console.log('Renderer: selectVideoFile IPC returned:', fileData);
      if (fileData) {
        loadVideo(fileData.filePath, fileData.name);
      }
    } catch (err) {
      console.error('Renderer: selectVideoFile failed with error:', err);
    }
  });

  if (changeFileBtn) {
    changeFileBtn.addEventListener('click', async () => {
      console.log('Renderer: Change Video button clicked');
      try {
        const fileData = await window.electronAPI.selectVideoFile();
        console.log('Renderer: selectVideoFile IPC returned:', fileData);
        if (fileData) {
          loadVideo(fileData.filePath, fileData.name);
        }
      } catch (err) {
        console.error('Renderer: selectVideoFile failed with error:', err);
      }
    });
  }

  // Drag and Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // Basic check for video file
      const videoExtensions = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.m4v'];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (videoExtensions.includes(fileExt)) {
        loadVideo(file.path, file.name);
      } else {
        alert('Unsupported file type. Please load a video file.');
      }
    }
  });
}

function loadVideo(filePath, fileName) {
  videoPath = filePath;
  videoName = fileName;
  
  const lastDot = fileName.lastIndexOf('.');
  videoBaseName = lastDot !== -1 ? fileName.substring(0, lastDot) : fileName;
  videoExt = lastDot !== -1 ? fileName.substring(lastDot + 1) : 'mp4';
  
  // Set default output directory (null initially, will prompt)
  outputDir = null;

  loadedFileName.textContent = fileName;

  // Use the custom media:// protocol to load file without context restriction
  videoPlayer.src = `media://${filePath}`;
  videoPlayer.load();

  // Reset speed multiplier to 1.0, speed mode to constant, and update previsualizer
  speedMultiplier = 1.0;
  speedMode = 'constant';
  if (speedSlider) speedSlider.value = 1.0;
  if (speedInput) speedInput.value = 1.0;
  if (btnSpeedModeConstant) btnSpeedModeConstant.classList.add('active');
  if (btnSpeedModeRamp) btnSpeedModeRamp.classList.remove('active');
  updateSpeedFilenamePreview();

  // Reset cropping settings
  currentAspectRatio = 'free';
  updateCropFilenamePreview();

  videoPlayer.addEventListener('loadedmetadata', onVideoMetadataLoaded, { once: true });
}

function onVideoMetadataLoaded() {
  videoDuration = videoPlayer.duration;
  loadedFileDuration.textContent = secondsToTimestamp(videoDuration);
  totalTimeDisplay.textContent = secondsToTimestamp(videoDuration);
  timelineScrubber.max = videoDuration;
  timelineScrubber.value = 0;

  // Show workspace, hide empty state
  emptyState.style.display = 'none';
  editorWorkspace.style.display = 'flex';

  // Initialize Clips
  clipCountInput.value = 2; // Default to 2 clips
  generateClipsData(2);

  // Initialize crop normalized coords
  cropNormalized = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };

  if (tabCrop && tabCrop.classList.contains('active')) {
    setTimeout(updateCropOverlayLayout, 50);
  }
}

// 2. Video Player Event & Scrubber Setup
function setupPlayerEvents() {
  playPauseBtn.addEventListener('click', togglePlay);
  
  videoPlayer.addEventListener('play', updatePlayPauseUI);
  videoPlayer.addEventListener('pause', updatePlayPauseUI);
  
  videoPlayer.addEventListener('timeupdate', () => {
    if (!videoPlayer.paused) {
      timelineScrubber.value = videoPlayer.currentTime;
    }
    currentTimeDisplay.textContent = secondsToTimestamp(videoPlayer.currentTime);
    highlightActiveClipRange();
  });

  timelineScrubber.addEventListener('input', () => {
    videoPlayer.currentTime = timelineScrubber.value;
    currentTimeDisplay.textContent = secondsToTimestamp(videoPlayer.currentTime);
  });
}

function togglePlay() {
  if (videoPlayer.paused) {
    videoPlayer.play();
  } else {
    videoPlayer.pause();
  }
}

function updatePlayPauseUI() {
  if (videoPlayer.paused) {
    playIcon.style.display = 'inline';
    pauseIcon.style.display = 'none';
  } else {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'inline';
  }
}

// 3. Clip Data and Cards Generation
function setupSidebarEvents() {
  clipCountInput.addEventListener('change', () => {
    let count = parseInt(clipCountInput.value, 10);
    if (isNaN(count) || count < 1) {
      count = 1;
      clipCountInput.value = 1;
    }
    generateClipsData(count);
  });
}

function generateClipsData(count) {
  const currentCount = clips.length;

  if (count === currentCount) return;

  if (count < currentCount) {
    // Truncate
    clips = clips.slice(0, count);
  } else {
    // Add new default clips
    // If starting fresh, split the video equally
    if (currentCount === 0) {
      const segmentDuration = videoDuration / count;
      for (let i = 0; i < count; i++) {
        const start = i * segmentDuration;
        const end = (i + 1) * segmentDuration;
        clips.push({
          id: i + 1,
          name: `${videoBaseName}_clip_${i + 1}.${videoExt}`,
          startTime: start,
          endTime: end
        });
      }
    } else {
      // Add clips at the end of the video
      const remainingTime = Math.max(0, videoDuration - clips[currentCount - 1].endTime);
      const segmentDuration = remainingTime > 0 ? remainingTime / (count - currentCount) : videoDuration / count;
      
      let baseTime = clips[currentCount - 1].endTime;
      for (let i = currentCount; i < count; i++) {
        const start = Math.min(baseTime, videoDuration);
        const end = Math.min(baseTime + segmentDuration, videoDuration);
        clips.push({
          id: i + 1,
          name: `${videoBaseName}_clip_${i + 1}.${videoExt}`,
          startTime: start,
          endTime: end
        });
        baseTime = end;
      }
    }
  }

  renderClipCards();
  renderTimelineRanges();
}

function renderClipCards() {
  clipsContainer.innerHTML = '';
  
  clips.forEach((clip, index) => {
    const color = CLIP_COLORS[index % CLIP_COLORS.length];
    const card = document.createElement('div');
    card.className = 'clip-card';
    card.style.borderLeftColor = color.border;
    card.setAttribute('data-index', index);

    card.innerHTML = `
      <div class="clip-card-header">
        <span class="clip-number" style="background-color: ${color.border};">Clip ${clip.id}</span>
        <input type="text" class="clip-name-input" value="${clip.name}" placeholder="Clip file name">
      </div>
      <div class="clip-card-body">
        <div class="time-field-group">
          <label>Start Time</label>
          <div class="time-input-wrapper">
            <input type="text" class="time-input start-time-input" value="${secondsToTimestamp(clip.startTime)}">
            <button class="set-time-btn start-set-btn" title="Set to current playback time">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </button>
          </div>
        </div>
        <div class="time-field-group">
          <label>End Time</label>
          <div class="time-input-wrapper">
            <input type="text" class="time-input end-time-input" value="${secondsToTimestamp(clip.endTime)}">
            <button class="set-time-btn end-set-btn" title="Set to current playback time">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="clip-validation-error"></div>
    `;

    // Event Listeners for inputs
    const nameInput = card.querySelector('.clip-name-input');
    const startInput = card.querySelector('.start-time-input');
    const endInput = card.querySelector('.end-time-input');
    const startSetBtn = card.querySelector('.start-set-btn');
    const endSetBtn = card.querySelector('.end-set-btn');
    const errorDiv = card.querySelector('.clip-validation-error');

    nameInput.addEventListener('change', () => {
      clip.name = nameInput.value.trim();
    });

    const updateClipTimes = () => {
      const startStr = startInput.value.trim();
      const endStr = endInput.value.trim();
      
      let startSec = timestampToSeconds(startStr);
      let endSec = timestampToSeconds(endStr);
      
      let hasError = false;
      let errorMsg = '';

      if (startSec === null || !isValidTimestampFormat(startStr)) {
        hasError = true;
        errorMsg = 'Invalid start format.';
        startInput.classList.add('invalid');
      } else {
        startInput.classList.remove('invalid');
      }

      if (endSec === null || !isValidTimestampFormat(endStr)) {
        hasError = true;
        errorMsg = errorMsg || 'Invalid end format.';
        endInput.classList.add('invalid');
      } else {
        endInput.classList.remove('invalid');
      }

      if (!hasError) {
        if (startSec < 0 || startSec > videoDuration) {
          hasError = true;
          errorMsg = 'Start out of bounds.';
          startInput.classList.add('invalid');
        }
        if (endSec < 0 || endSec > videoDuration) {
          hasError = true;
          errorMsg = 'End out of bounds.';
          endInput.classList.add('invalid');
        }
        if (startSec >= endSec) {
          hasError = true;
          errorMsg = 'Start must be before End.';
          startInput.classList.add('invalid');
          endInput.classList.add('invalid');
        }
      }

      if (hasError) {
        errorDiv.textContent = errorMsg;
        errorDiv.style.display = 'block';
      } else {
        errorDiv.style.display = 'none';
        clip.startTime = startSec;
        clip.endTime = endSec;
        renderTimelineRanges();
      }
    };

    startInput.addEventListener('blur', updateClipTimes);
    endInput.addEventListener('blur', updateClipTimes);

    // Set times to current player position
    startSetBtn.addEventListener('click', () => {
      startInput.value = secondsToTimestamp(videoPlayer.currentTime);
      updateClipTimes();
    });

    endSetBtn.addEventListener('click', () => {
      endInput.value = secondsToTimestamp(videoPlayer.currentTime);
      updateClipTimes();
    });

    // Seek player to start time when clicking on card header
    card.querySelector('.clip-card-header').addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        videoPlayer.currentTime = clip.startTime;
        if (videoPlayer.paused) videoPlayer.play();
      }
    });

    clipsContainer.appendChild(card);
  });
}

// 4. Render timeline range indicators
function renderTimelineRanges() {
  // Clear old range markers except scrubber
  const oldRanges = timelineRangesContainer.querySelectorAll('.timeline-range-bar');
  oldRanges.forEach(el => el.remove());

  clips.forEach((clip, index) => {
    const color = CLIP_COLORS[index % CLIP_COLORS.length];
    const leftPct = (clip.startTime / videoDuration) * 100;
    const widthPct = ((clip.endTime - clip.startTime) / videoDuration) * 100;

    const rangeBar = document.createElement('div');
    rangeBar.className = 'timeline-range-bar';
    rangeBar.style.left = `${leftPct}%`;
    rangeBar.style.width = `${widthPct}%`;
    rangeBar.style.backgroundColor = color.bg;
    rangeBar.style.borderColor = color.border;
    rangeBar.setAttribute('data-index', index);

    // Jump player to clip start time on clicking timeline bar
    rangeBar.addEventListener('click', (e) => {
      e.stopPropagation();
      videoPlayer.currentTime = clip.startTime;
      if (videoPlayer.paused) videoPlayer.play();
    });

    timelineRangesContainer.appendChild(rangeBar);
  });
}

// Highlights which clip range is currently under the scrubber playhead
function highlightActiveClipRange() {
  const current = videoPlayer.currentTime;
  const cards = clipsContainer.querySelectorAll('.clip-card');
  const bars = timelineRangesContainer.querySelectorAll('.timeline-range-bar');

  clips.forEach((clip, index) => {
    const isActive = current >= clip.startTime && current <= clip.endTime;
    
    if (isActive) {
      cards[index]?.classList.add('active');
      bars[index]?.classList.add('active');
    } else {
      cards[index]?.classList.remove('active');
      bars[index]?.classList.remove('active');
    }
  });
}

// 5. Video Splitting (Exporting) Implementation
function setupExportEvents() {
  generateBtn.addEventListener('click', async () => {
    // Validate all clips before invoking backend
    const hasErrors = clipsContainer.querySelectorAll('.invalid').length > 0;
    if (hasErrors) {
      alert('Please fix all validation errors before generating clips.');
      return;
    }

    // Prompt user for output directory (Option C)
    const defaultDir = videoPath ? videoPath.substring(0, videoPath.lastIndexOf('/')) : null;
    const dir = await window.electronAPI.selectOutputDirectory(defaultDir);
    if (!dir) {
      // User cancelled directory choice, abort process
      return;
    }
    outputDir = dir;

    // Secondary deep check
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (clip.startTime < 0 || clip.endTime > videoDuration || clip.startTime >= clip.endTime) {
        alert(`Clip ${clip.id} has invalid times. Please fix it.`);
        return;
      }
      if (!clip.name.trim()) {
        alert(`Clip ${clip.id} must have a file name.`);
        return;
      }
    }

    // UI State: Disable generating button
    generateBtn.disabled = true;
    generateBtn.textContent = 'Processing...';

    // Show Progress Overlay
    progressOverlay.style.display = 'flex';
    progressProgressBar.style.width = '0%';
    progressPercentText.textContent = '0%';
    progressStatusText.textContent = 'Starting process...';

    // Listen to progress updates
    const removeProgressListener = window.electronAPI.onSplitProgress((data) => {
      // data format: { index, total, name, status, error }
      const currentProgress = ((data.index) / data.total) * 100;
      
      if (data.status === 'processing') {
        progressStatusText.textContent = `Generating Clip ${data.index + 1} of ${data.total}: "${data.name}"`;
        // Intermediate display
        const partProgress = currentProgress + (0.5 / data.total) * 100;
        progressProgressBar.style.width = `${partProgress}%`;
        progressPercentText.textContent = `${Math.round(partProgress)}%`;
      } else if (data.status === 'done') {
        progressStatusText.textContent = `Finished Clip ${data.index + 1} of ${data.total}!`;
        const doneProgress = ((data.index + 1) / data.total) * 100;
        progressProgressBar.style.width = `${doneProgress}%`;
        progressPercentText.textContent = `${Math.round(doneProgress)}%`;
      } else if (data.status === 'error') {
        progressStatusText.textContent = `Error in "${data.name}": ${data.error}`;
      }
    });

    const accuracy = splitAccuracySelect.value;

    try {
      const result = await window.electronAPI.splitVideo(videoPath, outputDir, accuracy, clips);
      
      removeProgressListener();
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Clips';
      progressOverlay.style.display = 'none';

      if (result.success) {
        // Show Results Dialog
        resultsOverlay.style.display = 'flex';
      } else {
        alert(`Failed to split clips: ${result.message}`);
      }
    } catch (error) {
      removeProgressListener();
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Clips';
      progressOverlay.style.display = 'none';
      alert(`Unexpected error: ${error.message}`);
    }
  });

  openFinderBtn.addEventListener('click', () => {
    window.electronAPI.openDirectory(outputDir);
  });

  closeResultsBtn.addEventListener('click', () => {
    resultsOverlay.style.display = 'none';
  });
}

// 6. Tab Toggling Logic
function setupTabEvents() {
  tabSplit.addEventListener('click', () => {
    tabSplit.classList.add('active');
    tabSpeed.classList.remove('active');
    tabCrop.classList.remove('active');
    panelSplit.classList.add('active');
    panelSpeed.classList.remove('active');
    panelCrop.classList.remove('active');
    cropOverlayContainer.style.display = 'none';
  });

  tabSpeed.addEventListener('click', () => {
    tabSpeed.classList.add('active');
    tabSplit.classList.remove('active');
    tabCrop.classList.remove('active');
    panelSpeed.classList.add('active');
    panelSplit.classList.remove('active');
    panelCrop.classList.remove('active');
    cropOverlayContainer.style.display = 'none';
  });

  tabCrop.addEventListener('click', () => {
    tabCrop.classList.add('active');
    tabSplit.classList.remove('active');
    tabSpeed.classList.remove('active');
    panelCrop.classList.add('active');
    panelSplit.classList.remove('active');
    panelSpeed.classList.remove('active');
    if (videoPath) {
      updateCropOverlayLayout();
    }
  });
}

// 7. Speed Changer Form Logic & Export
function setupSpeedChangerEvents() {
  // Sync slider -> input
  speedSlider.addEventListener('input', () => {
    const val = parseFloat(speedSlider.value);
    speedInput.value = val.toFixed(2);
    speedMultiplier = val;
    highlightPresetButton(val);
    updateSpeedFilenamePreview();
  });

  // Sync input -> slider
  speedInput.addEventListener('change', () => {
    let val = parseFloat(speedInput.value);
    if (isNaN(val) || val <= 0) {
      val = 1.0;
      speedInput.value = '1.00';
    }
    speedMultiplier = val;
    
    // Clamp to slider min/max if possible
    if (val >= 0.25 && val <= 4.0) {
      speedSlider.value = val;
    } else {
      speedSlider.value = 1.0; // Reset slider position if out of bounds
    }
    
    highlightPresetButton(val);
    updateSpeedFilenamePreview();
  });

  // Speed Mode Selector Click Event Listeners
  if (btnSpeedModeConstant && btnSpeedModeRamp) {
    btnSpeedModeConstant.addEventListener('click', () => {
      speedMode = 'constant';
      btnSpeedModeConstant.classList.add('active');
      btnSpeedModeRamp.classList.remove('active');
      updateSpeedFilenamePreview();
    });

    btnSpeedModeRamp.addEventListener('click', () => {
      speedMode = 'ramp';
      btnSpeedModeRamp.classList.add('active');
      btnSpeedModeConstant.classList.remove('active');
      updateSpeedFilenamePreview();
    });
  }

  // Presets buttons click listeners
  const presetBtns = panelSpeed.querySelectorAll('.speed-presets-grid .preset-btn');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseFloat(btn.getAttribute('data-speed'));
      if (isNaN(val)) return;
      speedSlider.value = val;
      speedInput.value = val.toFixed(2);
      speedMultiplier = val;

      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      updateSpeedFilenamePreview();
    });
  });

  // Speed Generate Export
  speedGenerateBtn.addEventListener('click', async () => {
    if (!videoPath) {
      alert('Please load a video first.');
      return;
    }

    if (isNaN(speedMultiplier) || speedMultiplier <= 0) {
      alert('Please enter a valid speed factor greater than 0.');
      return;
    }

    const outputName = speedFilenameInput.value.trim();
    if (!outputName) {
      alert('Please enter an output file name.');
      return;
    }

    // Prompt user for directory (Option C)
    const defaultDir = videoPath ? videoPath.substring(0, videoPath.lastIndexOf('/')) : null;
    const dir = await window.electronAPI.selectOutputDirectory(defaultDir);
    if (!dir) {
      // User cancelled
      return;
    }
    outputDir = dir;

    const outputPath = `${dir}/${outputName}`;

    // UI state
    speedGenerateBtn.disabled = true;
    speedGenerateBtn.textContent = 'Processing...';

    progressOverlay.style.display = 'flex';
    progressProgressBar.style.width = '0%';
    progressPercentText.textContent = '0%';
    progressStatusText.textContent = 'Preparing speed change...';

    const removeProgressListener = window.electronAPI.onSplitProgress((data) => {
      if (data.status === 'processing') {
        progressStatusText.textContent = `Applying speed modifications to "${data.name}"...`;
        progressProgressBar.style.width = '50%';
        progressPercentText.textContent = '50%';
      } else if (data.status === 'done') {
        progressStatusText.textContent = 'Finished speed conversion!';
        progressProgressBar.style.width = '100%';
        progressPercentText.textContent = '100%';
      } else if (data.status === 'error') {
        progressStatusText.textContent = `Error: ${data.error}`;
      }
    });

    try {
      const result = await window.electronAPI.changeVideoSpeed(videoPath, outputPath, speedMultiplier, speedMode, videoDuration);
      removeProgressListener();
      speedGenerateBtn.disabled = false;
      speedGenerateBtn.textContent = 'Apply Speed & Export';
      progressOverlay.style.display = 'none';

      if (result.success) {
        resultsOverlay.style.display = 'flex';
      } else {
        alert(`Failed to speed change video: ${result.message}`);
      }
    } catch (error) {
      removeProgressListener();
      speedGenerateBtn.disabled = false;
      speedGenerateBtn.textContent = 'Apply Speed & Export';
      progressOverlay.style.display = 'none';
      alert(`Unexpected error: ${error.message}`);
    }
  });
}

function highlightPresetButton(val) {
  const presetBtns = panelSpeed.querySelectorAll('.speed-presets-grid .preset-btn');
  presetBtns.forEach(btn => {
    const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
    if (isNaN(btnSpeed)) return;
    if (Math.abs(btnSpeed - val) < 0.01) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function updateSpeedFilenamePreview() {
  if (!speedFilenameInput) return;
  if (!videoBaseName) {
    speedFilenameInput.value = '';
    return;
  }
  const suffix = speedMode === 'ramp' ? '_ramp' : '';
  speedFilenameInput.value = `${videoBaseName}_${speedMultiplier.toFixed(2)}x${suffix}.${videoExt}`;
}

// Cropper UI and Interaction Logics
function setupCropperEvents() {
  // Bind aspect ratio preset buttons
  const presetBtns = panelCrop.querySelectorAll('.preset-btn');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const ratio = btn.getAttribute('data-ratio');
      setAspectRatio(ratio);
    });
  });

  // Bind manual input fields
  const inputs = [cropValX, cropValY, cropValW, cropValH];
  inputs.forEach(input => {
    input.addEventListener('input', handleManualInputChange);
  });

  // Drag listeners
  const dragArea = cropBox.querySelector('.crop-drag-area');
  dragArea.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    dragMode = 'move';
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
    cropBoxStart = { ...cropRect };
  });

  const handles = cropBox.querySelectorAll('.crop-handle');
  handles.forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent drag area from triggering
      isDragging = true;
      dragMode = handle.getAttribute('data-handle');
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;
      cropBoxStart = { ...cropRect };
    });
  });

  // Resize handler on window to update crop overlay layout
  window.addEventListener('resize', () => {
    if (tabCrop.classList.contains('active') && videoPath) {
      updateCropOverlayLayout();
    }
  });

  // Apply Crop and Export button action
  cropGenerateBtn.addEventListener('click', handleCropExport);

  // Document level drag tracking
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const rect = getVideoContentRect();
    if (!rect) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    if (dragMode === 'move') {
      let newLeft = cropBoxStart.left + dx;
      let newTop = cropBoxStart.top + dy;
      
      // Clamp to container bounds
      newLeft = Math.max(0, Math.min(newLeft, rect.width - cropRect.width));
      newTop = Math.max(0, Math.min(newTop, rect.height - cropRect.height));
      
      cropRect.left = newLeft;
      cropRect.top = newTop;
    } else {
      // Resize mode
      const minSize = 20; // visual px minimum
      
      // Aspect ratio R
      let R = null;
      if (currentAspectRatio !== 'free') {
        const [rw, rh] = currentAspectRatio.split(':').map(Number);
        R = rw / rh;
      }
      
      if (dragMode === 'br') {
        let newW = cropBoxStart.width + dx;
        let newH = cropBoxStart.height + dy;
        
        newW = Math.max(minSize, Math.min(newW, rect.width - cropBoxStart.left));
        newH = Math.max(minSize, Math.min(newH, rect.height - cropBoxStart.top));
        
        if (R !== null) {
          newH = newW / R;
          if (cropBoxStart.top + newH > rect.height) {
            newH = rect.height - cropBoxStart.top;
            newW = newH * R;
          }
          if (cropBoxStart.left + newW > rect.width) {
            newW = rect.width - cropBoxStart.left;
            newH = newW / R;
          }
        }
        
        cropRect.width = newW;
        cropRect.height = newH;
      } 
      else if (dragMode === 'tr') {
        let newW = cropBoxStart.width + dx;
        let newH = cropBoxStart.height - dy;
        let newTop = cropBoxStart.top + dy;
        
        newW = Math.max(minSize, Math.min(newW, rect.width - cropBoxStart.left));
        if (newTop < 0) {
          newH = cropBoxStart.top + cropBoxStart.height;
          newTop = 0;
        }
        newH = Math.max(minSize, newH);
        newTop = cropBoxStart.top + cropBoxStart.height - newH;
        
        if (R !== null) {
          newH = newW / R;
          newTop = cropBoxStart.top + cropBoxStart.height - newH;
          if (newTop < 0) {
            newTop = 0;
            newH = cropBoxStart.top + cropBoxStart.height;
            newW = newH * R;
          }
          if (cropBoxStart.left + newW > rect.width) {
            newW = rect.width - cropBoxStart.left;
            newH = newW / R;
            newTop = cropBoxStart.top + cropBoxStart.height - newH;
          }
        }
        
        cropRect.width = newW;
        cropRect.height = newH;
        cropRect.top = newTop;
      }
      else if (dragMode === 'bl') {
        let newW = cropBoxStart.width - dx;
        let newLeft = cropBoxStart.left + dx;
        let newH = cropBoxStart.height + dy;
        
        if (newLeft < 0) {
          newW = cropBoxStart.left + cropBoxStart.width;
          newLeft = 0;
        }
        newW = Math.max(minSize, newW);
        newLeft = cropBoxStart.left + cropBoxStart.width - newW;
        newH = Math.max(minSize, Math.min(newH, rect.height - cropBoxStart.top));
        
        if (R !== null) {
          newH = newW / R;
          if (cropBoxStart.top + newH > rect.height) {
            newH = rect.height - cropBoxStart.top;
            newW = newH * R;
            newLeft = cropBoxStart.left + cropBoxStart.width - newW;
          }
          if (newLeft < 0) {
            newLeft = 0;
            newW = cropBoxStart.left + cropBoxStart.width;
            newH = newW / R;
          }
        }
        
        cropRect.width = newW;
        cropRect.left = newLeft;
        cropRect.height = newH;
      }
      else if (dragMode === 'tl') {
        let newW = cropBoxStart.width - dx;
        let newLeft = cropBoxStart.left + dx;
        let newH = cropBoxStart.height - dy;
        let newTop = cropBoxStart.top + dy;
        
        if (newLeft < 0) {
          newW = cropBoxStart.left + cropBoxStart.width;
          newLeft = 0;
        }
        newW = Math.max(minSize, newW);
        newLeft = cropBoxStart.left + cropBoxStart.width - newW;
        
        if (newTop < 0) {
          newH = cropBoxStart.top + cropBoxStart.height;
          newTop = 0;
        }
        newH = Math.max(minSize, newH);
        newTop = cropBoxStart.top + cropBoxStart.height - newH;
        
        if (R !== null) {
          newH = newW / R;
          newTop = cropBoxStart.top + cropBoxStart.height - newH;
          
          if (newTop < 0) {
            newTop = 0;
            newH = cropBoxStart.top + cropBoxStart.height;
            newW = newH * R;
            newLeft = cropBoxStart.left + cropBoxStart.width - newW;
          }
          if (newLeft < 0) {
            newLeft = 0;
            newW = cropBoxStart.left + cropBoxStart.width;
            newH = newW / R;
            newTop = cropBoxStart.top + cropBoxStart.height - newH;
          }
        }
        
        cropRect.width = newW;
        cropRect.left = newLeft;
        cropRect.height = newH;
        cropRect.top = newTop;
      }
    }
    
    // Update normalized coordinates
    cropNormalized.x = cropRect.left / rect.width;
    cropNormalized.y = cropRect.top / rect.height;
    cropNormalized.w = cropRect.width / rect.width;
    cropNormalized.h = cropRect.height / rect.height;
    
    drawCropBoxAndMasks();
    updateManualInputFields();
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    dragMode = null;
  });
}

function getVideoContentRect() {
  if (!videoPlayer || !videoPlayer.videoWidth || !videoPlayer.videoHeight) {
    return null;
  }
  
  const videoRatio = videoPlayer.videoWidth / videoPlayer.videoHeight;
  const containerWidth = videoPlayer.clientWidth;
  const containerHeight = videoPlayer.clientHeight;
  const containerRatio = containerWidth / containerHeight;
  
  let displayWidth, displayHeight;
  let left, top;
  
  if (containerRatio > videoRatio) {
    // Pillarboxed
    displayHeight = containerHeight;
    displayWidth = displayHeight * videoRatio;
    left = (containerWidth - displayWidth) / 2;
    top = 0;
  } else {
    // Letterboxed
    displayWidth = containerWidth;
    displayHeight = displayWidth / videoRatio;
    left = 0;
    top = (containerHeight - displayHeight) / 2;
  }
  
  return {
    left: left,
    top: top,
    width: displayWidth,
    height: displayHeight
  };
}

function updateCropOverlayLayout() {
  const rect = getVideoContentRect();
  if (!rect) {
    cropOverlayContainer.style.display = 'none';
    return;
  }
  
  if (tabCrop.classList.contains('active')) {
    cropOverlayContainer.style.display = 'block';
  } else {
    cropOverlayContainer.style.display = 'none';
    return;
  }
  
  cropOverlayContainer.style.left = `${rect.left}px`;
  cropOverlayContainer.style.top = `${rect.top}px`;
  cropOverlayContainer.style.width = `${rect.width}px`;
  cropOverlayContainer.style.height = `${rect.height}px`;
  
  // Sync the visual crop box from normalized coordinates
  cropRect.left = cropNormalized.x * rect.width;
  cropRect.top = cropNormalized.y * rect.height;
  cropRect.width = cropNormalized.w * rect.width;
  cropRect.height = cropNormalized.h * rect.height;
  
  drawCropBoxAndMasks();
  updateManualInputFields();
}

function drawCropBoxAndMasks() {
  const rect = getVideoContentRect();
  if (!rect) return;
  
  cropBox.style.left = `${cropRect.left}px`;
  cropBox.style.top = `${cropRect.top}px`;
  cropBox.style.width = `${cropRect.width}px`;
  cropBox.style.height = `${cropRect.height}px`;
  
  const x = cropRect.left;
  const y = cropRect.top;
  const w = cropRect.width;
  const h = cropRect.height;
  
  maskTop.style.left = '0px';
  maskTop.style.top = '0px';
  maskTop.style.width = `${rect.width}px`;
  maskTop.style.height = `${y}px`;
  
  maskBottom.style.left = '0px';
  maskBottom.style.top = `${y + h}px`;
  maskBottom.style.width = `${rect.width}px`;
  maskBottom.style.height = `${Math.max(0, rect.height - (y + h))}px`;
  
  maskLeft.style.left = '0px';
  maskLeft.style.top = `${y}px`;
  maskLeft.style.width = `${x}px`;
  maskLeft.style.height = `${h}px`;
  
  maskRight.style.left = `${x + w}px`;
  maskRight.style.top = `${y}px`;
  maskRight.style.width = `${Math.max(0, rect.width - (x + w))}px`;
  maskRight.style.height = `${h}px`;
}

function updateManualInputFields() {
  if (!videoPlayer || !videoPlayer.videoWidth || !videoPlayer.videoHeight) return;
  
  const rect = getVideoContentRect();
  if (!rect) return;
  
  const native = mapCropToNative(cropRect, rect, videoPlayer.videoWidth, videoPlayer.videoHeight);
  
  if (document.activeElement !== cropValX) cropValX.value = native.x;
  if (document.activeElement !== cropValY) cropValY.value = native.y;
  if (document.activeElement !== cropValW) cropValW.value = native.width;
  if (document.activeElement !== cropValH) cropValH.value = native.height;
}

function handleManualInputChange() {
  if (!videoPlayer || !videoPlayer.videoWidth || !videoPlayer.videoHeight) return;
  
  const rect = getVideoContentRect();
  if (!rect) return;
  
  let nx = parseInt(cropValX.value, 10) || 0;
  let ny = parseInt(cropValY.value, 10) || 0;
  let nw = parseInt(cropValW.value, 10) || 100;
  let nh = parseInt(cropValH.value, 10) || 100;
  
  const nativeW = videoPlayer.videoWidth;
  const nativeH = videoPlayer.videoHeight;
  
  nx = Math.max(0, Math.min(nx, nativeW - 1));
  ny = Math.max(0, Math.min(ny, nativeH - 1));
  nw = Math.max(1, Math.min(nw, nativeW - nx));
  nh = Math.max(1, Math.min(nh, nativeH - ny));
  
  if (currentAspectRatio !== 'free') {
    const [rw, rh] = currentAspectRatio.split(':').map(Number);
    const R = rw / rh;
    
    nh = Math.round(nw / R);
    if (ny + nh > nativeH) {
      nh = nativeH - ny;
      nw = Math.round(nh * R);
    }
  }
  
  const scaleX = rect.width / nativeW;
  const scaleY = rect.height / nativeH;
  
  cropRect.left = nx * scaleX;
  cropRect.top = ny * scaleY;
  cropRect.width = nw * scaleX;
  cropRect.height = nh * scaleY;
  
  cropNormalized.x = cropRect.left / rect.width;
  cropNormalized.y = cropRect.top / rect.height;
  cropNormalized.w = cropRect.width / rect.width;
  cropNormalized.h = cropRect.height / rect.height;
  
  drawCropBoxAndMasks();
  
  cropValX.value = nx;
  cropValY.value = ny;
  cropValW.value = nw;
  cropValH.value = nh;
}

function setAspectRatio(ratioStr) {
  currentAspectRatio = ratioStr;
  
  const presetBtns = panelCrop.querySelectorAll('.preset-btn');
  presetBtns.forEach(btn => {
    if (btn.getAttribute('data-ratio') === ratioStr) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  if (ratioStr === 'free') {
    return;
  }
  
  const [rw, rh] = ratioStr.split(':').map(Number);
  const R = rw / rh;
  
  const rect = getVideoContentRect();
  if (!rect) return;
  
  let newW, newH;
  if (rect.width / rect.height > R) {
    newH = rect.height * 0.8;
    newW = newH * R;
  } else {
    newW = rect.width * 0.8;
    newH = newW / R;
  }
  
  cropRect.left = (rect.width - newW) / 2;
  cropRect.top = (rect.height - newH) / 2;
  cropRect.width = newW;
  cropRect.height = newH;
  
  cropNormalized.x = cropRect.left / rect.width;
  cropNormalized.y = cropRect.top / rect.height;
  cropNormalized.w = cropRect.width / rect.width;
  cropNormalized.h = cropRect.height / rect.height;
  
  drawCropBoxAndMasks();
  updateManualInputFields();
}

async function handleCropExport() {
  if (!videoPath) {
    alert('Please load a video first.');
    return;
  }

  const outputName = cropFilenameInput.value.trim();
  if (!outputName) {
    alert('Please enter an output file name.');
    return;
  }

  const rect = getVideoContentRect();
  if (!rect) {
    alert('Cannot retrieve video player coordinates.');
    return;
  }

  const native = mapCropToNative(cropRect, rect, videoPlayer.videoWidth, videoPlayer.videoHeight);

  if (native.width <= 0 || native.height <= 0) {
    alert('Invalid crop region size.');
    return;
  }

  const defaultDir = videoPath ? videoPath.substring(0, videoPath.lastIndexOf('/')) : null;
  const dir = await window.electronAPI.selectOutputDirectory(defaultDir);
  if (!dir) {
    return;
  }
  outputDir = dir;

  const outputPath = `${dir}/${outputName}`;

  cropGenerateBtn.disabled = true;
  cropGenerateBtn.textContent = 'Processing...';

  progressOverlay.style.display = 'flex';
  progressProgressBar.style.width = '0%';
  progressPercentText.textContent = '0%';
  progressStatusText.textContent = 'Preparing crop...';

  const removeProgressListener = window.electronAPI.onSplitProgress((data) => {
    if (data.status === 'processing') {
      progressStatusText.textContent = `Applying crop filters to "${data.name}"...`;
      progressProgressBar.style.width = '50%';
      progressPercentText.textContent = '50%';
    } else if (data.status === 'done') {
      progressStatusText.textContent = 'Finished crop conversion!';
      progressProgressBar.style.width = '100%';
      progressPercentText.textContent = '100%';
    } else if (data.status === 'error') {
      progressStatusText.textContent = `Error: ${data.error}`;
    }
  });

  try {
    const result = await window.electronAPI.cropVideo(
      videoPath,
      outputPath,
      native.x,
      native.y,
      native.width,
      native.height
    );
    
    removeProgressListener();
    cropGenerateBtn.disabled = false;
    cropGenerateBtn.textContent = 'Apply Crop & Export';
    progressOverlay.style.display = 'none';

    if (result.success) {
      resultsOverlay.style.display = 'flex';
    } else {
      alert(`Failed to crop video: ${result.message}`);
    }
  } catch (error) {
    removeProgressListener();
    cropGenerateBtn.disabled = false;
    cropGenerateBtn.textContent = 'Apply Crop & Export';
    progressOverlay.style.display = 'none';
    alert(`Unexpected error: ${error.message}`);
  }
}

function updateCropFilenamePreview() {
  if (!cropFilenameInput) return;
  if (!videoBaseName) {
    cropFilenameInput.value = '';
    return;
  }
  cropFilenameInput.value = `${videoBaseName}_cropped.${videoExt}`;
}

// Preference Settings Handlers
function loadSettings() {
  try {
    const saved = localStorage.getItem('media-editor-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      settings = { ...settings, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings from localStorage:', e);
  }
  
  if (splitAccuracySelect) {
    splitAccuracySelect.value = settings.defaultAccuracy;
  }
}

function saveSettings() {
  try {
    localStorage.setItem('media-editor-settings', JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings to localStorage:', e);
  }
}

function updateSettingsUI() {
  settingsDirPath.textContent = settings.defaultExportDir || 'No default directory selected';
  settingsAlwaysPrompt.checked = settings.alwaysPrompt;
  settingsDefaultAccuracy.value = settings.defaultAccuracy;
}

function setupSettingsEvents() {
  if (!btnSettings) return;

  btnSettings.addEventListener('click', () => {
    updateSettingsUI();
    settingsModal.style.display = 'flex';
  });

  settingsBrowseBtn.addEventListener('click', async () => {
    const dir = await window.electronAPI.selectOutputDirectory(settings.defaultExportDir);
    if (dir) {
      settings.defaultExportDir = dir;
      settingsDirPath.textContent = dir;
    }
  });

  settingsSaveBtn.addEventListener('click', () => {
    settings.alwaysPrompt = settingsAlwaysPrompt.checked;
    settings.defaultAccuracy = settingsDefaultAccuracy.value;
    saveSettings();
    
    if (splitAccuracySelect) {
      splitAccuracySelect.value = settings.defaultAccuracy;
    }
    
    settingsModal.style.display = 'none';
  });

  settingsCancelBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });
}
