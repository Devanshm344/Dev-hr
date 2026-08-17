@echo off
REM This just hands off to start.ps1, which does the real work.
REM PowerShell can reliably kill uvicorn's reloader / npm's node
REM children on Ctrl+C; plain batch (start /B) cannot.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
exit /b %errorlevel%
