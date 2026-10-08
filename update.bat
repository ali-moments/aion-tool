@echo off
git pull
if errorlevel 1 pause & exit /b 1

pnpm run electron:build
if errorlevel 1 pause & exit /b 1

pause