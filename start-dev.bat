@echo off
echo Starting development server...
cd /d "%~dp0"

REM Check if package.json exists
if not exist "package.json" (
    echo Error: package.json not found in current directory
    echo Current directory: %CD%
    pause
    exit /b 1
)

REM Check if node_modules exists, if not run npm install
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Error during npm install
        pause
        exit /b 1
    )
)

echo Starting development server...
call npm run dev
if errorlevel 1 (
    echo Error during npm run dev
    pause
    exit /b 1
)
pause 