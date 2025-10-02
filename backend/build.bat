@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

where go >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Erreur: Go n'est pas installé
    exit /b 1
)

if "%1"=="" (
    echo Usage: build.bat [PLATFORM]
    echo.
    echo Plateformes disponibles:
    echo   windows-amd64, windows-386, windows-arm64
    echo   linux-amd64, linux-386, linux-arm64, linux-arm
    echo   darwin-amd64, darwin-arm64
    echo   rpi-arm64, rpi-arm32, rpi-armv6
    echo.
    exit /b 1
)

set "DIST_DIR=..\dist"
set "LDFLAGS=-s -w"

for /f "delims=" %%v in ('git describe --tags --always 2^>nul') do set VERSION=%%v
if "%VERSION%"=="" set VERSION=dev
set LDFLAGS=%LDFLAGS% -X main.Version=%VERSION%

if not exist "%DIST_DIR%" mkdir "%DIST_DIR%"

set "PLATFORM=%1"

REM Windows
if "%PLATFORM%"=="windows-amd64" (
    set GOOS=windows& set GOARCH=amd64& set GOARM=& set "OUTPUT=%DIST_DIR%\fisheye-windows-amd64.exe"
) else if "%PLATFORM%"=="windows-386" (
    set GOOS=windows& set GOARCH=386& set GOARM=& set "OUTPUT=%DIST_DIR%\fisheye-windows-386.exe"
) else if "%PLATFORM%"=="windows-arm64" (
    set GOOS=windows& set GOARCH=arm64& set GOARM=& set "OUTPUT=%DIST_DIR%\fisheye-windows-arm64.exe"

REM Linux
) else if "%PLATFORM%"=="linux-amd64" (
    set GOOS=linux& set GOARCH=amd64& set GOARM=& set "OUTPUT=%DIST_DIR%\fisheye-linux-amd64"
) else if "%PLATFORM%"=="linux-386" (
    set GOOS=linux& set GOARCH=386& set GOARM=& set "OUTPUT=%DIST_DIR%\fisheye-linux-386"
) else if "%PLATFORM%"=="linux-arm64" (
    set GOOS=linux& set GOARCH=arm64& set GOARM=& set "OUTPUT=%DIST_DIR%\fisheye-linux-arm64"
) else if "%PLATFORM%"=="linux-arm" (
    set GOOS=linux& set GOARCH=arm& set GOARM=7& set "OUTPUT=%DIST_DIR%\fisheye-linux-arm"

REM macOS
) else if "%PLATFORM%"=="darwin-amd64" (
    set GOOS=darwin& set GOARCH=amd64& set GOARM=& set "OUTPUT=%DIST_DIR%\fisheye-darwin-amd64"
) else if "%PLATFORM%"=="darwin-arm64" (
    set GOOS=darwin& set GOARCH=arm64& set GOARM=& set "OUTPUT=%DIST_DIR%\fisheye-darwin-arm64"

REM Raspberry Pi
) else if "%PLATFORM%"=="rpi-arm64" (
    set GOOS=linux& set GOARCH=arm64& set GOARM=& set "OUTPUT=%DIST_DIR%\fisheye-rpi-arm64"
) else if "%PLATFORM%"=="rpi-arm32" (
    set GOOS=linux& set GOARCH=arm& set GOARM=7& set "OUTPUT=%DIST_DIR%\fisheye-rpi-arm32"
) else if "%PLATFORM%"=="rpi-armv6" (
    set GOOS=linux& set GOARCH=arm& set GOARM=6& set "OUTPUT=%DIST_DIR%\fisheye-rpi-armv6"

) else (
    echo Plateforme inconnue: %PLATFORM%
    exit /b 1
)

echo Build: %PLATFORM% (version %VERSION%)

set "start_time=%time%"
set CGO_ENABLED=0
go build -ldflags="%LDFLAGS%" -o "%OUTPUT%" main.go 2>nul

if %ERRORLEVEL% EQU 0 (
    for %%A in ("%OUTPUT%") do set /a "sizeMB=%%~zA / 1048576"
    
    for /f "tokens=1-3 delims=:." %%a in ("%start_time%") do set /a "start_sec=(%%a*3600)+(%%b*60)+%%c"
    for /f "tokens=1-3 delims=:." %%a in ("%time%") do set /a "end_sec=(%%a*3600)+(%%b*60)+%%c"
    set /a "elapsed=end_sec-start_sec"
    if !elapsed! LSS 0 set /a "elapsed+=86400"
    
    echo Succès - !sizeMB! MB - !elapsed!s
) else (
    echo Erreur de compilation
    exit /b 1
)

exit /b 0