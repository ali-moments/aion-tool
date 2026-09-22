@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb runAs"
    exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0AIOT00L.ps1"
