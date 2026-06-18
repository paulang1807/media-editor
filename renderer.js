// Access helpers from global window object
const { secondsToTimestamp, timestampToSeconds, isValidTimestampFormat, getAudioSpeedFilter, mapCropToNative, getRotatedCanvasDimensions, getPrintDimensions, applyEnhancementFilters } = window.helpers;

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
let isReversing = false;
let lastTime = 0;

// Delogo State
let delogoRect = { left: 0, top: 0, width: 0, height: 0 };
let delogoNormalized = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
let delogoIsDragging = false;
let delogoDragStart = { x: 0, y: 0 };
let delogoDragMode = null; // 'move', 'tl', 'tr', 'bl', 'br'
let delogoBoxStart = { left: 0, top: 0, width: 0, height: 0 };

// Cropper State
let cropRect = { left: 0, top: 0, width: 0, height: 0 };
let cropNormalized = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
let currentAspectRatio = 'free'; // 'free', '1:1', '16:9', '9:16', '4:3'
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragMode = null; // 'move', 'tl', 'tr', 'bl', 'br'
let cropBoxStart = { left: 0, top: 0, width: 0, height: 0 };

// Image Editor State
let imagePath = null;
let imageName = null;
let imageBaseName = '';
let imageExt = 'png';
let imageSize = 0;
let imageObj = null; // HTML Image Object
let imageRotation = 0; // Rotation angle in degrees (0 - 359)
let imageFlipH = false; // Horizontal flip state
let imageFlipV = false; // Vertical flip state

// Image Enhancer & Sizing Preset State
let imageEnhanceAutoContrast = false;
let imageEnhanceColorBoost = 0; // 0 to 100
let imageEnhanceSharpen = 0; // 0 to 100
let imageEnhanceDenoise = 0; // 0 to 100
let imagePrintPreset = 'original';
let imagePrintOrientation = 'portrait'; // 'portrait' or 'landscape'

// Image Cropper State
let imageCropEnabled = false;
let imageCropRect = { left: 0, top: 0, width: 0, height: 0 }; // relative to display canvas size
let imageCropNormalized = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }; // relative to bounding box
let imageAspectRatio = 'free'; // 'free', '1:1', '16:9'
let imageIsDragging = false;
let imageDragStart = { x: 0, y: 0 };
let imageDragMode = null; // 'move', 'tl', 'tr', 'bl', 'br'
let imageCropBoxStart = { left: 0, top: 0, width: 0, height: 0 };
let isRotatingWithHandle = false;
let rotationStartAngle = 0;
let rotationStartMouseAngle = 0;

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
const tabReverse = document.getElementById('tab-reverse');
const panelSplit = document.getElementById('panel-split');
const panelSpeed = document.getElementById('panel-speed');
const panelCrop = document.getElementById('panel-crop');
const panelReverse = document.getElementById('panel-reverse');

// Reverse Changer Elements
const reverseAudioToggle = document.getElementById('reverse-audio-toggle');
const reverseFilenameInput = document.getElementById('reverse-filename-input');
const reverseGenerateBtn = document.getElementById('reverse-generate-btn');
const playReverseBtn = document.getElementById('play-reverse-btn');

// Delogo Elements
const tabDelogo = document.getElementById('tab-delogo');
const panelDelogo = document.getElementById('panel-delogo');
const delogoOverlayContainer = document.getElementById('delogo-overlay-container');
const delogoBox = document.getElementById('delogo-box');
const delogoValX = document.getElementById('delogo-val-x');
const delogoValY = document.getElementById('delogo-val-y');
const delogoValW = document.getElementById('delogo-val-w');
const delogoValH = document.getElementById('delogo-val-h');
const delogoStyleSelect = document.getElementById('delogo-style-select');
const delogoFilenameInput = document.getElementById('delogo-filename-input');
const delogoGenerateBtn = document.getElementById('delogo-generate-btn');

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
  setupMainSections();
  setupFileImportEvents();
  setupPlayerEvents();
  setupSidebarEvents();
  setupExportEvents();
  setupTabEvents();
  setupSpeedChangerEvents();
  setupCropperEvents();
  setupReverseEvents();
  setupDelogoEvents();
  setupSettingsEvents();
  setupImageEditor();
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

  // Reset reversing settings
  stopReversePlayback();
  updateReverseFilenamePreview();

  // Reset delogo settings
  delogoNormalized = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  updateDelogoFilenamePreview();

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
  
  videoPlayer.addEventListener('play', () => {
    stopReversePlayback();
    updatePlayPauseUI();
  });
  videoPlayer.addEventListener('pause', () => {
    updatePlayPauseUI();
  });
  
  videoPlayer.addEventListener('timeupdate', () => {
    if (!videoPlayer.paused || isReversing) {
      timelineScrubber.value = videoPlayer.currentTime;
    }
    currentTimeDisplay.textContent = secondsToTimestamp(videoPlayer.currentTime);
    highlightActiveClipRange();
  });

  timelineScrubber.addEventListener('input', () => {
    if (isReversing) {
      lastTime = performance.now();
    }
    videoPlayer.currentTime = timelineScrubber.value;
    currentTimeDisplay.textContent = secondsToTimestamp(videoPlayer.currentTime);
  });
}

