@echo off
setlocal

set "ROOT=%~dp0"
set "WORKSPACE_DIR=%ROOT%Projektskibidi"
set "CMS_DIR=%WORKSPACE_DIR%\apps\cms"
set "SERVER_DIR=%WORKSPACE_DIR%\apps\server"
set "WEB_DIR=%WORKSPACE_DIR%\apps\web"

echo Using ROOT: "%ROOT%"
echo Workspace dir: "%WORKSPACE_DIR%"
echo CMS dir      : "%CMS_DIR%"
echo Server dir   : "%SERVER_DIR%"
echo Web dir      : "%WEB_DIR%"

if not exist "%WORKSPACE_DIR%" (
  echo ERROR: Monorepo directory not found.
  pause
  exit /b 1
)
if not exist "%CMS_DIR%" (
  echo ERROR: CMS directory not found.
  pause
  exit /b 1
)
if not exist "%SERVER_DIR%" (
  echo ERROR: Server directory not found.
  pause
  exit /b 1
)
if not exist "%WEB_DIR%" (
  echo ERROR: Web directory not found.
  pause
  exit /b 1
)

echo.
echo Installing dependencies...
echo.

REM Install pnpm workspace dependencies
echo Installing pnpm workspace dependencies...
cd /d "%WORKSPACE_DIR%"
pnpm install
if errorlevel 1 (
  echo ERROR: Failed to install pnpm dependencies
  pause
  exit /b 1
)

echo Starting headless CMS stack...
echo.

REM ===== Start Strapi CMS (port 1337) =====
start "AniCrawl CMS" cmd /k "cd /d "%WORKSPACE_DIR%" && echo Starting CMS on http://localhost:1337 ... && pnpm --filter cms dev"

REM ===== Start API server (port 3002) =====
start "AniCrawl API" cmd /k "cd /d "%WORKSPACE_DIR%" && echo Starting API on http://localhost:3002 ... && set API_PORT=3002 && pnpm --filter @aniworld/server dev"

REM ===== Start web app (port 5174) =====
start "AniCrawl Web" cmd /k "cd /d "%WORKSPACE_DIR%" && echo Starting Web on http://localhost:5174 ... && pnpm --filter @aniworld/web dev"

echo.
echo Launched CMS (1337), API (3002), and Web (5174) in separate windows.
echo Hinweis: Stelle sicher, dass MongoDB fuer den API-Teil laeuft und Strapi korrekt konfiguriert ist.
echo.
exit /b 0


