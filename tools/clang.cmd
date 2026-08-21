@echo off
setlocal enabledelayedexpansion
set "ZIG=D:\administrator\Documents\project\S-ENC-001\tools\zig-extract\zig-x86_64-windows-0.16.0\zig.exe"
set "args="
:loop
if "%~1"=="" goto done
set "a=%~1"
if "!a!"=="--target=wasm32-unknown-unknown" (
  set "args=!args! --target=wasm32-freestanding"
) else if "!a!"=="wasm32-unknown-unknown" (
  set "args=!args! --target=wasm32-freestanding"
) else if "!a!"=="--target=x86_64-pc-windows-gnu" (
  set "args=!args! --target=x86_64-windows-gnu"
) else if "!a!"=="x86_64-pc-windows-gnu" (
  set "args=!args! --target=x86_64-windows-gnu"
) else (
  set "args=!args! "!a!""
)
shift
goto loop
:done
"%ZIG%" cc !args!
exit /b %errorlevel%