function togglePlay() {
  if (isReversing) {
    stopReversePlayback();
    return;
  }
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
        showSuccessModal('Export Complete!', 'All clips have been successfully split and exported.');
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
    tabReverse.classList.remove('active');
    tabDelogo.classList.remove('active');
    panelSplit.classList.add('active');
    panelSpeed.classList.remove('active');
    panelCrop.classList.remove('active');
    panelReverse.classList.remove('active');
    panelDelogo.classList.remove('active');
    cropOverlayContainer.style.display = 'none';
    delogoOverlayContainer.style.display = 'none';
  });

  tabSpeed.addEventListener('click', () => {
    tabSpeed.classList.add('active');
    tabSplit.classList.remove('active');
    tabCrop.classList.remove('active');
    tabReverse.classList.remove('active');
    tabDelogo.classList.remove('active');
    panelSpeed.classList.add('active');
    panelSplit.classList.remove('active');
    panelCrop.classList.remove('active');
    panelReverse.classList.remove('active');
    panelDelogo.classList.remove('active');
    cropOverlayContainer.style.display = 'none';
    delogoOverlayContainer.style.display = 'none';
  });

  tabCrop.addEventListener('click', () => {
    tabCrop.classList.add('active');
    tabSplit.classList.remove('active');
    tabSpeed.classList.remove('active');
    tabReverse.classList.remove('active');
    tabDelogo.classList.remove('active');
    panelCrop.classList.add('active');
    panelSplit.classList.remove('active');
    panelSpeed.classList.remove('active');
    panelReverse.classList.remove('active');
    panelDelogo.classList.remove('active');
    delogoOverlayContainer.style.display = 'none';
    if (videoPath) {
      updateCropOverlayLayout();
    }
  });

  tabReverse.addEventListener('click', () => {
    tabReverse.classList.add('active');
    tabSplit.classList.remove('active');
    tabSpeed.classList.remove('active');
    tabCrop.classList.remove('active');
    tabDelogo.classList.remove('active');
    panelReverse.classList.add('active');
    panelSplit.classList.remove('active');
    panelSpeed.classList.remove('active');
    panelCrop.classList.remove('active');
    panelDelogo.classList.remove('active');
    cropOverlayContainer.style.display = 'none';
    delogoOverlayContainer.style.display = 'none';
  });

  tabDelogo.addEventListener('click', () => {
    tabDelogo.classList.add('active');
    tabSplit.classList.remove('active');
    tabSpeed.classList.remove('active');
    tabCrop.classList.remove('active');
    tabReverse.classList.remove('active');
    panelDelogo.classList.add('active');
    panelSplit.classList.remove('active');
    panelSpeed.classList.remove('active');
    panelCrop.classList.remove('active');
    panelReverse.classList.remove('active');
    cropOverlayContainer.style.display = 'none';
    if (videoPath) {
      updateDelogoOverlayLayout();
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
        showSuccessModal('Speed Change Complete!', 'The video speed modifications have been successfully applied and exported.');
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
    if (tabDelogo.classList.contains('active') && videoPath) {
      updateDelogoOverlayLayout();
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
      showSuccessModal('Cropping Complete!', 'The video crop has been successfully applied and exported.');
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

// 8. Video Reverse Logic & Export
function setupReverseEvents() {
  if (playReverseBtn) {
    playReverseBtn.addEventListener('click', () => {
      if (!videoPath) return;
      if (isReversing) {
        stopReversePlayback();
      } else {
        startReversePlayback();
      }
    });
  }

  if (reverseGenerateBtn) {
    reverseGenerateBtn.addEventListener('click', async () => {
      if (!videoPath) {
        alert('Please load a video first.');
        return;
      }

      const outputName = reverseFilenameInput.value.trim();
      if (!outputName) {
        alert('Please enter an output file name.');
        return;
      }

      const reverseAudio = reverseAudioToggle.checked;

      // Prompt user for directory
      const defaultDir = videoPath ? videoPath.substring(0, videoPath.lastIndexOf('/')) : null;
      const dir = await window.electronAPI.selectOutputDirectory(defaultDir);
      if (!dir) {
        return;
      }
      outputDir = dir;

      const outputPath = `${dir}/${outputName}`;

      // UI state
      reverseGenerateBtn.disabled = true;
      reverseGenerateBtn.textContent = 'Processing...';

      progressOverlay.style.display = 'flex';
      progressProgressBar.style.width = '0%';
      progressPercentText.textContent = '0%';
      progressStatusText.textContent = 'Preparing video reverse...';

      const removeProgressListener = window.electronAPI.onSplitProgress((data) => {
        if (data.status === 'processing') {
          progressStatusText.textContent = `Applying reverse modifications to "${data.name}"...`;
          progressProgressBar.style.width = '50%';
          progressPercentText.textContent = '50%';
        } else if (data.status === 'done') {
          progressStatusText.textContent = 'Finished reverse conversion!';
          progressProgressBar.style.width = '100%';
          progressPercentText.textContent = '100%';
        } else if (data.status === 'error') {
          progressStatusText.textContent = `Error: ${data.error}`;
        }
      });

      try {
        const result = await window.electronAPI.reverseVideo(videoPath, outputPath, reverseAudio);
        removeProgressListener();
        reverseGenerateBtn.disabled = false;
        reverseGenerateBtn.textContent = 'Reverse & Export';
        progressOverlay.style.display = 'none';

        if (result.success) {
          showSuccessModal('Reversing Complete!', 'The video has been successfully reversed and exported.');
        } else {
          alert(`Failed to reverse video: ${result.message}`);
        }
      } catch (error) {
        removeProgressListener();
        reverseGenerateBtn.disabled = false;
        reverseGenerateBtn.textContent = 'Reverse & Export';
        progressOverlay.style.display = 'none';
        alert(`Unexpected error: ${error.message}`);
      }
    });
  }
}

function updateReverseFilenamePreview() {
  if (!reverseFilenameInput) return;
  if (!videoBaseName) {
    reverseFilenameInput.value = '';
    return;
  }
  reverseFilenameInput.value = `${videoBaseName}_reversed.${videoExt}`;
}

function startReversePlayback() {
  if (isReversing) return;
  
  // Pause normal forward playback
  videoPlayer.pause();
  
  // If at the beginning, jump to end
  if (videoPlayer.currentTime <= 0.05) {
    videoPlayer.currentTime = videoDuration;
  }
  
  isReversing = true;
  if (playReverseBtn) {
    playReverseBtn.classList.add('active');
  }
  
  lastTime = performance.now();
  
  function reverseStep() {
    if (!isReversing) return;
    
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    
    const rate = videoPlayer.playbackRate > 0 ? videoPlayer.playbackRate : 1.0;
    let newTime = videoPlayer.currentTime - dt * rate;
    
    if (newTime <= 0) {
      newTime = 0;
      videoPlayer.currentTime = 0;
      stopReversePlayback();
      return;
    }
    
    videoPlayer.currentTime = newTime;
    requestAnimationFrame(reverseStep);
  }
  
  requestAnimationFrame(reverseStep);
}

function stopReversePlayback() {
  if (!isReversing) return;
  isReversing = false;
  if (playReverseBtn) {
    playReverseBtn.classList.remove('active');
  }
}

// 9. Video Delogo (Erase Overlay) Logic & Export
function setupDelogoEvents() {
  // Bind manual input fields
  const inputs = [delogoValX, delogoValY, delogoValW, delogoValH];
  inputs.forEach(input => {
    input.addEventListener('input', handleDelogoManualInputChange);
  });

  // Drag listeners
  const dragArea = delogoBox.querySelector('.crop-drag-area');
  dragArea.addEventListener('mousedown', (e) => {
    e.preventDefault();
    delogoIsDragging = true;
    delogoDragMode = 'move';
    delogoDragStart.x = e.clientX;
    delogoDragStart.y = e.clientY;
    delogoBoxStart = { ...delogoRect };
  });

  const handles = delogoBox.querySelectorAll('.crop-handle');
  handles.forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent drag area from triggering
      delogoIsDragging = true;
      delogoDragMode = handle.getAttribute('data-handle');
      delogoDragStart.x = e.clientX;
      delogoDragStart.y = e.clientY;
      delogoBoxStart = { ...delogoRect };
    });
  });

  // Document level drag tracking
  document.addEventListener('mousemove', (e) => {
    if (!delogoIsDragging) return;
    
    const rect = getVideoContentRect();
    if (!rect) return;
    
    const dx = e.clientX - delogoDragStart.x;
    const dy = e.clientY - delogoDragStart.y;
    
    if (delogoDragMode === 'move') {
      let newLeft = delogoBoxStart.left + dx;
      let newTop = delogoBoxStart.top + dy;
      
      // Clamp to container bounds
      newLeft = Math.max(0, Math.min(newLeft, rect.width - delogoRect.width));
      newTop = Math.max(0, Math.min(newTop, rect.height - delogoRect.height));
      
      delogoRect.left = newLeft;
      delogoRect.top = newTop;
    } else {
      // Resize mode
      const minSize = 20; // visual px minimum
      
      if (delogoDragMode === 'br') {
        let newW = delogoBoxStart.width + dx;
        let newH = delogoBoxStart.height + dy;
        
        newW = Math.max(minSize, Math.min(newW, rect.width - delogoBoxStart.left));
        newH = Math.max(minSize, Math.min(newH, rect.height - delogoBoxStart.top));
        
        delogoRect.width = newW;
        delogoRect.height = newH;
      } 
      else if (delogoDragMode === 'tr') {
        let newW = delogoBoxStart.width + dx;
        let newH = delogoBoxStart.height - dy;
        let newTop = delogoBoxStart.top + dy;
        
        newW = Math.max(minSize, Math.min(newW, rect.width - delogoBoxStart.left));
        if (newTop < 0) {
          newH = delogoBoxStart.top + delogoBoxStart.height;
          newTop = 0;
        }
        newH = Math.max(minSize, newH);
        newTop = delogoBoxStart.top + delogoBoxStart.height - newH;
        
        delogoRect.width = newW;
        delogoRect.height = newH;
        delogoRect.top = newTop;
      }
      else if (delogoDragMode === 'bl') {
        let newW = delogoBoxStart.width - dx;
        let newLeft = delogoBoxStart.left + dx;
        let newH = delogoBoxStart.height + dy;
        
        if (newLeft < 0) {
          newW = delogoBoxStart.left + delogoBoxStart.width;
          newLeft = 0;
        }
        newW = Math.max(minSize, newW);
        newLeft = delogoBoxStart.left + delogoBoxStart.width - newW;
        newH = Math.max(minSize, Math.min(newH, rect.height - delogoBoxStart.top));
        
        delogoRect.width = newW;
        delogoRect.left = newLeft;
        delogoRect.height = newH;
      }
      else if (delogoDragMode === 'tl') {
        let newW = delogoBoxStart.width - dx;
        let newLeft = delogoBoxStart.left + dx;
        let newH = delogoBoxStart.height - dy;
        let newTop = delogoBoxStart.top + dy;
        
        if (newLeft < 0) {
          newW = delogoBoxStart.left + delogoBoxStart.width;
          newLeft = 0;
        }
        newW = Math.max(minSize, newW);
        newLeft = delogoBoxStart.left + delogoBoxStart.width - newW;
        
        if (newTop < 0) {
          newH = delogoBoxStart.top + delogoBoxStart.height;
          newTop = 0;
        }
        newH = Math.max(minSize, newH);
        newTop = delogoBoxStart.top + delogoBoxStart.height - newH;
        
        delogoRect.width = newW;
        delogoRect.left = newLeft;
        delogoRect.height = newH;
        delogoRect.top = newTop;
      }
    }
    
    // Update normalized coordinates
    delogoNormalized.x = delogoRect.left / rect.width;
    delogoNormalized.y = delogoRect.top / rect.height;
    delogoNormalized.w = delogoRect.width / rect.width;
    delogoNormalized.h = delogoRect.height / rect.height;
    
    drawDelogoBoxAndMasks();
    updateDelogoManualInputFields();
  });

  document.addEventListener('mouseup', () => {
    delogoIsDragging = false;
    delogoDragMode = null;
  });

  // Apply delogo Export
  delogoGenerateBtn.addEventListener('click', async () => {
    if (!videoPath) {
      alert('Please load a video first.');
      return;
    }

    const outputName = delogoFilenameInput.value.trim();
    if (!outputName) {
      alert('Please enter an output file name.');
      return;
    }

    const rect = getVideoContentRect();
    if (!rect) return;

    // Use mapCropToNative to project screen coords to native video dimensions
    const native = mapCropToNative(
      delogoRect,
      rect,
      videoPlayer.videoWidth,
      videoPlayer.videoHeight
    );

    // Prompt user for directory
    const defaultDir = videoPath ? videoPath.substring(0, videoPath.lastIndexOf('/')) : null;
    const dir = await window.electronAPI.selectOutputDirectory(defaultDir);
    if (!dir) {
      return;
    }
    outputDir = dir;

    const outputPath = `${dir}/${outputName}`;

    // UI state
    delogoGenerateBtn.disabled = true;
    delogoGenerateBtn.textContent = 'Processing...';

    progressOverlay.style.display = 'flex';
    progressProgressBar.style.width = '0%';
    progressPercentText.textContent = '0%';
    progressStatusText.textContent = 'Preparing overlay removal...';

    const removeProgressListener = window.electronAPI.onSplitProgress((data) => {
      if (data.status === 'processing') {
        progressStatusText.textContent = `Removing text overlay from "${data.name}"...`;
        progressProgressBar.style.width = '50%';
        progressPercentText.textContent = '50%';
      } else if (data.status === 'done') {
        progressStatusText.textContent = 'Finished overlay removal!';
        progressProgressBar.style.width = '100%';
        progressPercentText.textContent = '100%';
      } else if (data.status === 'error') {
        progressStatusText.textContent = `Error: ${data.error}`;
      }
    });

    try {
      const style = delogoStyleSelect.value;
      const result = await window.electronAPI.eraseVideo(
        videoPath,
        outputPath,
        style,
        native.x,
        native.y,
        native.width,
        native.height
      );
      removeProgressListener();
      delogoGenerateBtn.disabled = false;
      delogoGenerateBtn.textContent = 'Apply Erase & Export';
      progressOverlay.style.display = 'none';

      if (result.success) {
        showSuccessModal('Overlay Removal Complete!', 'The text overlay has been successfully removed and exported.');
      } else {
        alert(`Failed to remove overlay: ${result.message}`);
      }
    } catch (error) {
      removeProgressListener();
      delogoGenerateBtn.disabled = false;
      delogoGenerateBtn.textContent = 'Apply Erase & Export';
      progressOverlay.style.display = 'none';
      alert(`Unexpected error: ${error.message}`);
    }
  });
}

