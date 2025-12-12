# 🚀 Cómo Usar la Automatización Salesforce con Stagehand

## ✅ Todo está listo!

Ya tienes todo configurado:
- ✅ API key de Gemini configurada en `.env`
- ✅ Configuración de Salesforce en `config/config.json`
- ✅ Script para abrir Chrome en `scripts/start-chrome.bat`
- ✅ Automatización lista en `services/automatizacion-salesforce-stagehand.ts`

---

## 📋 Pasos para ejecutar (3 minutos)

### Paso 1: Abrir Chrome con Remote Debugging

**Opción A: Doble clic en el script** ⭐ MÁS FÁCIL
```
1. Ve a la carpeta: scripts/
2. Doble clic en: start-chrome.bat
3. Chrome se abrirá automáticamente
```

**Opción B: Desde terminal**
```bash
# Desde la raíz del proyecto
scripts\start-chrome.bat
```

**Opción C: Comando manual**
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\selenium\ChromeProfile"
```

> 💡 **Tip**: Verás que Chrome se abre con un mensaje amarillo arriba que dice "Chrome está siendo controlado por software de pruebas automatizadas"

---

### Paso 2: Iniciar Sesión en Salesforce

En el Chrome que se acaba de abrir:

1. Ve a: `https://sura.lightning.force.com`
2. Inicia sesión con:
   - Email: `diego.alvarez@asesorsura.com`
   - Password: `Pauli1278#$%`
3. Espera a que cargue completamente
4. **NO CIERRES este Chrome**

---

### Paso 3: Ejecutar la Automatización

Abre una **nueva terminal** (CMD o PowerShell) en la carpeta del proyecto:

**Modo de prueba (1 lead)** - Recomendado para primera vez:
```bash
npm run test-salesforce
```

**Modo normal (5 leads según config.json):**
```bash
npm run salesforce-stagehand
```

**Con cantidad específica:**
```bash
npm run salesforce-stagehand 10
```

---

## 🎬 Qué esperar

Verás logs como estos:

```
🚀 [10:42:01] === INICIANDO AUTOMATIZACIÓN SALESFORCE ===
📋 [10:42:01] Objetivo: procesar 5 leads
⚙️ [10:42:02] Inicializando Stagehand...
✅ [10:42:05] Stagehand inicializado
🌐 [10:42:05] Navegando a vista de leads...
✅ [10:42:10] Página de prospectos cargada
🔍 [10:42:15] Buscando nuevo lead disponible...
📝 [10:42:18] Lead 1: "Ana María Gómez"
🔍 [10:42:20] Extrayendo solución del lead...
📊 [10:42:22] Solución encontrada: "Plan vive"
✅ [10:42:22] Solución "Plan vive" es VÁLIDA
🤖 [10:42:25] Ejecutando cambio de propietario...
✅ [10:42:30] ÉXITO - Lead asignado (1/5)
🎯 [10:42:30] Lead: "Ana María Gómez" | Solución: "Plan vive" ✅
```

**Tiempo aproximado:** 10-15 segundos por lead

---

## 🎯 Soluciones que se procesan

La automatización solo procesa leads con estas soluciones:

✅ Plan vive
✅ Salud familiar
✅ Salud evoluciona familiar
✅ Plan crédito protegido

Los demás leads se saltan automáticamente.

---

## 🔍 Mientras se ejecuta

Puedes ver en el Chrome cómo el agente:
1. 🔍 Busca nuevos leads en la tabla
2. 🖱️ Hace clic en el nombre del lead
3. 📋 Lee el campo "Solución"
4. ✅ Verifica si es válida
5. 🤖 Hace clic en "Cambiar propietario"
6. 👤 Selecciona "Diego Ignacio Alvarez Franco"
7. ✅ Confirma el cambio
8. 🔙 Vuelve a la lista

---

## ❌ Si algo sale mal

### "Error: connect ECONNREFUSED localhost:9222"

**Causa:** Chrome no está abierto con remote debugging

**Solución:**
```bash
# Ejecuta el script nuevamente
scripts\start-chrome.bat
```

---

### "Session expired" o redirección a login

**Causa:** La sesión de Salesforce expiró

**Solución:**
1. En el Chrome con debugging, recarga Salesforce
2. Inicia sesión nuevamente
3. Vuelve a ejecutar la automatización

---

### "No hay nuevos leads disponibles"

**Causa:** No hay leads en la vista o todos ya fueron procesados

**Solución:**
1. Verifica manualmente que hay leads en:
   `https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead`
2. Si no hay, espera a que lleguen nuevos leads

---

### "No se pudo extraer solución"

**Causa:** El lead no tiene el campo "Solución" o está vacío

**Solución:** Esto es normal, el agente saltará ese lead y continuará con el siguiente

---

## 🛑 Detener la automatización

Si necesitas detener la automatización:

1. Presiona `Ctrl + C` en la terminal
2. O cierra la terminal

El Chrome permanecerá abierto para que puedas inspeccionar.

---

## 🔄 Ejecutar nuevamente

Para ejecutar otra vez:

**Si Chrome sigue abierto:**
```bash
# Solo ejecuta directamente
npm run salesforce-stagehand
```

**Si Chrome se cerró:**
```bash
# 1. Abre Chrome nuevamente
scripts\start-chrome.bat

# 2. Inicia sesión en Salesforce

# 3. Ejecuta la automatización
npm run salesforce-stagehand
```

---

## 📊 Vía API (Opcional)

También puedes ejecutar desde tu aplicación web:

```bash
# POST request
curl -X POST http://localhost:3000/automatizacion-salesforce-stagehand \
  -H "Content-Type: application/json" \
  -d '{"cantidad": 5}'
```

O desde JavaScript:
```javascript
fetch('http://localhost:3000/automatizacion-salesforce-stagehand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cantidad: 5 })
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## 📝 Cambiar configuración

### Cambiar cantidad de leads a procesar

Edita `config/config.json`:
```json
{
  "cantidad": 10  // <-- Cambia este número
}
```

### Cambiar usuario destino

Edita `services/automatizacion-salesforce-stagehand.ts`:

Busca la línea (aprox. línea 588):
```typescript
await page.act({
    action: 'select the user "Diego Ignacio Alvarez Franco" from the list'
});
```

Cambia el nombre del usuario.

---

## 🎓 Próximos pasos

1. ✅ Ejecuta primero con `npm run test-salesforce` (solo 1 lead)
2. ✅ Verifica que todo funciona
3. ✅ Ejecuta con más leads: `npm run salesforce-stagehand`
4. ✅ Monitorea los logs
5. ✅ Ajusta configuración según necesites

---

## 📚 Más información

- **Guía rápida:** `QUICKSTART.md`
- **Documentación completa:** `SALESFORCE_STAGEHAND_README.md`
- **Código fuente:** `services/automatizacion-salesforce-stagehand.ts`

---

## 🆘 Soporte

Si tienes problemas:
1. Lee el troubleshooting en `SALESFORCE_STAGEHAND_README.md`
2. Revisa los logs detallados en la terminal
3. Verifica que Chrome está abierto con debugging
4. Confirma que la sesión de Salesforce está activa

---

**¡Listo para automatizar!** 🚀
