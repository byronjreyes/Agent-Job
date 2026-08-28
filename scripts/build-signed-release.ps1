<#
.SYNOPSIS
  Builds and signs AgentJob locally for manual GitHub Release when GitHub Actions is unavailable.
.DESCRIPTION
  This script compiles the release binary and installer, signs the update bundle with your private key,
  and produces the signed update bundle + latest.json for GitHub Releases.
#>

param(
  [string]$KeyPath = "$PSScriptRoot/../src-tauri/agentjob.key",
  [string]$Password = ""
)

Write-Host "==> Checking signing key..." -ForegroundColor Cyan
if (-not (Test-Path $KeyPath)) {
  Write-Error "Private key not found at $KeyPath. Run 'npx tauri signer generate' or provide the key path."
  exit 1
}

$env:TAURI_SIGNING_PRIVATE_KEY_PATH = (Resolve-Path $KeyPath).Path
if ($Password) {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $Password
}

Write-Host "==> Building frontend assets..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Building and signing Tauri release..." -ForegroundColor Cyan
npx @tauri-apps/cli build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Build and signing complete!" -ForegroundColor Green
Write-Host "Release artifacts created in: src-tauri/target/release/bundle/"
Write-Host "Upload the .exe / .msi installer and updater artifacts to your GitHub Release."
