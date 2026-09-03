@echo off
setlocal
set "LAUNCHER_DIR=%~dp0"
for %%I in ("%LAUNCHER_DIR%..") do set "OMP_SPEC_KIT_PACKAGE_ROOT=%%~fI"
node "%LAUNCHER_DIR%..\dist\mcp\server.js" %*
