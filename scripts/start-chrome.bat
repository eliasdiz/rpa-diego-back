@echo off
echo.
echo ========================================
echo  Iniciando Chrome para Automatizacion
echo ========================================
echo.
echo Chrome se abrira con remote debugging habilitado en puerto 9222
echo.
echo IMPORTANTE:
echo 1. Inicia sesion en Salesforce en este Chrome
echo 2. NO cierres este Chrome
echo 3. Ejecuta la automatizacion con: npm run salesforce-stagehand
echo.
echo ========================================
echo.

REM Intentar abrir Chrome desde varias ubicaciones posibles
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    echo Abriendo Chrome desde Program Files...
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\selenium\ChromeProfile"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    echo Abriendo Chrome desde Program Files (x86)...
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\selenium\ChromeProfile"
) else (
    echo ERROR: No se encontro Chrome en las ubicaciones habituales
    echo.
    echo Por favor, ejecuta manualmente:
    echo "RUTA_A_CHROME\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\selenium\ChromeProfile"
    echo.
    pause
    exit /b 1
)

echo.
echo Chrome iniciado correctamente!
echo.
echo Ahora puedes:
echo 1. Iniciar sesion en Salesforce
echo 2. Ejecutar: npm run salesforce-stagehand
echo.
pause
