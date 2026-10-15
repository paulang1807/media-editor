# Autonomous Agent Setup & Installation Guide

This document contains machine-actionable instructions for autonomous AI agents to set up, install, verify, and run the **macOS Media Editor** repository from a blank slate.

---

## Agent Operating Directives

When an agent is tasked with setting up this repository, follow these rules:
1. **Idempotency**: All commands listed below are safe to execute repeatedly.
2. **Local Scope Isolation**: Do not install global npm packages. Use project-local dependencies.
3. **Sequential Verification**: Validate each step's exit code (`0`) and expected artifacts before advancing to the next step.
4. **Git Cleanliness**: Do not commit build artifacts (`dist/`), temporary logs, or scratch files.

---

## 1. System & Environment Preflight

Verify that the local environment meets the minimum engine requirements:

```bash
node -v
npm -v
uname -s
```

### Preflight Criteria
- **OS**: macOS (`Darwin` on `arm64` or `x64`).
- **Node.js**: `>= 18.0.0`
- **npm**: `>= 9.0.0`
- **Native Binaries**: No external installation of FFmpeg, ImageMagick, or Homebrew is needed. Static FFmpeg binaries are bundled natively via `ffmpeg-static`.

---

## 2. Step-by-Step Installation Workflow

### Step 1: Install Local Dependencies
Execute standard package installation:

```bash
npm install
```

> [!NOTE]
> During `npm install`, the `postinstall` hook defined in `package.json` will automatically:
> 1. Create `./libs` and `./models` directories.
> 2. Bundle `@imgly/background-removal` via `esbuild` to `./libs/imgly.js`.
> 3. Copy WebAssembly AI models and ONNX runtime assets to `./models/`.

### Step 2: Verify Postinstall Assets
Confirm that the AI background removal library and models were created:

```bash
test -f ./libs/imgly.js && test -d ./models && echo "Postinstall verification: SUCCESS" || echo "Postinstall verification: FAILED"
```

If the check outputs `FAILED` (e.g. if `--ignore-scripts` was used), run the postinstall script manually:

```bash
npm run postinstall
```

### Step 3: Run the Automated Unit Test Suite
Verify that all core math, boundary clamping, timecode conversions, and FFmpeg filter generators pass:

```bash
npm test
```

### Expected Pass Criteria:
- Test runner: Vitest (`vitest run`).
- Target file: `helpers.test.js`.
- Result: **61 tests passed across 11 test suites** with exit code `0`.

---

## 3. Launching & Packaging Modes

### Development Mode (Launch App GUI)
To launch the Electron application for interactive development:

```bash
npm start
```

> [!IMPORTANT]
> **For Autonomous Agents Running Headless or in Background**:
> `npm start` launches a persistent Electron GUI process and will not exit automatically until the window is closed. In non-interactive or automated agent environments, do not run `npm start` synchronously. Use persistent terminal session backgrounding or inspect the packaging step below.

### Standalone macOS App Packaging
To compile and package the application into a standalone macOS `.app` bundle:

```bash
npm run package
```

### Build Output Locations:
- Apple Silicon (M1/M2/M3/M4): `./dist/mac-arm64/Media Editor.app`
- Intel: `./dist/mac/Media Editor.app`

### macOS Gatekeeper Clearance (Unsigned Local Builds)
If testing or opening the compiled `.app` bundle on macOS, clear quarantine flags:

```bash
xattr -cr "./dist/mac-arm64/Media Editor.app" 2>/dev/null || true
```

---

## 4. Agent Diagnostics & Troubleshooting Playbook

| Issue Encountered | Root Cause | Automated Resolution Command |
| :--- | :--- | :--- |
| `Cannot find module 'esbuild'` or missing `imgly.js` | `npm install` failed or was interrupted | `npm install && npm run postinstall` |
| `vitest: command not found` | Local `node_modules` binaries not installed | `npm install` |
| Video file loading errors in monitor | File path permission or unsupported container format | Confirm video uses `.mp4`, `.mov`, `.mkv`, `.avi`, or `.webm` |
| Electron crashes on start in sandbox | Mach port restrictions in restricted sandboxes | Run with bypass permissions or check `app.log` below |

### Application Runtime Logs
Electron outputs debug messages, IPC requests, and FFmpeg stderr logs to:
```bash
cat ~/Library/Application\ Support/Media\ Editor/app.log 2>/dev/null || cat ~/Library/Application\ Support/media-editor/app.log 2>/dev/null
```

---

## 5. Verification Checklist for Agents

Before completing the setup task, an agent should verify:
- [ ] `node_modules/` exists and is populated.
- [ ] `libs/imgly.js` exists and is non-empty.
- [ ] `models/` contains ONNX and WASM model files.
- [ ] `npm test` runs and reports 61 passing tests.
- [ ] Working tree is clean (`git status` shows no unexpected untracked files).
