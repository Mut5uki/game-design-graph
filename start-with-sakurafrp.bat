@echo off
chcp 65001 >nul
title Game Design Graph + Sakura FRP
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
echo ============================================================
echo  樱花 FRP 协作主机
echo ============================================================
echo.
echo  1. 先在 natfrp.com 创建 1 条隧道 → 本地 127.0.0.1:3888
echo     详见 docs\COLLAB_SAKURAFRP.md
echo.
echo  2. 用樱花启动器或 frpc 启动该隧道
echo.
echo  3. 设置里粘贴公网地址 →「套用 Sakura FRP」→ 保存
echo.
echo ============================================================
echo.

if exist "deploy\sakurafrp\frpc.local.cmd" (
    echo 检测到 frpc.local.cmd，正在启动樱花隧道...
    start "Sakura FRP" cmd /k "cd /d "%~dp0deploy\sakurafrp" && call frpc.local.cmd"
    timeout /t 2 /nobreak >nul
) else (
    echo [提示] 未找到 deploy\sakurafrp\frpc.local.cmd，请手动开樱花隧道。
)

start "Game Design Graph - 协作服务" cmd /k "cd /d "%~dp0" && call npm run collab:server"

timeout /t 2 /nobreak >nul

echo 启动前端 http://127.0.0.1:3888 ...
call npm run start

echo.
echo 前端已停止（协作服务 / 樱花窗口可能仍在运行）
pause
