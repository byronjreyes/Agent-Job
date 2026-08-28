@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo     AgentJob 1-Click Update, Build ^& Release
echo ===================================================
echo.

set /p MSG="Enter commit/release message (or press Enter for default): "

if "%MSG%"=="" (
    powershell -ExecutionPolicy Bypass -File "%~dp0scripts\release.ps1"
) else (
    powershell -ExecutionPolicy Bypass -File "%~dp0scripts\release.ps1" -CommitMessage "%MSG%"
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build or release failed. Check logs above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [SUCCESS] Release completed successfully!
pause