function updateDelogoOverlayLayout() {
  if (!videoPath || !delogoOverlayContainer) return;
  
  const rect = getVideoContentRect();
  if (!rect) {
    delogoOverlayContainer.style.display = 'none';
    return;
  }
  
  delogoOverlayContainer.style.display = 'block';
  delogoOverlayContainer.style.left = `${rect.left}px`;
  delogoOverlayContainer.style.top = `${rect.top}px`;
  delogoOverlayContainer.style.width = `${rect.width}px`;
  delogoOverlayContainer.style.height = `${rect.height}px`;
  
  // Set delogoRect in screen pixels based on normalized bounds
  delogoRect.left = delogoNormalized.x * rect.width;
  delogoRect.top = delogoNormalized.y * rect.height;
  delogoRect.width = delogoNormalized.w * rect.width;
  delogoRect.height = delogoNormalized.h * rect.height;
  
  drawDelogoBoxAndMasks();
  updateDelogoManualInputFields();
}

function drawDelogoBoxAndMasks() {
  if (!videoPath || !delogoBox) return;
  
  // Size the main box
  delogoBox.style.left = `${delogoRect.left}px`;
  delogoBox.style.top = `${delogoRect.top}px`;
  delogoBox.style.width = `${delogoRect.width}px`;
  delogoBox.style.height = `${delogoRect.height}px`;
  
  const rect = getVideoContentRect();
  if (!rect) return;
  
  // Update masks
  const maskT = document.getElementById('delogo-mask-top');
  const maskB = document.getElementById('delogo-mask-bottom');
  const maskL = document.getElementById('delogo-mask-left');
  const maskR = document.getElementById('delogo-mask-right');
  
  if (maskT) {
    maskT.style.left = '0px';
    maskT.style.top = '0px';
    maskT.style.width = '100%';
    maskT.style.height = `${delogoRect.top}px`;
  }
  if (maskB) {
    maskB.style.left = '0px';
    maskB.style.top = `${delogoRect.top + delogoRect.height}px`;
    maskB.style.width = '100%';
    maskB.style.height = `${rect.height - (delogoRect.top + delogoRect.height)}px`;
  }
  if (maskL) {
    maskL.style.left = '0px';
    maskL.style.top = `${delogoRect.top}px`;
    maskL.style.width = `${delogoRect.left}px`;
    maskL.style.height = `${delogoRect.height}px`;
  }
  if (maskR) {
    maskR.style.left = `${delogoRect.left + delogoRect.width}px`;
    maskR.style.top = `${delogoRect.top}px`;
    maskR.style.width = `${rect.width - (delogoRect.left + delogoRect.width)}px`;
    maskR.style.height = `${delogoRect.height}px`;
  }
}

function updateDelogoManualInputFields() {
  if (!videoPath) return;
  const rect = getVideoContentRect();
  if (!rect) return;
  
  // Map display pixels to native video pixels
  const native = mapCropToNative(
    delogoRect,
    rect,
    videoPlayer.videoWidth,
    videoPlayer.videoHeight
  );
  
  if (delogoValX) delogoValX.value = native.x;
  if (delogoValY) delogoValY.value = native.y;
  if (delogoValW) delogoValW.value = native.width;
  if (delogoValH) delogoValH.value = native.height;
}

