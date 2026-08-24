@echo off
setlocal
set "LAUNCHER_DIR=%~dp0"
node "%LAUNCHER_DIR%..\dist\mcp\server.js" %*
exit /b %ERRORLEVEL%
