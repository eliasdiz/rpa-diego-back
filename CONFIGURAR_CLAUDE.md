# 🤖 Configurar Claude API para Automatización de Salesforce

## ¿Por qué Claude?

Claude 3.5 Sonnet es el modelo **RECOMENDADO** para esta automatización porque:
- ✅ Excelente percepción visual de interfaces web
- ✅ $5 USD en créditos GRATUITOS (≈330,000 tokens)
- ✅ Compatible con Stagehand 2.5.2
- ✅ Mejor precisión para tareas de automatización complejas

---

## 📋 Paso 1: Crear Cuenta en Anthropic Console

1. **Ve a:** https://console.anthropic.com/
2. Haz clic en **"Sign Up"**
3. Regístrate con tu **correo electrónico**
4. Verifica tu correo

---

## 💰 Paso 2: Reclamar $5 USD en Créditos Gratuitos

1. Una vez dentro del Console, ve a **Dashboard**
2. Busca la sección **"Claim free credits"** o **"Get free credits"**
3. **Verifica tu número de teléfono**
   - ✅ Números de EE.UU. califican automáticamente
   - ⚠️ Otros países: prueba si tu país califica
   - ❌ Reino Unido está excluido

### ¿Cuánto duran $5 USD?

Con Claude 3.5 Sonnet:
- **330,000 tokens** aproximadamente
- Para automatización de Salesforce: **suficiente para procesar cientos de leads**
- Cada lead usa aproximadamente 1,000-2,000 tokens

---

## 💳 Paso 3: Configurar Billing (NECESARIO)

⚠️ **Importante:** Aunque tengas créditos gratuitos, DEBES configurar billing para que la API key funcione.

1. Ve a **Settings → Billing**
2. Selecciona el plan **"Build"** (Pay-as-you-go)
3. **NO necesitas agregar tarjeta** si solo usas los créditos gratuitos
4. Los créditos gratuitos se usan primero
5. Cuando se acaben, la API simplemente dejará de funcionar (no te cobrarán)

---

## 🔑 Paso 4: Generar tu API Key

1. Ve a **Settings → API Keys**
2. Haz clic en **"+ Create Key"**
3. Dale un nombre descriptivo:
   ```
   Salesforce Automation - Stagehand
   ```
4. **COPIA LA API KEY** (solo se muestra una vez)
   - Formato: `sk-ant-api03-...`

---

## ⚙️ Paso 5: Configurar en tu Proyecto

### 5.1 Editar archivo `.env`

Abre tu archivo `.env` y reemplaza `tu_api_key_aqui` con la API key que copiaste:

```env
# Stagehand - Configuración de modelo de IA

# ✅ OPCIÓN RECOMENDADA: Claude (Anthropic) - $5 USD gratis
# Obtén tu API key en: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-api03-XXXXXXXXXXXXXXXXXX

# ❌ Gemini (Google AI Studio) - NO COMPATIBLE con Stagehand 2.5.2
# GOOGLE_GENERATIVE_AI_API_KEY=AIzaSyCJ67qs5ly2HxWfK125fC8oyvv-KSCM514

# Otras variables de entorno
# NODE_ENV=development
# PORT=3000
```

### 5.2 Verificar la Configuración

El código ya está configurado para usar Claude automáticamente. Verifica que estas líneas estén en `services/automatizacion-salesforce-stagehand.ts`:

```typescript
// Modelo configurado (línea ~108)
modelName: 'claude-3-5-sonnet-20241022'

// Verificación de API key (líneas 36-42)
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ERROR: No se pudo cargar ANTHROPIC_API_KEY');
    process.exit(1);
}
```

---

## 🚀 Paso 6: Probar la Automatización

### 6.1 Abrir Chrome con Remote Debugging

```bash
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\selenium\ChromeProfile"
```

### 6.2 Ejecutar la Automatización

```bash
npm run salesforce-stagehand
```

### 6.3 Verificar que Funciona

Deberías ver:

```
✅ API key de Claude (Anthropic) cargada correctamente
🚀 [hora] === INICIANDO AUTOMATIZACIÓN SALESFORCE CON STAGEHAND ===
📋 [hora] Objetivo: procesar 5 leads con soluciones válidas
⚙️ [hora] Inicializando Stagehand...
✅ [hora] Stagehand inicializado correctamente
```

Si ves este mensaje, ¡Claude está funcionando! 🎉

---

## 📊 Monitorear tu Uso

1. Ve a **Dashboard** en https://console.anthropic.com/
2. Verás tu **balance actual** y **créditos restantes**
3. También puedes ver el **historial de uso** por día

---

## ❓ Preguntas Frecuentes

### ¿Qué pasa cuando se acaban los $5 USD?

La API dejará de funcionar y verás un error:
```
Error: Insufficient credits
```

**Opciones:**
1. Agregar más créditos (mínimo $5 USD)
2. Agregar tarjeta de crédito para pay-as-you-go
3. Cambiar a otro modelo (OpenAI, etc.)

### ¿Es seguro agregar mi tarjeta?

Sí, Anthropic es una empresa seria (creada por ex-miembros de OpenAI). Además:
- Solo te cobran por uso real
- Puedes configurar **límites de gasto** en Settings
- No hay cargos automáticos sorpresa

### ¿Cuánto cuesta después de los créditos gratuitos?

Claude 3.5 Sonnet (octubre 2024):
- **Input:** $3 USD por millón de tokens
- **Output:** $15 USD por millón de tokens

Para automatización:
- Procesar 1000 leads ≈ $5-10 USD

### ¿Puedo usar otro modelo más barato?

Sí, puedes cambiar a **Claude 3.5 Haiku** (más rápido y barato):

```typescript
modelName: 'claude-3-5-haiku-20241022'
```

**Precios Haiku:**
- Input: $0.80 por millón de tokens
- Output: $4 por millón de tokens
- **4x más barato** pero un poco menos preciso

---

## 🆘 Solución de Problemas

### Error: "ANTHROPIC_API_KEY not found"

✅ **Solución:**
1. Verifica que el archivo `.env` existe en la raíz del proyecto
2. Verifica que la línea es exactamente: `ANTHROPIC_API_KEY=sk-ant-...`
3. NO debe haber espacios antes o después del `=`
4. Reinicia el script después de editar `.env`

### Error: "Invalid API key"

✅ **Solución:**
1. Verifica que copiaste la API key completa (empieza con `sk-ant-api03-`)
2. Genera una nueva API key en el Console
3. NO compartas tu API key con nadie

### Error: "Insufficient credits"

✅ **Solución:**
1. Verifica tu balance en https://console.anthropic.com/settings/billing
2. Agrega más créditos si es necesario
3. O cambia a un modelo más barato (Haiku)

---

## 🔗 Enlaces Útiles

- **Console:** https://console.anthropic.com/
- **Documentación:** https://docs.anthropic.com/
- **Precios:** https://www.anthropic.com/pricing
- **Status:** https://status.anthropic.com/

---

## ✅ Checklist Final

Antes de ejecutar la automatización, verifica:

- [ ] Cuenta creada en Anthropic Console
- [ ] $5 USD en créditos reclamados
- [ ] Billing configurado (plan "Build")
- [ ] API key generada y copiada
- [ ] Archivo `.env` actualizado con `ANTHROPIC_API_KEY=sk-ant-...`
- [ ] Chrome abierto con remote debugging en puerto 9222
- [ ] Sesión de Salesforce iniciada en Chrome

¡Listo para automatizar! 🚀
