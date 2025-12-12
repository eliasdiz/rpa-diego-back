@echo off
REM Script para abrir Chrome con Remote Debugging habilitado
REM Necesario para que Stagehand pueda conectarse

echo ========================================
echo Abriendo Chrome con Remote Debugging
echo ========================================
echo.
echo Puerto: 9222
echo Perfil: C:\selenium\ChromeProfile
echo.
echo IMPORTANTE: Deja esta ventana de Chrome abierta
echo mientras ejecutas la automatizacion
echo ========================================
echo.

REM Cerrar Chrome si está abierto (opcional)
taskkill /F /IM chrome.exe 2>nul

REM Esperar 2 segundos
timeout /t 2 /nobreak >nul

REM Abrir Chrome con remote debugging
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\selenium\ChromeProfile"

echo.
echo Chrome abierto correctamente!
echo Ahora puedes ejecutar: npm run salesforce-stagehand
echo.
pause
