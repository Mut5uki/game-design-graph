@echo off
title Game Design Graph
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
)

echo.
echo Starting Game Design Graph...
echo Browser: http://localhost:3888
echo LAN:     http://YOUR_LAN_IP:3888
echo Press Ctrl+C to stop.
echo.

call npm run start

echo.
echo Server stopped.
pause