function handleDelogoManualInputChange() {
  if (!videoPath) return;
  const rect = getVideoContentRect();
  if (!rect) return;
  
  const valX = parseInt(delogoValX.value, 10) || 0;
  const valY = parseInt(delogoValY.value, 10) || 0;
  const valW = parseInt(delogoValW.value, 10) || 100;
  const valH = parseInt(delogoValH.value, 10) || 100;
  
  // Scale native coordinates back to display coordinates
  const scaleX = rect.width / videoPlayer.videoWidth;
  const scaleY = rect.height / videoPlayer.videoHeight;
  
  delogoRect.left = Math.max(0, Math.min(valX * scaleX, rect.width - 20));
  delogoRect.top = Math.max(0, Math.min(valY * scaleY, rect.height - 20));
  delogoRect.width = Math.max(20, Math.min(valW * scaleX, rect.width - delogoRect.left));
  delogoRect.height = Math.max(20, Math.min(valH * scaleY, rect.height - delogoRect.top));
  
  // Update normalized
  delogoNormalized.x = delogoRect.left / rect.width;
  delogoNormalized.y = delogoRect.top / rect.height;
  delogoNormalized.w = delogoRect.width / rect.width;
  delogoNormalized.h = delogoRect.height / rect.height;
  
  drawDelogoBoxAndMasks();
}

function updateDelogoFilenamePreview() {
  if (!delogoFilenameInput) return;
  if (!videoBaseName) {
    delogoFilenameInput.value = '';
    return;
  }
  delogoFilenameInput.value = `${videoBaseName}_delogo.${videoExt}`;
}

