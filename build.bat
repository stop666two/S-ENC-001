@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title S-ENC-001 Build Tool
echo ============================================
echo   S-ENC-001 One-Click Build
echo ============================================
echo.

rem ===== 1/6 Prerequisites =====
echo [1/6] Checking environment...
where rustc >nul 2>&1 || ( echo [ERROR] Rust not found. Install: https://rustup.rs & pause & exit /b 1 )
echo   Rust: OK
where node >nul 2>&1 || ( echo [ERROR] Node.js not found. Install Node 18+: https://nodejs.org & pause & exit /b 1 )
echo   Node.js: OK

rem ===== 2/6 wasm-pack =====
echo [2/6] Checking wasm-pack...
set "WASM_PACK=%USERPROFILE%\.cargo\bin\wasm-pack.exe"
where wasm-pack >nul 2>&1
if %errorlevel% neq 0 (
  if exist "%WASM_PACK%" ( set "PATH=%USERPROFILE%\.cargo\bin;%PATH%" ) else ( call :install_wasmpack )
)
echo   wasm-pack: OK
echo.

rem ===== 3/6 wasm32 target =====
echo [3/6] Checking wasm32 target...
rustup target list --installed | findstr "wasm32-unknown-unknown" >nul
if %errorlevel% neq 0 ( rustup target add wasm32-unknown-unknown )
echo   wasm32-unknown-unknown: OK
echo.

rem ===== 4/6 zig/clang =====
echo [4/6] Checking C compiler (zig)...
set "ZIG_DIR=%~dp0tools\\zig-extract\\zig-x86_64-windows-0.16.0"
set "ZIG_EXE=%ZIG_DIR%\\zig.exe"
set "CC_WRAPPER=%~dp0tools\\clang.cmd"
if not exist "%ZIG_EXE%" call :install_zig
if not exist "%ZIG_EXE%" ( echo [ERROR] zig missing. Manual: https://ziglang.org/download/ & pause & exit /b 1 )
if not exist "%CC_WRAPPER%" ( echo [ERROR] Missing wrapper: %CC_WRAPPER% & pause & exit /b 1 )
echo   zig/clang: OK
echo.

rem ===== 5/6 Build WASM =====
echo [5/6] Building WASM core...
set "CC=%CC_WRAPPER%"
set "CC_wasm32_unknown_unknown=%CC_WRAPPER%"
cd /d "%~dp0wasm"
call wasm-pack build --target web --release
if %errorlevel% neq 0 ( echo [ERROR] WASM build failed & pause & exit /b 1 )
echo   WASM done
echo.

rem ===== 6/6 Frontend =====
echo [6/6] Syncing WASM + installing deps + building frontend...
cd /d "%~dp0"
if not exist "public\\wasm" mkdir "public\\wasm"
xcopy /E /Y "wasm\\pkg\\*" "public\\wasm\\" >nul 2>&1
call npm install
if %errorlevel% neq 0 ( echo [ERROR] npm install failed & pause & exit /b 1 )
call npm run build
if %errorlevel% neq 0 ( echo [ERROR] frontend build failed & pause & exit /b 1 )
echo.
echo ============================================
echo   BUILD COMPLETE!
echo   Output: %~dp0dist\\
echo ============================================
echo.
echo   Deploy dist/ to any static server.
echo   Dev mode: npm run dev
echo.
pause
endlocal
exit /b 0

:install_wasmpack
powershell -NoProfile -ExecutionPolicy Bypass -Command "$v=(Invoke-RestMethod -Uri 'https://api.github.com/repos/rustwasm/wasm-pack/releases/latest' -Headers @{'User-Agent'='build'}).tag_name; $u='https://github.com/rustwasm/wasm-pack/releases/download/'+$v+'/wasm-pack-init.exe'; Invoke-WebRequest -Uri $u -OutFile $env:TEMP\wasm-pack-init.exe; Start-Process -FilePath $env:TEMP\wasm-pack-init.exe -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART' -Wait; Start-Sleep -Seconds 2; if (Test-Path $env:USERPROFILE\.cargo\bin\wasm-pack.exe) { exit 0 } else { exit 1 }"
exit /b %errorlevel%

:install_zig
powershell -NoProfile -ExecutionPolicy Bypass -Command "$json=Invoke-RestMethod -Uri 'https://ziglang.org/download/index.json'; $url=$json.'0.16.0'.'x86_64-windows'.tarball; Invoke-WebRequest -Uri $url -OutFile '%~dp0tools\\zig.zip'; Expand-Archive -Path '%~dp0tools\\zig.zip' -DestinationPath '%~dp0tools\\zig-extract' -Force"
exit /b %errorlevel%