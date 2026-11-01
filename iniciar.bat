@echo off
title La Carrera mas Linda - Resultados y Diplomas
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encontro Node.js en este equipo.
  echo Puedes abrir directamente el archivo index.html en tu navegador.
  echo.
  pause
  exit /b 1
)
node server.js
pause
