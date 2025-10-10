@echo off
setlocal

set "ROOT=%~dp0"
set "WORKSPACE_DIR=%ROOT%Projektskibidi"
set "CRAWLER_DIR=%ROOT%Projektskibidi\apps\server"
set "CLIENT_DIR=%ROOT%AniCrawl - frontend\client"

echo Using ROOT: "%ROOT%"
echo Workspace dir: "%WORKSPACE_DIR%"
echo Crawler dir: "%CRAWLER_DIR%"
echo Client dir : "%CLIENT_DIR%"

if not exist "%CRAWLER_DIR%" (
  echo ERROR: Crawler directory not found.
  pause
  exit /b 1
)
if not exist "%CLIENT_DIR%" (
  echo ERROR: Client directory not found.
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

REM Install client dependencies
echo Installing client dependencies...
cd /d "%CLIENT_DIR%"
npm install
if errorlevel 1 (
  echo ERROR: Failed to install npm dependencies
  pause
  exit /b 1
)

echo.
echo Starting servers...
echo.

REM ===== Start AniWorld crawler + auth/watchlist API (port 3001) =====
REM Opens in a new window and sets required environment variables
start "Crawler API" cmd /k "cd /d "%CRAWLER_DIR%" && echo Starting Crawler API... && set MONGO_URI=mongodb://localhost:27017/aniworld && set APP_BASE_URL=http://localhost:5173 && set JWT_SECRET=devsecret && set ADMIN_EMAIL=admin@mail && set ADMIN_PASSWORD=password && set ALLOW_LIVE_FETCH=true && set STATIC_SEARCH_HTML=.\fixtures\search.html && set STATIC_DETAIL_HTML=.\fixtures\detail.html && pnpm dev"

REM ===== Start React client (port 5173) =====
start "Client" cmd /k "cd /d "%CLIENT_DIR%" && echo Starting Client... && npm run dev"

echo.
echo Launched Crawler API (http://localhost:3001) and Client (http://localhost:5173) in separate windows.
echo Ensure MongoDB is running locally (mongod) before using the app.
echo.
exit /b 0


