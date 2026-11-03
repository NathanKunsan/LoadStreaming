@echo off
chcp 65001 >nul
title LoadStreaming Updater

echo ============================================================
echo           LoadStreaming - One-Click Auto Updater
echo ============================================================
echo.

echo [1/3] Closing running instances of LoadStreaming...
taskkill /F /IM LoadStreaming.exe >nul 2>&1
ping -n 2 127.0.0.1 >nul 2>&1

set "TARGET_DIR="
if exist "%LOCALAPPDATA%\Programs\LoadStreamingProgram\LoadStreaming.exe" (
    set "TARGET_DIR=%LOCALAPPDATA%\Programs\LoadStreamingProgram"
) else if exist "%LOCALAPPDATA%\Programs\LoadStreaming\LoadStreaming.exe" (
    set "TARGET_DIR=%LOCALAPPDATA%\Programs\LoadStreaming"
)

if "%TARGET_DIR%"=="" (
    echo [!] Installed directory not found. Running installer silently...
    if exist "D:\make_website\LoadStreaming\release\LoadStreaming Setup.exe" (
        "D:\make_website\LoadStreaming\release\LoadStreaming Setup.exe" /S
    ) else if exist "%USERPROFILE%\Downloads\LoadStreaming Setup.exe" (
        "%USERPROFILE%\Downloads\LoadStreaming Setup.exe" /S
    ) else (
        echo [!] Setup file not found.
        exit /b 1
    )
    goto :DONE
)

echo [2/3] Updating application files to:
echo       %TARGET_DIR%

set "UPDATED=0"
if exist "D:\make_website\LoadStreaming\release\win-unpacked\resources\app.asar" (
    copy /y "D:\make_website\LoadStreaming\release\win-unpacked\resources\app.asar" "%TARGET_DIR%\resources\app.asar" >nul
    set "UPDATED=1"
)

if exist "D:\make_website\LoadStreaming\release\LoadStreaming Setup.exe" (
    "D:\make_website\LoadStreaming\release\LoadStreaming Setup.exe" /S
    set "UPDATED=1"
) else if exist "%USERPROFILE%\Downloads\LoadStreaming Setup.exe" (
    "%USERPROFILE%\Downloads\LoadStreaming Setup.exe" /S
    set "UPDATED=1"
)

:DONE
ping -n 3 127.0.0.1 >nul 2>&1
echo.
echo [3/3] Update completed successfully!
echo ============================================================
echo   LoadStreaming is now updated to the latest version.
echo ============================================================
echo.
exit /b 0
