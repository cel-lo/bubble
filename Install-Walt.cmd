@echo off
cd /d "%~dp0"
call npm.cmd install --no-audit --no-fund
if errorlevel 1 (
  echo Dependency installation failed. Check internet and DNS connectivity.
  pause
  exit /b 1
)
call npm.cmd run build
if errorlevel 1 exit /b 1
call npm.cmd run package
pause
