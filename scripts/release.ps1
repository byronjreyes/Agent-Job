<#
.SYNOPSIS
  1-Click Automated Release Script for AgentJob
.DESCRIPTION
  1. Automatically increments patch version in package.json & tauri.conf.json
  2. Commits & pushes code to GitHub repository
  3. Builds & cryptographically signs the Tauri release
  4. Collects all release assets into a clean 'dist_release/vX.X.X/' folder
  5. Opens the release folder and GitHub new release page in browser for instant drag-and-drop.
#>

param(
  [string]$CommitMessage = "",
  [string]$KeyPath = "$PSScriptRoot/../src-tauri/agentjob.key",
  [string]$Password = ""
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   AgentJob Automated 1-Click Release   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Check signing key
if (-not (Test-Path $KeyPath)) {
  Write-Error "Private signing key not found at $KeyPath."
  exit 1
}

$RootPath = (Resolve-Path "$PSScriptRoot/..").Path
Set-Location $RootPath

# 2. Read and bump version
$PackageJsonPath = "$RootPath/package.json"
$TauriConfPath = "$RootPath/src-tauri/tauri.conf.json"

$PackageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
$CurrentVersion = $PackageJson.version

$VersionParts = $CurrentVersion.Split('.')
if ($VersionParts.Length -eq 3) {
  $Major = [int]$VersionParts[0]
  $Minor = [int]$VersionParts[1]
  $Patch = [int]$VersionParts[2] + 1
  $NewVersion = "$Major.$Minor.$Patch"
} else {
  $NewVersion = "0.1.1"
}

Write-Host "`n==> Incrementing version: v$CurrentVersion -> v$NewVersion" -ForegroundColor Green

# Update package.json
$PackageJson.version = $NewVersion
$PackageJson | ConvertTo-Json -Depth 10 | Set-Content $PackageJsonPath -Encoding UTF8

# Update tauri.conf.json
$TauriConf = Get-Content $TauriConfPath -Raw | ConvertFrom-Json
$TauriConf.version = $NewVersion
$TauriConf | ConvertTo-Json -Depth 10 | Set-Content $TauriConfPath -Encoding UTF8

# 3. Git commit and push changes
Write-Host "`n==> Pushing updated code and version to GitHub..." -ForegroundColor Cyan
if (-not $CommitMessage) {
  $CommitMessage = "feat: release v$NewVersion"
}

git add .
git commit -m $CommitMessage
git push origin main

# 4. Set signing environment variable and build
Write-Host "`n==> Compiling and cryptographically signing release binaries..." -ForegroundColor Cyan
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = (Resolve-Path $KeyPath).Path
if ($Password) {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $Password
}

# Build frontend
npm run build

# Build Tauri
npx @tauri-apps/cli build

# 5. Gather all release assets into a clean folder
$DistFolder = "$RootPath/dist_release/v$NewVersion"
if (Test-Path $DistFolder) {
  Remove-Item -Recurse -Force $DistFolder
}
New-Item -ItemType Directory -Path $DistFolder | Out-Null

$BundleRoot = "$RootPath/src-tauri/target/release/bundle"

# Copy NSIS exe
Get-ChildItem -Path "$BundleRoot/nsis" -Filter "*$NewVersion*.exe" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
  Copy-Item $_.FullName -Destination $DistFolder -Force
}

# Copy MSI
Get-ChildItem -Path "$BundleRoot/msi" -Filter "*$NewVersion*.msi" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
  Copy-Item $_.FullName -Destination $DistFolder -Force
}

# Copy latest.json, zip, sig updater payloads
Get-ChildItem -Path $BundleRoot -Include "*.json","*.zip","*.sig","*.tar.gz" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
  Copy-Item $_.FullName -Destination $DistFolder -Force
}

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  RELEASE v$NewVersion READY FOR GITHUB!  " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "All assets collected in: $DistFolder" -ForegroundColor Yellow

# 6. Open release folder in Windows Explorer
Start-Process explorer.exe -ArgumentList $DistFolder

# 7. Open GitHub Release creator page in default browser
$ReleaseUrl = "https://github.com/byronjreyes/Agent-Job/releases/new?tag=v$NewVersion&title=AgentJob%20v$NewVersion"
Start-Process $ReleaseUrl

Write-Host "`n-> Browser opened: Just drag and drop all files from the opened folder into GitHub and click 'Publish release'!" -ForegroundColor Cyan