function stopReversePlayback() {
  if (!isReversing) return;
  isReversing = false;
  if (playReverseBtn) {
    playReverseBtn.classList.remove('active');
  }
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

function showSuccessModal(title, message) {
  const header = resultsOverlay.querySelector('h2');
  const para = resultsOverlay.querySelector('p');
  if (header) header.textContent = title;
  if (para) para.textContent = message;
  resultsOverlay.style.display = 'flex';
}

function setupMainSections() {
  const navBtnVideo = document.getElementById('nav-btn-video');
  const navBtnImage = document.getElementById('nav-btn-image');
  const navBtnAudio = document.getElementById('nav-btn-audio');
  
  const sectionVideo = document.getElementById('section-video');
  const sectionImage = document.getElementById('section-image');
  const sectionAudio = document.getElementById('section-audio');
  
  function showSection(section, btn) {
    [sectionVideo, sectionImage, sectionAudio].forEach(sec => sec.classList.remove('active'));
    [navBtnVideo, navBtnImage, navBtnAudio].forEach(b => b.classList.remove('active'));
    
    section.classList.add('active');
    btn.classList.add('active');
    
    // Pause video player if switching away from video tab
    if (section !== sectionVideo && videoPlayer) {
      videoPlayer.pause();
      stopReversePlayback();
    }
    
    // Adjust crop layout for images if switching to image section
    if (section === sectionImage && imagePath && imageCropEnabled) {
      setTimeout(updateImageCropOverlayLayout, 50);
    }
  }
  
  navBtnVideo.addEventListener('click', () => showSection(sectionVideo, navBtnVideo));
  navBtnImage.addEventListener('click', () => showSection(sectionImage, navBtnImage));
  navBtnAudio.addEventListener('click', () => showSection(sectionAudio, navBtnAudio));
}

// Global functions for update/draw that are accessible across setupImageEditor scope
let updateImageCropOverlayLayout = null;

function setupImageEditor() {
  const imageCanvas = document.getElementById('image-canvas');
  const imageDropZone = document.getElementById('image-drop-zone');
  const imageFileInputBtn = document.getElementById('image-file-input-btn');
  const changeImageBtn = document.getElementById('change-image-btn');
  const imageEmptyState = document.getElementById('image-empty-state');
  const imageEditorWorkspace = document.getElementById('image-editor-workspace');
  const loadedImageName = document.getElementById('loaded-image-name');
  const loadedImageSize = document.getElementById('loaded-image-size');
  
  // Rotate Elements
  const imageRotateSlider = document.getElementById('image-rotate-slider');
  const imageRotateInput = document.getElementById('image-rotate-input');
  const imageBtnRotCcw = document.getElementById('image-btn-rot-ccw');
  const imageBtnRotCw = document.getElementById('image-btn-rot-cw');
  const imageBtnFlipH = document.getElementById('image-btn-flip-h');
  const imageBtnFlipV = document.getElementById('image-btn-flip-v');
  const imageBtnResetRotate = document.getElementById('image-btn-reset-rotate');
  const imageRotateHandle = document.getElementById('image-rotate-handle');
  const imageRotationRing = document.getElementById('image-rotation-ring');
  
  // Crop Elements
  const imageCropToggle = document.getElementById('image-crop-toggle');
  const imageCropControlsWrapper = document.getElementById('image-crop-controls-wrapper');
  const imageCropOverlayContainer = document.getElementById('image-crop-overlay-container');
  const imageCropBox = document.getElementById('image-crop-box');
  const imageCropValX = document.getElementById('image-crop-val-x');
  const imageCropValY = document.getElementById('image-crop-val-y');
  const imageCropValW = document.getElementById('image-crop-val-w');
  const imageCropValH = document.getElementById('image-crop-val-h');
  const imageDimensionsDisplay = document.getElementById('image-dimensions-display');
  const imageScaleDisplay = document.getElementById('image-scale-display');
  
  // Export Elements
  const imageExportFilename = document.getElementById('image-export-filename');
  const imageExportBtn = document.getElementById('image-export-btn');

  // Crop Masks
  const imageMaskTop = document.getElementById('image-crop-mask-top');
  const imageMaskBottom = document.getElementById('image-crop-mask-bottom');
  const imageMaskLeft = document.getElementById('image-crop-mask-left');
  const imageMaskRight = document.getElementById('image-crop-mask-right');

  // Load File Click
  imageFileInputBtn.addEventListener('click', selectAndLoadImage);
  if (changeImageBtn) {
    changeImageBtn.addEventListener('click', selectAndLoadImage);
  }

  // Drag & Drop
  imageDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageDropZone.classList.add('dragover');
  });
  imageDropZone.addEventListener('dragleave', () => {
    imageDropZone.classList.remove('dragover');
  });
  imageDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    imageDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const imgExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (imgExtensions.includes(fileExt)) {
        loadImage(file.path, file.name, file.size);
      } else {
        alert('Unsupported file type. Please load an image file.');
      }
    }
  });

  async function selectAndLoadImage() {
    try {
      const fileData = await window.electronAPI.selectImageFile();
      if (fileData) {
        loadImage(fileData.filePath, fileData.name, fileData.size);
      }
    } catch (err) {
      console.error('Failed to select image:', err);
    }
  }

  function loadImage(filePath, name, size) {
    imagePath = filePath;
    imageName = name;
    imageSize = size;
    
    const lastDot = name.lastIndexOf('.');
    imageBaseName = lastDot !== -1 ? name.substring(0, lastDot) : name;
    imageExt = lastDot !== -1 ? name.substring(lastDot + 1) : 'png';
    
    loadedImageName.textContent = name;
    loadedImageSize.textContent = `${(size / 1024).toFixed(1)} KB`;
    imageExportFilename.value = `${imageBaseName}_edited.${imageExt}`;

    // Load image object
    imageObj = new Image();
    imageObj.onload = () => {
      // Reset state
      imageRotation = 0;
      imageFlipH = false;
      imageFlipV = false;
      imageCropEnabled = false;
      imageCropToggle.checked = false;
      imageCropControlsWrapper.style.opacity = '0.5';
      imageCropControlsWrapper.style.pointerEvents = 'none';
      imageCropOverlayContainer.style.display = 'none';
      
      // Update controls UI
      imageRotateSlider.value = 0;
      imageRotateInput.value = 0;
      
      // Initial draw
      drawImage();
      
      // Show workspace
      imageEmptyState.style.display = 'none';
      imageEditorWorkspace.style.display = 'flex';
    };
    imageObj.src = `media://${filePath}`;
  }

  function drawImage() {
    if (!imageObj) return;

    const ctx = imageCanvas.getContext('2d');
    
    // Calculate dimensions of the rotated canvas
    const dimensions = getRotatedCanvasDimensions(imageObj.naturalWidth, imageObj.naturalHeight, imageRotation);
    
    imageCanvas.width = dimensions.width;
    imageCanvas.height = dimensions.height;
    
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    
    // Perform drawing transformations
    ctx.save();
    ctx.translate(dimensions.width / 2, dimensions.height / 2);
    ctx.scale(imageFlipH ? -1 : 1, imageFlipV ? -1 : 1);
    ctx.rotate((imageRotation * Math.PI) / 180);
    ctx.drawImage(imageObj, -imageObj.naturalWidth / 2, -imageObj.naturalHeight / 2);
    ctx.restore();

    // Apply preview enhancement filters if any are active
    if (imageEnhanceAutoContrast || imageEnhanceColorBoost > 0 || imageEnhanceSharpen > 0 || imageEnhanceDenoise > 0) {
      try {
        const imgData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
        const enhancedData = applyEnhancementFilters(imgData.data, imageCanvas.width, imageCanvas.height, {
          sharpen: imageEnhanceSharpen / 100,
          denoise: imageEnhanceDenoise / 100,
          colorBoost: imageEnhanceColorBoost / 100,
          autoContrast: imageEnhanceAutoContrast
        });
        imgData.data.set(enhancedData);
        ctx.putImageData(imgData, 0, 0);
      } catch (err) {
        console.error('Error applying preview enhancement:', err);
      }
    }

    // Update dimension display
    imageDimensionsDisplay.textContent = `${dimensions.width} x ${dimensions.height} px`;
    
    // Calculate scaling
    const canvasRect = imageCanvas.getBoundingClientRect();
    const scalePercent = Math.round((canvasRect.width / dimensions.width) * 100);
    imageScaleDisplay.textContent = `Scale: ${scalePercent}%`;

    // Update crop overlays if enabled
    if (imageCropEnabled) {
      updateImageCropOverlayLayout();
    }
    
    // Update visual rotation handle ring size and transform
    imageRotationRing.style.transform = `translate(-50%, -50%) rotate(${imageRotation}deg)`;
    
    // Update scale display after resize
    setTimeout(() => {
      const newRect = imageCanvas.getBoundingClientRect();
      const newScale = Math.round((newRect.width / dimensions.width) * 100);
      imageScaleDisplay.textContent = `Scale: ${newScale}%`;
    }, 50);

    updateTargetResolutionDisplay();
  }

  // Rotate controls event listeners
  imageRotateSlider.addEventListener('input', () => {
    imageRotation = parseInt(imageRotateSlider.value, 10);
    imageRotateInput.value = imageRotation;
    drawImage();
  });

  imageRotateInput.addEventListener('change', () => {
    let val = parseInt(imageRotateInput.value, 10) || 0;
    val = ((val % 360) + 360) % 360;
    imageRotation = val;
    imageRotateSlider.value = val;
    imageRotateInput.value = val;
    drawImage();
  });

  imageBtnRotCcw.addEventListener('click', () => {
    imageRotation = (imageRotation - 90 + 360) % 360;
    imageRotateSlider.value = imageRotation;
    imageRotateInput.value = imageRotation;
    drawImage();
  });

  imageBtnRotCw.addEventListener('click', () => {
    imageRotation = (imageRotation + 90) % 360;
    imageRotateSlider.value = imageRotation;
    imageRotateInput.value = imageRotation;
    drawImage();
  });

  imageBtnFlipH.addEventListener('click', () => {
    imageFlipH = !imageFlipH;
    drawImage();
  });

  imageBtnFlipV.addEventListener('click', () => {
    imageFlipV = !imageFlipV;
    drawImage();
  });

  imageBtnResetRotate.addEventListener('click', () => {
    imageRotation = 0;
    imageFlipH = false;
    imageFlipV = false;
    imageRotateSlider.value = 0;
    imageRotateInput.value = 0;
    drawImage();
  });

  // Rotation Handle Drag Events
  imageRotateHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isRotatingWithHandle = true;
    
    const canvasRect = imageCanvas.getBoundingClientRect();
    const centerX = canvasRect.left + canvasRect.width / 2;
    const centerY = canvasRect.top + canvasRect.height / 2;
    
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    rotationStartMouseAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    rotationStartAngle = imageRotation;
    
    document.body.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isRotatingWithHandle) return;
    
    const canvasRect = imageCanvas.getBoundingClientRect();
    const centerX = canvasRect.left + canvasRect.width / 2;
    const centerY = canvasRect.top + canvasRect.height / 2;
    
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const currentMouseAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    let diff = currentMouseAngle - rotationStartMouseAngle;
    let newAngle = Math.round(rotationStartAngle + diff) % 360;
    if (newAngle < 0) newAngle += 360;
    
    imageRotation = newAngle;
    imageRotateSlider.value = newAngle;
    imageRotateInput.value = newAngle;
    drawImage();
  });

  document.addEventListener('mouseup', () => {
    if (isRotatingWithHandle) {
      isRotatingWithHandle = false;
      document.body.style.cursor = '';
    }
  });

  // Crop toggle
  imageCropToggle.addEventListener('change', () => {
    imageCropEnabled = imageCropToggle.checked;
    if (imageCropEnabled) {
      imageCropControlsWrapper.style.opacity = '1';
      imageCropControlsWrapper.style.pointerEvents = 'auto';
      imageCropOverlayContainer.style.display = 'block';
      
      // Initialize normalized crop box to 80% center
      imageCropNormalized = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
      updateImageCropOverlayLayout();
    } else {
      imageCropControlsWrapper.style.opacity = '0.5';
      imageCropControlsWrapper.style.pointerEvents = 'none';
      imageCropOverlayContainer.style.display = 'none';
      
      // Reset print size preset if crop is disabled
      const presetSelect = document.getElementById('image-print-preset');
      if (presetSelect) {
        presetSelect.value = 'original';
        imagePrintPreset = 'original';
        const orientationWrapper = document.getElementById('image-print-orientation-wrapper');
        if (orientationWrapper) orientationWrapper.style.display = 'none';
      }
    }
    updateTargetResolutionDisplay();
  });

  // Aspect ratio buttons
  const ratioButtons = [
    document.getElementById('image-crop-ratio-free'),
    document.getElementById('image-crop-ratio-1-1'),
    document.getElementById('image-crop-ratio-16-9')
  ];

  ratioButtons.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      ratioButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      imageAspectRatio = btn.getAttribute('data-ratio');
      
      // Reset print size preset if manual aspect ratio is selected
      const presetSelect = document.getElementById('image-print-preset');
      if (presetSelect) {
        presetSelect.value = 'original';
        imagePrintPreset = 'original';
        const orientationWrapper = document.getElementById('image-print-orientation-wrapper');
        if (orientationWrapper) orientationWrapper.style.display = 'none';
      }

      setImageAspectRatio(imageAspectRatio);
    });
  });

  function setImageAspectRatio(ratioStr) {
    imageAspectRatio = ratioStr;
    if (ratioStr === 'free') return;
    
    const [rw, rh] = ratioStr.split(':').map(Number);
    const R = rw / rh;
    
    const canvasRect = imageCanvas.getBoundingClientRect();
    
    let newW, newH;
    if (canvasRect.width / canvasRect.height > R) {
      newH = canvasRect.height * 0.8;
      newW = newH * R;
    } else {
      newW = canvasRect.width * 0.8;
      newH = newW / R;
    }
    
    imageCropRect.left = (canvasRect.width - newW) / 2;
    imageCropRect.top = (canvasRect.height - newH) / 2;
    imageCropRect.width = newW;
    imageCropRect.height = newH;
    
    imageCropNormalized.x = imageCropRect.left / canvasRect.width;
    imageCropNormalized.y = imageCropRect.top / canvasRect.height;
    imageCropNormalized.w = imageCropRect.width / canvasRect.width;
    imageCropNormalized.h = imageCropRect.height / canvasRect.height;
    
    drawImageCropBoxAndMasks();
    updateImageManualInputFields();
  }

  // Crop manual fields
  const cropInputs = [imageCropValX, imageCropValY, imageCropValW, imageCropValH];
  cropInputs.forEach(input => {
    input.addEventListener('input', handleImageManualInputChange);
  });

  updateImageCropOverlayLayout = function() {
    const canvasRect = imageCanvas.getBoundingClientRect();
    if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return;
    
    imageCropOverlayContainer.style.left = '0px';
    imageCropOverlayContainer.style.top = '0px';
    imageCropOverlayContainer.style.width = `${canvasRect.width}px`;
    imageCropOverlayContainer.style.height = `${canvasRect.height}px`;
    
    // Calculate absolute coordinates based on normalized coordinates
    imageCropRect.left = imageCropNormalized.x * canvasRect.width;
    imageCropRect.top = imageCropNormalized.y * canvasRect.height;
    imageCropRect.width = imageCropNormalized.w * canvasRect.width;
    imageCropRect.height = imageCropNormalized.h * canvasRect.height;
    
    drawImageCropBoxAndMasks();
    updateImageManualInputFields();
  };

  function drawImageCropBoxAndMasks() {
    const canvasRect = imageCanvas.getBoundingClientRect();
    if (!canvasRect) return;

    imageCropBox.style.left = `${imageCropRect.left}px`;
    imageCropBox.style.top = `${imageCropRect.top}px`;
    imageCropBox.style.width = `${imageCropRect.width}px`;
    imageCropBox.style.height = `${imageCropRect.height}px`;

    const x = imageCropRect.left;
    const y = imageCropRect.top;
    const w = imageCropRect.width;
    const h = imageCropRect.height;

    imageMaskTop.style.left = '0px';
    imageMaskTop.style.top = '0px';
    imageMaskTop.style.width = `${canvasRect.width}px`;
    imageMaskTop.style.height = `${y}px`;

    imageMaskBottom.style.left = '0px';
    imageMaskBottom.style.top = `${y + h}px`;
    imageMaskBottom.style.width = `${canvasRect.width}px`;
    imageMaskBottom.style.height = `${Math.max(0, canvasRect.height - (y + h))}px`;

    imageMaskLeft.style.left = '0px';
    imageMaskLeft.style.top = `${y}px`;
    imageMaskLeft.style.width = `${x}px`;
    imageMaskLeft.style.height = `${h}px`;

    imageMaskRight.style.left = `${x + w}px`;
    imageMaskRight.style.top = `${y}px`;
    imageMaskRight.style.width = `${Math.max(0, canvasRect.width - (x + w))}px`;
    imageMaskRight.style.height = `${h}px`;
  }

  function updateImageManualInputFields() {
    if (!imageCanvas) return;
    
    const nativeX = Math.round(imageCropNormalized.x * imageCanvas.width);
    const nativeY = Math.round(imageCropNormalized.y * imageCanvas.height);
    const nativeW = Math.round(imageCropNormalized.w * imageCanvas.width);
    const nativeH = Math.round(imageCropNormalized.h * imageCanvas.height);

    if (document.activeElement !== imageCropValX) imageCropValX.value = nativeX;
    if (document.activeElement !== imageCropValY) imageCropValY.value = nativeY;
    if (document.activeElement !== imageCropValW) imageCropValW.value = nativeW;
    if (document.activeElement !== imageCropValH) imageCropValH.value = nativeH;
  }

  function handleImageManualInputChange() {
    if (!imageCanvas) return;

    let nx = parseInt(imageCropValX.value, 10) || 0;
    let ny = parseInt(imageCropValY.value, 10) || 0;
    let nw = parseInt(imageCropValW.value, 10) || 100;
    let nh = parseInt(imageCropValH.value, 10) || 100;

    const nativeW = imageCanvas.width;
    const nativeH = imageCanvas.height;

    nx = Math.max(0, Math.min(nx, nativeW - 1));
    ny = Math.max(0, Math.min(ny, nativeH - 1));
    nw = Math.max(1, Math.min(nw, nativeW - nx));
    nh = Math.max(1, Math.min(nh, nativeH - ny));

    if (imageAspectRatio !== 'free') {
      const [rw, rh] = imageAspectRatio.split(':').map(Number);
      const R = rw / rh;
      nh = Math.round(nw / R);
      if (ny + nh > nativeH) {
        nh = nativeH - ny;
        nw = Math.round(nh * R);
      }
    }

    imageCropNormalized.x = nx / nativeW;
    imageCropNormalized.y = ny / nativeH;
    imageCropNormalized.w = nw / nativeW;
    imageCropNormalized.h = nh / nativeH;

    const canvasRect = imageCanvas.getBoundingClientRect();
    imageCropRect.left = imageCropNormalized.x * canvasRect.width;
    imageCropRect.top = imageCropNormalized.y * canvasRect.height;
    imageCropRect.width = imageCropNormalized.w * canvasRect.width;
    imageCropRect.height = imageCropNormalized.h * canvasRect.height;

    drawImageCropBoxAndMasks();

    imageCropValX.value = nx;
    imageCropValY.value = ny;
    imageCropValW.value = nw;
    imageCropValH.value = nh;
    updateTargetResolutionDisplay();
  }

  // Draggable Crop box events
  const dragArea = imageCropBox.querySelector('.crop-drag-area');
  dragArea.addEventListener('mousedown', (e) => {
    e.preventDefault();
    imageIsDragging = true;
    imageDragMode = 'move';
    imageDragStart.x = e.clientX;
    imageDragStart.y = e.clientY;
    imageCropBoxStart = { ...imageCropRect };
  });

  const handles = imageCropBox.querySelectorAll('.crop-handle');
  handles.forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      imageIsDragging = true;
      imageDragMode = handle.getAttribute('data-handle');
      imageDragStart.x = e.clientX;
      imageDragStart.y = e.clientY;
      imageCropBoxStart = { ...imageCropRect };
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (!imageIsDragging || !imageCropEnabled) return;

    const canvasRect = imageCanvas.getBoundingClientRect();
    if (!canvasRect) return;

    const dx = e.clientX - imageDragStart.x;
    const dy = e.clientY - imageDragStart.y;

    if (imageDragMode === 'move') {
      let newLeft = imageCropBoxStart.left + dx;
      let newTop = imageCropBoxStart.top + dy;

      newLeft = Math.max(0, Math.min(newLeft, canvasRect.width - imageCropRect.width));
      newTop = Math.max(0, Math.min(newTop, canvasRect.height - imageCropRect.height));

      imageCropRect.left = newLeft;
      imageCropRect.top = newTop;
    } else {
      const minSize = 20;
      let R = null;
      if (imageAspectRatio !== 'free') {
        const [rw, rh] = imageAspectRatio.split(':').map(Number);
        R = rw / rh;
      }

      if (imageDragMode === 'br') {
        let newW = imageCropBoxStart.width + dx;
        let newH = imageCropBoxStart.height + dy;

        newW = Math.max(minSize, Math.min(newW, canvasRect.width - imageCropBoxStart.left));
        newH = Math.max(minSize, Math.min(newH, canvasRect.height - imageCropBoxStart.top));

        if (R !== null) {
          newH = newW / R;
          if (imageCropBoxStart.top + newH > canvasRect.height) {
            newH = canvasRect.height - imageCropBoxStart.top;
            newW = newH * R;
          }
          if (imageCropBoxStart.left + newW > canvasRect.width) {
            newW = canvasRect.width - imageCropBoxStart.left;
            newH = newW / R;
          }
        }

        imageCropRect.width = newW;
        imageCropRect.height = newH;
      }
      else if (imageDragMode === 'tr') {
        let newW = imageCropBoxStart.width + dx;
        let newH = imageCropBoxStart.height - dy;
        let newTop = imageCropBoxStart.top + dy;

        newW = Math.max(minSize, Math.min(newW, canvasRect.width - imageCropBoxStart.left));
        if (newTop < 0) {
          newH = imageCropBoxStart.top + imageCropBoxStart.height;
          newTop = 0;
        }
        newH = Math.max(minSize, newH);
        newTop = imageCropBoxStart.top + imageCropBoxStart.height - newH;

        if (R !== null) {
          newH = newW / R;
          newTop = imageCropBoxStart.top + imageCropBoxStart.height - newH;
          if (newTop < 0) {
            newTop = 0;
            newH = imageCropBoxStart.top + imageCropBoxStart.height;
            newW = newH * R;
          }
          if (imageCropBoxStart.left + newW > canvasRect.width) {
            newW = canvasRect.width - imageCropBoxStart.left;
            newH = newW / R;
            newTop = imageCropBoxStart.top + imageCropBoxStart.height - newH;
          }
        }

        imageCropRect.width = newW;
        imageCropRect.height = newH;
        imageCropRect.top = newTop;
      }
      else if (imageDragMode === 'bl') {
        let newW = imageCropBoxStart.width - dx;
        let newLeft = imageCropBoxStart.left + dx;
        let newH = imageCropBoxStart.height + dy;

        if (newLeft < 0) {
          newW = imageCropBoxStart.left + imageCropBoxStart.width;
          newLeft = 0;
        }
        newW = Math.max(minSize, newW);
        newLeft = imageCropBoxStart.left + imageCropBoxStart.width - newW;
        newH = Math.max(minSize, Math.min(newH, canvasRect.height - imageCropBoxStart.top));

        if (R !== null) {
          newH = newW / R;
          if (imageCropBoxStart.top + newH > canvasRect.height) {
            newH = canvasRect.height - imageCropBoxStart.top;
            newW = newH * R;
            newLeft = imageCropBoxStart.left + imageCropBoxStart.width - newW;
          }
          if (newLeft < 0) {
            newLeft = 0;
            newW = imageCropBoxStart.left + imageCropBoxStart.width;
            newH = newW / R;
          }
        }

        imageCropRect.width = newW;
        imageCropRect.left = newLeft;
        imageCropRect.height = newH;
      }
      else if (imageDragMode === 'tl') {
        let newW = imageCropBoxStart.width - dx;
        let newLeft = imageCropBoxStart.left + dx;
        let newH = imageCropBoxStart.height - dy;
        let newTop = imageCropBoxStart.top + dy;

        if (newLeft < 0) {
          newW = imageCropBoxStart.left + imageCropBoxStart.width;
          newLeft = 0;
        }
        newW = Math.max(minSize, newW);
        newLeft = imageCropBoxStart.left + imageCropBoxStart.width - newW;

        if (newTop < 0) {
          newH = imageCropBoxStart.top + imageCropBoxStart.height;
          newTop = 0;
        }
        newH = Math.max(minSize, newH);
        newTop = imageCropBoxStart.top + imageCropBoxStart.height - newH;

        if (R !== null) {
          newH = newW / R;
          newTop = imageCropBoxStart.top + imageCropBoxStart.height - newH;

          if (newTop < 0) {
            newTop = 0;
            newH = imageCropBoxStart.top + imageCropBoxStart.height;
            newW = newH * R;
            newLeft = imageCropBoxStart.left + imageCropBoxStart.width - newW;
          }
          if (newLeft < 0) {
            newLeft = 0;
            newW = imageCropBoxStart.left + imageCropBoxStart.width;
            newH = newW / R;
            newTop = imageCropBoxStart.top + imageCropBoxStart.height - newH;
          }
        }

        imageCropRect.width = newW;
        imageCropRect.left = newLeft;
        imageCropRect.height = newH;
        imageCropRect.top = newTop;
      }
    }

    imageCropNormalized.x = imageCropRect.left / canvasRect.width;
    imageCropNormalized.y = imageCropRect.top / canvasRect.height;
    imageCropNormalized.w = imageCropRect.width / canvasRect.width;
    imageCropNormalized.h = imageCropRect.height / canvasRect.height;

    drawImageCropBoxAndMasks();
    updateImageManualInputFields();
    updateTargetResolutionDisplay();
  });

  document.addEventListener('mouseup', () => {
    imageIsDragging = false;
    imageDragMode = null;
  });

  // Collapsible cards toggle
  const collapsibleCards = document.querySelectorAll('.collapsible-card');
  collapsibleCards.forEach(card => {
    const header = card.querySelector('.clickable-header');
    if (header) {
      header.addEventListener('click', () => {
        card.classList.toggle('expanded');
      });
    }
  });

  // Quality Enhancement controls
  const enhanceAutoContrastCheckbox = document.getElementById('image-enhance-autocontrast');
  const enhanceColorBoostSlider = document.getElementById('image-enhance-colorboost');
  const enhanceColorBoostVal = document.getElementById('image-enhance-colorboost-val');
  const enhanceSharpenSlider = document.getElementById('image-enhance-sharpen');
  const enhanceSharpenVal = document.getElementById('image-enhance-sharpen-val');
  const enhanceDenoiseSlider = document.getElementById('image-enhance-denoise');
  const enhanceDenoiseVal = document.getElementById('image-enhance-denoise-val');
  
  // Print preset controls
  const printPresetSelect = document.getElementById('image-print-preset');
  const printOrientationPortrait = document.getElementById('image-print-orientation-portrait');
  const printOrientationLandscape = document.getElementById('image-print-orientation-landscape');

  enhanceAutoContrastCheckbox.addEventListener('change', () => {
    imageEnhanceAutoContrast = enhanceAutoContrastCheckbox.checked;
    drawImage();
  });

  let drawImageTimeout = null;
  function throttledDrawImage() {
    if (drawImageTimeout) clearTimeout(drawImageTimeout);
    drawImageTimeout = setTimeout(() => {
      drawImage();
    }, 30);
  }

  enhanceColorBoostSlider.addEventListener('input', () => {
    imageEnhanceColorBoost = parseInt(enhanceColorBoostSlider.value, 10);
    enhanceColorBoostVal.textContent = `${imageEnhanceColorBoost}%`;
    throttledDrawImage();
  });

  enhanceSharpenSlider.addEventListener('input', () => {
    imageEnhanceSharpen = parseInt(enhanceSharpenSlider.value, 10);
    enhanceSharpenVal.textContent = `${imageEnhanceSharpen}%`;
    throttledDrawImage();
  });

  enhanceDenoiseSlider.addEventListener('input', () => {
    imageEnhanceDenoise = parseInt(enhanceDenoiseSlider.value, 10);
    enhanceDenoiseVal.textContent = `${imageEnhanceDenoise}%`;
    throttledDrawImage();
  });

  printPresetSelect.addEventListener('change', () => {
    imagePrintPreset = printPresetSelect.value;
    applyPrintPresetRatio();
  });

  printOrientationPortrait.addEventListener('click', () => {
    printOrientationPortrait.classList.add('active');
    printOrientationLandscape.classList.remove('active');
    imagePrintOrientation = 'portrait';
    applyPrintPresetRatio();
  });

  printOrientationLandscape.addEventListener('click', () => {
    printOrientationLandscape.classList.add('active');
    printOrientationPortrait.classList.remove('active');
    imagePrintOrientation = 'landscape';
    applyPrintPresetRatio();
  });

  function updateTargetResolutionDisplay() {
    if (!imageObj) return;
    let sourceW = imageCanvas.width;
    let sourceH = imageCanvas.height;
    
    if (imageCropEnabled) {
      sourceW = Math.round(imageCropNormalized.w * imageCanvas.width);
      sourceH = Math.round(imageCropNormalized.h * imageCanvas.height);
    }
    
    const target = getPrintDimensions(imagePrintPreset, imagePrintOrientation, sourceW, sourceH);
    const display = document.getElementById('image-target-res-display');
    if (display) {
      display.textContent = `${target.width} x ${target.height} px`;
    }
  }

  function applyPrintPresetRatio() {
    const orientationWrapper = document.getElementById('image-print-orientation-wrapper');
    if (imagePrintPreset === 'original' || imagePrintPreset === '2x' || imagePrintPreset === '3x' || imagePrintPreset === '4x') {
      if (orientationWrapper) orientationWrapper.style.display = 'none';
      updateTargetResolutionDisplay();
      return;
    }
    
    if (orientationWrapper) orientationWrapper.style.display = 'block';
    
    let ratioStr = 'free';
    if (imagePrintPreset === '4x6') ratioStr = imagePrintOrientation === 'portrait' ? '4:6' : '6:4';
    else if (imagePrintPreset === '5x7') ratioStr = imagePrintOrientation === 'portrait' ? '5:7' : '7:5';
    else if (imagePrintPreset === '8x10') ratioStr = imagePrintOrientation === 'portrait' ? '8:10' : '10:8';
    else if (imagePrintPreset === '11x14') ratioStr = imagePrintOrientation === 'portrait' ? '11:14' : '14:11';
    else if (imagePrintPreset === '18x24') ratioStr = imagePrintOrientation === 'portrait' ? '18:24' : '24:18';
    else if (imagePrintPreset === 'a4') ratioStr = imagePrintOrientation === 'portrait' ? '2480:3508' : '3508:2480';
    
    if (!imageCropEnabled) {
      imageCropToggle.checked = true;
      imageCropEnabled = true;
      imageCropControlsWrapper.style.opacity = '1';
      imageCropControlsWrapper.style.pointerEvents = 'auto';
      imageCropOverlayContainer.style.display = 'block';
      imageCropNormalized = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    }
    
    ratioButtons.forEach(b => {
      if (b) b.classList.remove('active');
    });
    
    setImageAspectRatio(ratioStr);
    updateTargetResolutionDisplay();
  }

  // Export Action
  imageExportBtn.addEventListener('click', async () => {
    if (!imagePath || !imageObj) {
      alert('Please load an image first.');
      return;
    }

    const filename = imageExportFilename.value.trim();
    if (!filename) {
      alert('Please enter a valid filename.');
      return;
    }

    // Prompt for save folder
    const defaultDir = imagePath ? imagePath.substring(0, imagePath.lastIndexOf('/')) : null;
    const dir = await window.electronAPI.selectOutputDirectory(defaultDir);
    if (!dir) return;

    const finalPath = `${dir}/${filename}`;

    // Disable button, show loading
    imageExportBtn.disabled = true;
    imageExportBtn.textContent = 'Exporting...';

    // Show progress overlay
    progressOverlay.style.display = 'flex';
    progressProgressBar.style.width = '20%';
    progressPercentText.textContent = '20%';
    progressStatusText.textContent = 'Rendering rotation and crop...';

    setTimeout(async () => {
      try {
        // Calculate source crop dimensions relative to full resolution canvas
        let cropX = 0, cropY = 0, cropW = imageCanvas.width, cropH = imageCanvas.height;
        if (imageCropEnabled) {
          cropX = Math.round(imageCropNormalized.x * imageCanvas.width);
          cropY = Math.round(imageCropNormalized.y * imageCanvas.height);
          cropW = Math.round(imageCropNormalized.w * imageCanvas.width);
          cropH = Math.round(imageCropNormalized.h * imageCanvas.height);
        }

        // Get target print dimensions (takes orientation and preset into account)
        const target = getPrintDimensions(imagePrintPreset, imagePrintOrientation, cropW, cropH);

        progressProgressBar.style.width = '40%';
        progressPercentText.textContent = '40%';
        progressStatusText.textContent = 'Generating clean canvas buffer...';

        // Create a clean rotated/flipped canvas at native size to avoid double enhancement
        const cleanCanvas = document.createElement('canvas');
        cleanCanvas.width = imageCanvas.width;
        cleanCanvas.height = imageCanvas.height;
        const cleanCtx = cleanCanvas.getContext('2d');
        
        cleanCtx.save();
        cleanCtx.translate(imageCanvas.width / 2, imageCanvas.height / 2);
        cleanCtx.scale(imageFlipH ? -1 : 1, imageFlipV ? -1 : 1);
        cleanCtx.rotate((imageRotation * Math.PI) / 180);
        cleanCtx.drawImage(imageObj, -imageObj.naturalWidth / 2, -imageObj.naturalHeight / 2);
        cleanCtx.restore();

        progressProgressBar.style.width = '60%';
        progressPercentText.textContent = '60%';
        progressStatusText.textContent = 'Upscaling to print resolution...';

        // Create crop/rotated export canvas at target resolution
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = target.width;
        exportCanvas.height = target.height;
        const exportCtx = exportCanvas.getContext('2d');
        
        // High quality image smoothing
        exportCtx.imageSmoothingEnabled = true;
        exportCtx.imageSmoothingQuality = 'high';
        
        // Draw the cropped region from cleanCanvas stretched/fitted to target print dimensions
        exportCtx.drawImage(cleanCanvas, cropX, cropY, cropW, cropH, 0, 0, target.width, target.height);

        progressProgressBar.style.width = '80%';
        progressPercentText.textContent = '80%';
        progressStatusText.textContent = 'Applying quality enhancement filters...';

        // Get pixel data from exportCanvas to apply enhancements
        const imgData = exportCtx.getImageData(0, 0, target.width, target.height);
        const enhancedData = applyEnhancementFilters(imgData.data, target.width, target.height, {
          sharpen: imageEnhanceSharpen / 100,
          denoise: imageEnhanceDenoise / 100,
          colorBoost: imageEnhanceColorBoost / 100,
          autoContrast: imageEnhanceAutoContrast
        });
        imgData.data.set(enhancedData);
        exportCtx.putImageData(imgData, 0, 0);

        progressProgressBar.style.width = '90%';
        progressPercentText.textContent = '90%';
        progressStatusText.textContent = 'Saving file...';

        // Convert canvas to base64 Data URL
        const dataUrl = exportCanvas.toDataURL(`image/${imageExt === 'jpg' ? 'jpeg' : imageExt}`);
        
        // Save using IPC
        const saveResult = await window.electronAPI.saveImageFile(dataUrl, finalPath);
        
        imageExportBtn.disabled = false;
        imageExportBtn.textContent = 'Export Image';
        progressOverlay.style.display = 'none';

        if (saveResult.success) {
          outputDir = dir; // set outputDir so "Open in Finder" opens correct dir
          showSuccessModal('Image Export Complete!', `The image "${filename}" has been successfully exported.`);
        } else {
          alert(`Failed to save image: ${saveResult.message}`);
        }
      } catch (err) {
        imageExportBtn.disabled = false;
        imageExportBtn.textContent = 'Export Image';
        progressOverlay.style.display = 'none';
        alert(`Unexpected error during export: ${err.message}`);
      }
    }, 50);
  });
}
