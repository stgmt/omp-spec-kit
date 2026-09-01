@echo off
setlocal
set "LAUNCHER_DIR=%~dp0"
for %%I in ("%LAUNCHER_DIR%..") do set "OMP_SPEC_KIT_PACKAGE_ROOT=%%~fI"
set "OMP_SPEC_KIT_STAGE=v0.4.1"
node "%LAUNCHER_DIR%..\dist\mcp\server.js" %*
