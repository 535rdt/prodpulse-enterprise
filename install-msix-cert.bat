@echo off
:: Batch script to install Antigravity MSIX certificate into Trusted People
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script must be run as Administrator!
    echo Right-click this file and choose "Run as administrator".
    pause
    exit /b 1
)

echo Installing certificate to Local Machine Trusted People store...
certutil.exe -addstore TrustedPeople "%~dp0certs\antigravity.cer"

if %errorLevel% equ 0 (
    echo.
    echo [SUCCESS] Certificate installed successfully!
    echo You can now double-click "ProductionApp.msix" and click Install.
) else (
    echo.
    echo [FAILED] Failed to install certificate.
)
pause
