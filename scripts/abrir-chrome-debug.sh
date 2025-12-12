#!/bin/bash
# Script para abrir Chrome con Remote Debugging habilitado
# Necesario para que Stagehand pueda conectarse

echo "========================================"
echo "Abriendo Chrome con Remote Debugging"
echo "========================================"
echo ""
echo "Puerto: 9222"
echo "Perfil: C:/selenium/ChromeProfile"
echo ""
echo "IMPORTANTE: Deja esta ventana de Chrome abierta"
echo "mientras ejecutas la automatización"
echo "========================================"
echo ""

# Crear directorio si no existe
mkdir -p /c/selenium/ChromeProfile

# Cerrar Chrome si está abierto (opcional)
taskkill.exe //F //IM chrome.exe 2>/dev/null || true

# Esperar 2 segundos
sleep 2

# Abrir Chrome con remote debugging
"/c/Program Files/Google/Chrome/Application/chrome.exe" \
    --remote-debugging-port=9222 \
    --user-data-dir="C:\\selenium\\ChromeProfile" &

echo ""
echo "✅ Chrome abierto correctamente!"
echo "🚀 Ahora puedes ejecutar: npm run salesforce-stagehand"
echo ""
