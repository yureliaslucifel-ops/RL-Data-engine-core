@echo off
REM Ajuste le chemin si nécessaire
cd /d "%~dp0\.."
REM si exe est dans Program Files après extraction, remplace le chemin
if exist "C:\Program Files\RLDataEngine\rl-data-engine.exe" (
  "C:\Program Files\RLDataEngine\rl-data-engine.exe"
) else (
  REM sinon essaie dans le repo local (utile pour debug)
  if exist ".\rl-data-engine.exe" (
    .\rl-data-engine.exe
  ) else (
    echo rl-data-engine.exe introuvable
    pause
  )
)
