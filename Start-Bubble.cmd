@echo off
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe (
  echo Electron is not installed. Run Install-Bubble.cmd with internet access first.
  pause
  exit /b 1
)
call npm.cmd run build
if errorlevel 1 exit /b 1
call npm.cmd start
