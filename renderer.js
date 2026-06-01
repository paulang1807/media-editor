// Access helpers from global window object
const { secondsToTimestamp, timestampToSeconds, isValidTimestampFormat } = window.helpers;

// State management
let videoPath = null;
let videoName = null;
let videoDuration = 0;
let outputDir = null;
let clips = [];
let activeClipIndex = null; // Track which clip is currently being played/previewed

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

// Progress & Overlays
const progressOverlay = document.getElementById('progress-overlay');
const progressStatusText = document.getElementById('progress-status');
const progressProgressBar = document.getElementById('progress-bar-fill');
const progressPercentText = document.getElementById('progress-percent');
const resultsOverlay = document.getElementById('results-overlay');
const openFinderBtn = document.getElementById('open-finder-btn');
const closeResultsBtn = document.getElementById('close-results-btn');

// Initialize Events
document.addEventListener('DOMContentLoaded', () => {
  setupFileImportEvents();
  setupPlayerEvents();
  setupSidebarEvents();
  setupExportEvents();
});

// 1. File Import Handlers
function setupFileImportEvents() {
  fileInputBtn.addEventListener('click', async () => {
    const fileData = await window.electronAPI.selectVideoFile();
    if (fileData) {
      loadVideo(fileData.filePath, fileData.name);
    }
  });

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
  
  // Set default output directory (null initially, will prompt)
  outputDir = null;

  loadedFileName.textContent = fileName;

  // Use the custom media:// protocol to load file without context restriction
  videoPlayer.src = `media://${filePath}`;
  videoPlayer.load();

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
  editorWorkspace.style.display = 'grid';

  // Initialize Clips
  clipCountInput.value = 2; // Default to 2 clips
  generateClipsData(2);
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
  const lastDot = videoName.lastIndexOf('.');
  const videoBaseName = lastDot !== -1 ? videoName.substring(0, lastDot) : videoName;
  const videoExt = lastDot !== -1 ? videoName.substring(lastDot + 1) : 'mp4';

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
