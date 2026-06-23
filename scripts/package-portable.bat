@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "ROOT=%~dp0.."
set "BUILD_DIR=%ROOT%\src-tauri\target\i686-pc-windows-msvc\release"
set "EXE=%BUILD_DIR%\inbox-tray.exe"
set "STAGE=%ROOT%\portable\app"
set "BOOTSTRAPPER=%ROOT%\portable\MicrosoftEdgeWebview2Setup.exe"
set "LAUNCHER=%ROOT%\portable\启动 InboxTray.bat"
set "OUTPUT=%ROOT%\InboxTray_0.1.0_x86_Portable.zip"

if not exist "%EXE%" (
    echo [错误] 未找到编译产物，请先运行 npm run tauri build
    exit /b 1
)

if not exist "%BOOTSTRAPPER%" (
    echo [错误] 未找到 WebView2 引导器，请下载至 portable\MicrosoftEdgeWebview2Setup.exe
    echo         下载地址: https://go.microsoft.com/fwlink/p/?LinkId=2124703
    exit /b 1
)

if not exist "%LAUNCHER%" (
    echo [错误] 未找到启动脚本 portable\启动 InboxTray.bat
    exit /b 1
)

rmdir /s /q "%STAGE%" 2>nul
mkdir "%STAGE%"

copy "%EXE%" "%STAGE%\" >nul
copy "%BOOTSTRAPPER%" "%STAGE%\" >nul
copy "%LAUNCHER%" "%STAGE%\" >nul

del "%OUTPUT%" 2>nul

echo 正在打包便携版...
powershell -Command "Compress-Archive -Path '%STAGE%\*' -DestinationPath '%OUTPUT%' -Force"

rmdir /s /q "%STAGE%" 2>nul

echo 完成: %OUTPUT%
endlocal
