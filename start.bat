@echo off
chcp 65001 >nul
title Game Design Graph
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装：https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo 正在安装依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

echo.
echo 启动 Game Design Graph ...
echo 浏览器将自动打开；同事可用 http://你的局域网IP:3888 访问
echo 按 Ctrl+C 可停止服务器
echo.

call npm run start

echo.
echo 服务器已停止
pause
