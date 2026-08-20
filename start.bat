@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title S-ENC-001 Local Server

set "ROOT=%~dp0"
set "DIST=%ROOT%dist"
set "PORT=4173"
if not "%~1"=="" set "PORT=%~1"

echo ============================================
echo   S-ENC-001 Local Server
echo ============================================
echo.

rem ===== 1/3 dist check =====
if not exist "%DIST%\index.html" (
  echo [ERROR] dist not found. Run build.bat first.
  pause
  exit /b 1
)
echo   dist: OK
echo.

rem ===== 2/3 runtime detection =====
set "HAS_NODE=0"
set "HAS_PY=0"
set "PY_CMD=python"

where node >nul 2>&1
if %errorlevel% equ 0 set "HAS_NODE=1"

%PY_CMD% --version 2>&1 | findstr /c:"Python 3" >nul
if %errorlevel% equ 0 set "HAS_PY=1"
if "%HAS_PY%"=="0" (
  where py >nul 2>&1
  if !errorlevel! equ 0 (
    set "PY_CMD=py"
    py --version 2>&1 | findstr /c:"Python 3" >nul
    if !errorlevel! equ 0 set "HAS_PY=1"
  )
)

if "%HAS_NODE%"=="0" if "%HAS_PY%"=="0" (
  echo [ERROR] Neither Node.js nor Python 3 is available.
  echo   Install Node.js: https://nodejs.org
  echo   Install Python:  https://python.org
  pause
  exit /b 1
)
echo   Node.js: %HAS_NODE%   Python 3: %HAS_PY%
echo.

rem ===== 3/3 pick runtime and start =====
if "%HAS_NODE%"=="1" if "%HAS_PY%"=="1" (
  set "MODE="
  set /p "MODE=Choose runtime - [N]ode.js / [P]ython (Enter defaults to Node): "
  if /i "!MODE!"=="P" ( set "MODE=python" ) else ( set "MODE=node" )
) else if "%HAS_NODE%"=="1" (
  set "MODE=node"
  echo   Only Node.js found, using Node.js.
) else (
  set "MODE=python"
  echo   Only Python 3 found, using Python.
)
echo.

if "%MODE%"=="node" (
  start "S-ENC-001 Server" cmd /k "node ""%ROOT%serve.mjs"" %PORT%"
) else (
  start "S-ENC-001 Server" cmd /k "%PY_CMD% -m http.server %PORT% --bind 127.0.0.1 --directory ""%DIST%"""
)

ping -n 2 127.0.0.1 >nul
start "" http://localhost:%PORT%/
echo   Server started: http://localhost:%PORT%/
echo   The server runs in its own window. Close that window to stop.
exit /b 0