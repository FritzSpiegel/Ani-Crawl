@echo off
setlocal

set "ROOT=%~dp0"
set "CRAWLER_DIR=%ROOT%Projektskibidi\apps\server"
set "CLIENT_DIR=%ROOT%AniCrawl - frontend\client"

echo Using ROOT: "%ROOT%"
echo Crawler dir: "%CRAWLER_DIR%"
echo Client dir : "%CLIENT_DIR%"

if not exist "%CRAWLER_DIR%" (
  echo ERROR: Crawler directory not found.
)
if not exist "%CLIENT_DIR%" (
  echo ERROR: Client directory not found.
)

REM ===== Start AniWorld crawler + auth/watchlist API (port 3001) =====
REM Opens in a new window and sets required environment variables
start "Crawler API" cmd /k "pushd ^"%CRAWLER_DIR%^" ^&^& echo PWD: ^& cd ^& if not exist package.json (echo ERROR: package.json not found in crawler dir ^& pause ^& exit /b) ^& set MONGO_URI=mongodb://localhost:27017/aniworld ^&^& set APP_BASE_URL=http://localhost:5173 ^&^& set JWT_SECRET=devsecret ^&^& set ADMIN_EMAIL=admin@mail ^&^& set ADMIN_PASSWORD=password ^&^& set ALLOW_LIVE_FETCH=true ^&^& set STATIC_SEARCH_HTML=.\fixtures\search.html ^&^& set STATIC_DETAIL_HTML=.\fixtures\detail.html ^&^& pnpm install ^&^& pnpm dev"

REM ===== Start React client (port 5173) =====
start "Client" cmd /k "pushd ^"%CLIENT_DIR%^" ^&^& echo PWD: ^& cd ^& if not exist package.json (echo ERROR: package.json not found in client dir ^& pause ^& exit /b) ^& npm install ^& npm run dev"

echo.
echo Launched Crawler API (http://localhost:3001) and Client (http://localhost:5173) in separate windows.
echo Ensure MongoDB is running locally (mongod) before using the app.
echo.
exit /b 0


