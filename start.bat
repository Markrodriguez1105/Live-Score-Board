@echo off
title Pageant Management System
cls

echo ===================================================
echo           Pageant Management System
echo ===================================================
echo.

:: 1. Ensure .env exists
if not exist ".env" (
    if exist ".env.example" (
        echo [1/3] Creating .env config file...
        copy .env.example .env >nul
    )
)

:: 2. Try starting Docker Desktop if installed & not running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        echo [INFO] Starting Docker Desktop, please wait...
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        :wait_docker
        timeout /t 3 /nobreak >nul
        docker info >nul 2>&1
        if %errorlevel% neq 0 (
            echo [INFO] Waiting for Docker engine to initialize...
            goto wait_docker
        )
    )
)

:: 3. Launch Docker Compose if Docker is ready
docker info >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Freeing up local ports...
    taskkill /F /IM node.exe >nul 2>&1
    echo.
    echo [INFO] Docker active. Launching full stack app...
    echo.
    echo Admin Panel:      http://localhost/admin   (or http://localhost:5173)
    echo Audience View:    http://localhost/view    (or http://localhost:5174)
    echo Tabulator:        http://localhost/tabulator (or http://localhost:5175)
    echo Judge Interface:  http://localhost/judge   (or http://localhost:5176)
    echo ===================================================
    echo.
    docker compose up --build
    pause
    exit /b
)

:: 4. Fallback to local Node.js environment
echo [INFO] Docker is not active. Checking local MySQL service...
echo.

:: Check if local MySQL is listening on port 3306
netstat -ano | findstr /R /C:":3306  *LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    :: Try starting Windows MySQL service if available
    net start MySQL >nul 2>&1
    net start MySQL80 >nul 2>&1
)

:: Re-check if MySQL is listening on port 3306
netstat -ano | findstr /R /C:":3306  *LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ===================================================
    echo ERROR: MySQL Database is NOT running on port 3306!
    echo ===================================================
    echo.
    echo To fix this issue, please do ONE of the following:
    echo.
    echo   1. Launch Docker Desktop and run start.bat again
    echo   2. Open XAMPP / WampServer and click "Start" next to MySQL
    echo   3. Start Windows MySQL service (net start MySQL)
    echo.
    echo ===================================================
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/2] Installing dependencies...
    call npm install
)

echo [2/2] Starting all services with npm...
call npm run dev

pause
