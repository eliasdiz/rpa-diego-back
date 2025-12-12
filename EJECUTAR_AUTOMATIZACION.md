# 🚀 Cómo Ejecutar la Automatización de Salesforce

## Prerrequisitos

### 1. API Key de Claude (Anthropic) ✅

**RECOMENDADO:** Claude 3.5 Sonnet - $5 USD gratis (≈330,000 tokens)

```env
ANTHROPIC_API_KEY=tu_api_key_aqui
```

📖 **[VER GUÍA COMPLETA: CONFIGURAR_CLAUDE.md](CONFIGURAR_CLAUDE.md)**

**Pasos rápidos:**
1. Ve a https://console.anthropic.com/ y crea una cuenta
2. Reclama $5 USD en créditos gratuitos (Dashboard → Claim free credits)
3. Configura billing (Settings → Billing → Plan "Build")
4. Genera tu API key (Settings → API Keys → Create Key)
5. Copia la key a tu archivo `.env`

---

#### ⚠️ Alternativas (NO recomendadas actualmente)

<details>
<summary>Opción B: Usar OpenAI</summary>

```env
OPENAI_API_KEY=tu_api_key_de_openai
```
Obtén tu API key en: https://platform.openai.com/api-keys
</details>

<details>
<summary>Opción C: Gemini - ❌ NO FUNCIONA</summary>

```env
GOOGLE_GENERATIVE_AI_API_KEY=tu_api_key
```

**Error conocido:** `models/gemini-1.5-flash is not found for API version v1beta`

Stagehand 2.5.2 no es compatible con API keys de Google AI Studio (aistudio.google.com).
</details>

### 2. Chrome con Remote Debugging

Abre Chrome con remote debugging **ANTES** de ejecutar la automatización:

```bash
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\selenium\ChromeProfile"
```

**Importante:**
- Chrome debe estar corriendo en `localhost:9222`
- Usa el perfil en `C:\selenium\ChromeProfile` (o cambia la ruta en el código)
- NO cierres Chrome mientras la automatización esté corriendo

---

## Ejecución

### Comando Principal

```bash
npm run salesforce-stagehand
```

Este comando ejecuta: `npx tsx --import dotenv/config services/automatizacion-salesforce-stagehand.ts`

### Con Cantidad Específica de Leads

```bash
npx tsx --import dotenv/config services/automatizacion-salesforce-stagehand.ts 10
```

Esto procesará 10 leads en lugar de la cantidad por defecto (5).

---

## Verificación Rápida

### 1. Verificar que .env existe y tiene la API key
```bash
type .env
```

### 2. Verificar que Chrome está corriendo en 9222
Abre en tu navegador: http://localhost:9222/json/version

Deberías ver algo como:
```json
{
  "Browser": "Chrome/131.0.6778.86",
  "Protocol-Version": "1.3",
  ...
}
```

### 3. Verificar que dotenv está instalado
```bash
npm list dotenv
```

---

## Solución de Problemas

### Error: "API key is missing"
✅ **Solución:** Verifica que tu `.env` tiene `GEMINI_API_KEY=...`

### Error: "Cannot connect to browser"
✅ **Solución:**
1. Cierra Chrome completamente
2. Ejecuta: `chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\selenium\ChromeProfile"`
3. Vuelve a correr la automatización

### Error: "Module not found: dotenv"
✅ **Solución:** `npm install dotenv`

---

## Características de la Automatización

### ✅ Basada en Percepción (NO selectores CSS)
- Usa `observe()` para "ver" la interfaz
- Usa `extract()` para extraer datos con schemas
- Usa `act()` con instrucciones en lenguaje natural
- **Sin selectores frágiles** - robusto ante cambios del DOM

### 🎯 Funcionalidad
1. Detecta leads nuevos en Salesforce automáticamente
2. Extrae y valida la solución del lead
3. Cambia propietario a "Diego Ignacio Alvarez Franco"
4. Recarga inteligente (solo cuando detecta problemas)
5. Sin esperas fijas - todo basado en estados reales

### 📊 Soluciones Válidas
- Plan vive
- Salud familiar
- Salud evoluciona familiar
- Plan credito protegido

---

## Logs

La automatización muestra logs informativos:

```
🚀 [hora] === INICIANDO AUTOMATIZACIÓN SALESFORCE CON STAGEHAND ===
📋 [hora] Objetivo: procesar 5 leads con soluciones válidas
✅ [hora] Stagehand inicializado correctamente
🌐 [hora] Navegando a: https://sura.lightning.force.com/...
✅ [hora] 🎯 NUEVO: "Juan Pérez"
📊 [hora] Solución: "Plan vive"
✅ [hora] Solución VÁLIDA ✅
🤖 [hora] Cambiando propietario...
✅ [hora] ✅ ÉXITO (1/5) - "Juan Pérez" | "Plan vive"
```

---

## Configuración Avanzada

### Cambiar Modelo de IA

Edita [services/automatizacion-salesforce-stagehand.ts:80](services/automatizacion-salesforce-stagehand.ts#L80):

```typescript
modelName: 'google/gemini-1.5-flash',  // Rápido y gratuito
// Otras opciones:
// modelName: 'google/gemini-1.5-pro',     // Más preciso
// modelName: 'anthropic/claude-3-5-sonnet', // Claude (requiere API key)
```

### Reducir Logs

Cambia `verbose: 2` a `verbose: 0` en la configuración para logs mínimos.

### Cambiar Usuario Destino

Edita [services/automatizacion-salesforce-stagehand.ts:582](services/automatizacion-salesforce-stagehand.ts#L582):

```typescript
2. Search for "Diego Ignacio Alvarez Franco"
// Cambiar por el nombre del usuario que necesites
```

---

## Comparación: Antes vs Ahora

| Aspecto | Antes (Puppeteer) | Ahora (Stagehand) |
|---------|-------------------|-------------------|
| Detección | `querySelector('a[href*="/Lead/"]')` | `observe()` + `extract()` |
| Extracción | `querySelector('p[title="Solución"]')` | Schema con validación |
| Esperas | `await sleep(3000)` | `waitUntil: 'networkidle'` |
| Errores | `querySelector('.modalError')` | `observe('Was it successful?')` |
| Robustez | Se rompe con cambios HTML | Robusto - basado en percepción |

---

¿Tienes más preguntas? Revisa el código fuente con comentarios detallados en:
- [services/automatizacion-salesforce-stagehand.ts](services/automatizacion-salesforce-stagehand.ts)
