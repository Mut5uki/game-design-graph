@echo off
chcp 65001 >nul
title Game Design Graph - 协作服务
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装：https://nodejs.org/
    pause
    exit /b 1
)

if not exist "server\node_modules\" (
    echo 正在安装协作服务依赖，请稍候...
    call npm install --prefix server
    if errorlevel 1 (
        echo [错误] 协作服务依赖安装失败
        pause
        exit /b 1
    )
)

echo.
echo 启动协作 WebSocket 服务 ...
echo 地址：ws://localhost:1234
echo 按 Ctrl+C 可停止
echo.

call npm run collab:server

echo.
echo 协作服务已停止
pause
