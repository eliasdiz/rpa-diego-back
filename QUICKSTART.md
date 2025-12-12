# 🚀 Guía Rápida - Automatización Salesforce con Stagehand + OpenAI

## ⚡ Setup inicial (5 minutos)

### 1. Configurar API Key de OpenAI

Edita el archivo `.env` en la raíz del proyecto:
```bash
OPENAI_API_KEY=sk-proj-tu-key-real-de-openai-aqui
```

**¿Dónde consigo mi API key?**
- Entra a: https://platform.openai.com/api-keys
- Crea una nueva key
- Cópiala y pégala en el `.env`

### 2. Verificar config.json

El archivo `config/config.json` ya está configurado:
```json
{
  "cantidad": 5,
  "email": "diego.alvarez@asesorsura.com",
  "passwordHash": "Pauli1278#$%"
}
```

### 3. Abrir Chrome con Remote Debugging

⚠️ **IMPORTANTE**: La automatización se conecta a un Chrome existente.

**Opción A: Usar npm script (Recomendado)**
```bash
npm run chrome
```

**Opción B: Usar el script directamente**
```bash
# Bash (Git Bash / WSL)
bash scripts/abrir-chrome-debug.sh

# CMD / PowerShell
scripts\abrir-chrome-debug.bat
```

**Opción C: Comando manual**
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\selenium\ChromeProfile"
```

### 4. Verificar que Chrome está listo

Abre en el navegador: **http://localhost:9222/json**

Deberías ver un JSON con información del navegador. Si ves esto, Chrome está listo ✅

### 5. Iniciar sesión en Salesforce (Opcional pero recomendado)

1. En el Chrome que se abrió, ve a **Salesforce**
2. **Inicia sesión** con tus credenciales
3. Confirma que la sesión está activa
4. **Deja Chrome abierto** (no lo cierres)

---

## 🎯 Ejecutar automatización

### Modo de prueba (recomendado para primera vez)

```bash
npm run test-salesforce
```

Esto procesará **solo 1 lead** para validar que todo funciona.

### Modo normal

```bash
# Usar cantidad de config.json
npm run salesforce-stagehand

# O especificar cantidad
npm run salesforce-stagehand 10
```

### Vía API

```bash
# POST con cantidad opcional
curl -X POST http://localhost:3000/automatizacion-salesforce-stagehand \
  -H "Content-Type: application/json" \
  -d '{"cantidad": 5}'
```

---

## Qué esperar

```
🚀 Inicializa Stagehand (10-15 seg)
   ↓
🌐 Abre Salesforce (5 seg)
   ↓
🔍 Busca nuevos leads
   ↓
📝 Procesa cada lead:
   - Extrae solución con IA (3-5 seg)
   - Valida si es válida
   - Cambia propietario si aplica (5-8 seg)
   ↓
✅ Completa cuando alcanza cantidad objetivo
```

**Tiempo aproximado por lead**: 10-15 segundos

---

## Soluciones válidas procesadas

✅ Plan vive
✅ Salud familiar
✅ Salud evoluciona familiar
✅ Plan crédito protegido

Los demás se saltan automáticamente.

---

## Troubleshooting rápido

| Problema | Solución |
|----------|----------|
| "GEMINI_API_KEY not found" | Crear archivo `.env` con la API key |
| "Session expired" | Iniciar sesión en Salesforce manualmente |
| "No hay leads disponibles" | Verificar que la vista tiene leads |
| "Error al cambiar propietario" | Verificar permisos en Salesforce |

---

## Ver documentación completa

```bash
# Leer el README completo
cat SALESFORCE_STAGEHAND_README.md
```

---

## Scripts disponibles

```bash
npm run test-salesforce          # Prueba con 1 lead
npm run salesforce-stagehand     # Ejecutar automatización
npm run salesforce-stagehand 10  # Ejecutar con cantidad específica
```

---

## Próximos pasos

1. Ejecuta `npm run test-salesforce` para validar
2. Si funciona, ejecuta con más leads
3. Revisa los logs para entender el comportamiento
4. Ajusta `config.json` según necesites

---

**¿Problemas?** Lee el README completo: `SALESFORCE_STAGEHAND_README.md`
