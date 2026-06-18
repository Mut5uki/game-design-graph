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
    echo 正在安装前端依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo [错误] 前端依赖安装失败
        pause
        exit /b 1
    )
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
echo 将打开两个窗口：
echo   1. 协作 WebSocket  ws://127.0.0.1:1234 （本机，经 3888/collab 转发）
echo   2. 前端编辑器      http://本机IP:3888 （同事只访问此端口）
echo.
echo 设置里点「检测 IP · 服务器模式」，保存后把邀请链接发给同事。
echo 防火墙只需放行 3888（1234 不必对局域网开放）。
echo.

start "Game Design Graph - 协作服务" cmd /k "cd /d "%~dp0" && call npm run collab:server"

timeout /t 2 /nobreak >nul

echo 启动前端 ...
call npm run start

echo.
echo 前端已停止（协作服务窗口可能仍在运行）
pause
