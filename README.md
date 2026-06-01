# macOS Media Splitter & Editor

A beautiful, high-fidelity macOS desktop application designed to split video files into multiple clips quickly and losslessly. Built on top of Electron, this application provides a native macOS dark-mode user experience with interactive timeline scrubbers, dynamic clip-range coloring, and high-performance ffmpeg operations.

---

## Key Features

- **Drag & Drop Import**: Quickly import any video file (`.mp4`, `.mov`, `.mkv`, `.avi`, `.webm`) by dragging it into the window or using the native macOS file picker.
- **Dynamic Clip Generation**: Split a single video into any number of clips. The application pre-calculates equal segments to save you time.
- **Interactive Scrubber & Timeline**: Visually inspect loaded videos, scrub through the playback, and see real-time color-coded range overlays representing each planned clip.
- **Precision Time Syncer**: Sync clip start/end times directly with the video player's current playback position via one-click "Use Current Time" buttons.
- **Dual Splitting Modes**:
  - **Fast/Lossless (Instant)**: Employs FFmpeg's stream copy (`-c copy`) to extract segments in milliseconds without re-encoding quality loss.
  - **Frame-Accurate (Precise)**: Re-encodes using H.264/AAC to cut video at the exact millisecond.
- **Finder Integration**: Open the output directory directly in macOS Finder immediately after splitting.

---

## Tech Stack

- **Framework**: Electron (v30)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (UMD modular patterns)
- **Video Engine**: FFmpeg (via `ffmpeg-static` node module)
- **Unit Testing**: Vitest (v1.6)

---

## Prerequisites

Make sure you have Node.js and npm installed on your Mac:
- **Node.js**: `v18` or higher (tested on `v24.14.0`)
- **npm**: `v9` or higher (tested on `11.9.0`)

No external installation of FFmpeg or Homebrew is required; the application automatically bundles a static macOS binary.

---

## Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd media-editor
   ```

2. **Install dependencies locally**:
   ```bash
   npm install
   ```

3. **Run the application in development**:
   ```bash
   npm start
   # or
   npm run dev
   ```

4. **Run unit tests**:
   ```bash
   npm run test
   ```

---

## Packaging as a macOS App (Double-Clickable)

To compile the application into a double-clickable macOS desktop `.app` bundle, run:
```bash
npm run package
```
This compiles the application and generates the app bundle in:
`./dist/mac-arm64/Media Editor.app` (or `./dist/mac/` depending on processor architecture).

### macOS Security Gatekeeper Workaround (For Unsigned Local App)
Since the app is built locally without an active Apple Developer Team certificate, macOS Gatekeeper will block the application on the very first double-click. To open it:
1. **Open Finder** and navigate to `./dist/mac-arm64/` (or wherever your package was generated).
2. **Right-Click (Control-Click)** the **Media Editor.app** file.
3. Click **Open** from the context menu.
4. Select **Open** again in the macOS confirmation dialog.
5. The application will now launch and will open instantly on all subsequent double-clicks without showing any warnings.

---

## Usage Guide

1. **Load a Video**: Drag a video file onto the home dropzone, or click **Browse File** to select one.
2. **Configure Clips**:
   - In the sidebar, select the number of clips you want to generate.
   - Adjust the **Start Time** and **End Time** for each clip card:
     - You can manually enter values in `HH:MM:SS.mmm` format.
     - Or, play the video, scrub to the desired point, and click the **Use Current Time** icon button next to the input.
3. **Set Export Options**:
   - Choose a **Splitting Mode**:
     - *Fast/Lossless* (retains input quality, splits in <1s)
     - *Frame-Accurate* (re-encodes to cut at exact frames)
4. **Generate**: Click **Generate Clips**. 
5. **Select Output Folder**: A native folder selector will prompt you to choose where to save the generated clips. Select a folder to start.
6. **Complete**: Watch the progress bar complete, then click **Open in Finder** to retrieve your files.

---

## Testing

This project uses Vitest to verify all duration calculations and timestamp conversions. The test suite is located in `./helpers.test.js` and can be run with:
```bash
npm run test
```

---

## Project Structure

- [main.js](./main.js) - Sets up Electron app windows, custom `media://` local streaming protocol, and handles FFmpeg spawning.
- [preload.js](./preload.js) - Exposes a secure, context-isolated bridge interface (`electronAPI`) to the renderer.
- [renderer.js](./renderer.js) - Manages UI updates, timeline overlays, scrubber events, and validation checks.
- [helpers.js](./helpers.js) - Shared utilities for time formats and string parsing.
- [helpers.test.js](./helpers.test.js) - Unit tests for time utilities.
- [index.html](./index.html) - Application layout structure.
- [style.css](./style.css) - App styling rules, including dark theme variables and custom scrubbers.
