@echo off
title Game Design Graph + Sakura FRP
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
)

if not exist "server\node_modules\" (
    echo Installing collab server dependencies...
    call npm run collab:install
    if errorlevel 1 (
        echo [ERROR] collab:install failed
        pause
        exit /b 1
    )
)

echo.
echo ============================================================
echo  Sakura FRP collab host
echo ============================================================
echo  1. Create ONE tunnel at natfrp.com -^> 127.0.0.1:3888
echo     See docs\COLLAB_SAKURAFRP.md
echo  2. Start tunnel in Sakura launcher or frpc
echo  3. Settings - paste public URL - Save
echo ============================================================
echo.

if exist "deploy\sakurafrp\frpc.local.cmd" (
    echo Starting Sakura frpc...
    start "Sakura FRP" /D "%~dp0deploy\sakurafrp" cmd /k call frpc.local.cmd
    timeout /t 2 /nobreak >nul
) else (
    echo [INFO] No deploy\sakurafrp\frpc.local.cmd - start Sakura tunnel manually.
)

echo Starting collab server + frontend (Ctrl+C stops both)...
echo.

call npm run start:collab

echo.
echo Stopped. Sakura frpc window may still be open.
pause
