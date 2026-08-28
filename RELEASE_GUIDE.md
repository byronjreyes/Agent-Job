# AgentJob — Release & Update Guide

This document explains step-by-step how to publish an update for AgentJob so that installed desktop applications receive the update via the in-app updater.

---

## Quick Version Bump Checklist

Whenever you make changes to the app and want to release a new version (e.g., `0.1.0` → `0.1.1`):

1. **Update version in [`package.json`](./package.json):**
   ```json
   "version": "0.1.1"
   ```
2. **Update version in [`src-tauri/tauri.conf.json`](./src-tauri/tauri.conf.json):**
   ```json
   "version": "0.1.1"
   ```
3. **Commit your changes:**
   ```powershell
   git add .
   git commit -m "feat: release v0.1.1"
   git push origin main
   ```

---

## Method A: Local Signed Release (Recommended — 0 Billing Cost)

Use this method when GitHub Actions billing quota is exhausted. You can build and cryptographically sign releases entirely on your local PC:

### Step 1: Run the Local Build & Sign Script
In PowerShell inside the project root:
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/build-signed-release.ps1
```

### Step 2: Locate Generated Release Artifacts
Once the build completes, your files will be in:
- **`src-tauri/target/release/bundle/nsis/`** → `AgentJob_0.1.1_x64-setup.exe` (Windows Installer)
- **`src-tauri/target/release/bundle/msi/`** → `AgentJob_0.1.1_x64_en-US.msi`
- **`src-tauri/target/release/bundle/`** (or `updater/`) → `latest.json`, `AgentJob.nsis.zip`, `AgentJob.nsis.zip.sig`

### Step 3: Publish Release on GitHub
1. Go to your GitHub repository: `https://github.com/byronjreyes/Agent-Job/releases/new`
2. Set **Tag version** to `v0.1.1` (create new tag on publish).
3. Set **Release title** to `AgentJob v0.1.1`.
4. Drag and drop the following files into the release assets:
   - `AgentJob_0.1.1_x64-setup.exe`
   - `AgentJob_0.1.1_x64_en-US.msi`
   - `latest.json`
   - Any `.zip` and `.sig` updater bundles produced in the target directory.
5. Click **Publish release**.

---

## Method B: Automated GitHub Actions Release

If GitHub Actions is enabled and has available build minutes:

1. Ensure the secret **`TAURI_SIGNING_PRIVATE_KEY`** is set under:
   `Repository Settings -> Secrets and variables -> Actions`

2. Tag and push the new version:
   ```powershell
   git tag v0.1.1
   git push origin v0.1.1
   ```

3. GitHub Actions (`.github/workflows/release.yml`) will automatically:
   - Compile the Windows binary
   - Cryptographically sign the bundle
   - Generate `latest.json`
   - Create the published GitHub Release with installers attached.

---

## How Users Receive the Update

1. Installed apps look for updates at:
   `https://github.com/byronjreyes/Agent-Job/releases/latest/download/latest.json`
2. Users open **Settings → Updates** and click **Check for updates** (or the app checks in the background).
3. The app downloads the signed bundle, verifies the cryptographic signature with the public key, and prompts:
   `"Update downloaded! Restart to apply"`.
4. Clicking **Relaunch application** instantly updates the app.
