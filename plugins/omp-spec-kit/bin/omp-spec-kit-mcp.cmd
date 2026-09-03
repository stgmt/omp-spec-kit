@echo off
setlocal
set "LAUNCHER_DIR=%~dp0"
for %%I in ("%LAUNCHER_DIR%..") do set "OMP_SPEC_KIT_PACKAGE_ROOT=%%~fI"
if not defined OMP_SPEC_KIT_STAGE set "OMP_SPEC_KIT_STAGE=v0.7.0"
node "%LAUNCHER_DIR%..\dist\mcp\server.js" %*
