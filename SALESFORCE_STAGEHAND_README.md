# Automatización Salesforce con Stagehand (Agente IA)

## Descripción

Esta automatización utiliza **Stagehand como agente inteligente** para interactuar con la interfaz de Salesforce Lightning de forma semántica y robusta, sin depender de selectores frágiles del DOM.

### Características principales

- **Interacción semántica**: Usa `page.act()` y `page.extract()` para razonar sobre la UI como un humano
- **Detección automática**: Observa la llegada de nuevos leads en tiempo real
- **Validación inteligente**: Extrae y valida soluciones usando IA
- **Manejo de sesión**: Recargas periódicas para mantener la sesión activa
- **Resiliente a cambios del DOM**: No depende de selectores CSS específicos
- **Logs descriptivos**: Información clara con timestamps y emojis

---

## Requisitos previos

### 1. Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con:

```bash
GEMINI_API_KEY=AIzaSyCdG5rwuk1DkKyUAs9O6AiI_iMHsx3vv4A
```

**Obtener API key de Gemini (gratuita):**
- Ve a: https://aistudio.google.com/app/apikey
- Crea una nueva API key
- Cópiala al archivo `.env`

### 2. Configuración

Edita `config/config.json`:

```json
{
  "email": "diego.alvarez@asesorsura.com",
  "passwordHash": "Pauli1278#$%",
  "cantidad": 5,
  "contador": 0,
  "hora": "09:00",
  "modo": "manual"
}
```

- `cantidad`: Número de leads a procesar
- `email` y `passwordHash`: Credenciales de Salesforce (solo para referencia)

### 3. Abrir Chrome con Remote Debugging

**IMPORTANTE**: La automatización se conecta a un Chrome que ya esté abierto con remote debugging habilitado.

**Paso a paso:**

1. **Cierra todas las instancias de Chrome** que tengas abiertas

2. **Abre Chrome con remote debugging** usando uno de estos métodos:

   **Opción A: Script automático (más fácil)**
   ```bash
   # Ejecutar el script que creamos
   scripts\start-chrome.bat
   ```

   **Opción B: Comando manual**
   ```bash
   # Windows - Ejecutar en CMD o PowerShell
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\selenium\ChromeProfile"
   ```

   > **Nota**: El parámetro `--user-data-dir` crea un perfil separado de Chrome para evitar conflictos

3. **Inicia sesión en Salesforce**
   - En el Chrome que se abrió, ve a Salesforce
   - Inicia sesión con tus credenciales
   - Navega a cualquier página (para confirmar que la sesión está activa)

4. **Deja Chrome abierto** - La automatización se conectará a este Chrome

---

## Uso

### Opción 1: Ejecutar desde terminal

```bash
# Procesar 5 leads (según config.json)
npm run salesforce-stagehand

# Procesar cantidad específica
npm run salesforce-stagehand 10
```

### Opción 2: Ejecutar vía API

**Endpoint:** `POST http://localhost:3000/automatizacion-salesforce-stagehand`

**Body (opcional):**
```json
{
  "cantidad": 10
}
```

**Ejemplo con curl:**
```bash
curl -X POST http://localhost:3000/automatizacion-salesforce-stagehand \
  -H "Content-Type: application/json" \
  -d '{"cantidad": 5}'
```

---

## Flujo de automatización

### 1. Inicialización
```
🚀 Iniciar Stagehand con modelo Gemini
🌐 Navegar a vista de leads filtrada
✅ Verificar que página cargó correctamente
```

### 2. Bucle principal

```
🔄 Observar tabla de leads
   ↓
🔍 ¿Hay nuevo lead?
   ├─ No → Esperar 5s y recargar si es necesario
   └─ Sí → Continuar
       ↓
🖱️ Hacer clic en el lead
   ↓
📋 Extraer campo "Solución" con IA
   ↓
✅ ¿Solución válida?
   ├─ No → Volver a lista
   └─ Sí → Continuar
       ↓
🔍 Verificar botón "Cambiar propietario"
   ↓
🤖 Cambiar propietario a "Diego Ignacio Alvarez Franco"
   ↓
✅ Confirmar éxito
   ↓
🔙 Volver a lista de leads
```

### 3. Sistema de recargas

- **Recarga cada 1.5 minutos** si no hay actividad
- **Recarga después de 2 minutos** sin interacción
- **NO recarga** mientras se procesa un lead

---

## Soluciones válidas

El agente solo procesará leads con estas soluciones (sin tildes, case-insensitive):

- Plan vive
- Salud familiar
- Salud evoluciona familiar
- Plan crédito protegido

---

## Logs

Los logs son descriptivos y fáciles de seguir:

```
🚀 [10:42:01] === INICIANDO AUTOMATIZACIÓN SALESFORCE ===
📋 [10:42:01] Objetivo: procesar 5 leads
⚙️ [10:42:02] Inicializando Stagehand...
✅ [10:42:05] Stagehand inicializado
🌐 [10:42:05] Navegando a: https://sura.lightning.force.com/...
✅ [10:42:10] Página de prospectos cargada
🔄 [10:42:10] Iniciando bucle de observación...
🔍 [10:42:15] Buscando nuevo lead disponible...
📝 [10:42:18] Lead 1: "Ana María Gómez"
🔍 [10:42:18] Extrayendo solución del lead...
📊 [10:42:20] Solución encontrada: "Plan vive"
✅ [10:42:20] Solución "Plan vive" es VÁLIDA
🔍 [10:42:21] Verificando botón "Cambiar propietario"...
✅ [10:42:21] Botón disponible
🤖 [10:42:21] Ejecutando cambio de propietario...
🖱️ [10:42:22] Haciendo clic en "Cambiar propietario"...
✅ [10:42:24] Modal de cambio abierto
🔍 [10:42:24] Buscando usuario "Diego Ignacio Alvarez Franco"...
✅ [10:42:26] Usuario seleccionado
✅ [10:42:26] Confirmando cambio...
✅ [10:42:28] Cambio realizado exitosamente
✅ [10:42:28] ÉXITO - Lead asignado (1/5)
🎯 [10:42:28] Lead: "Ana María Gómez" | Solución: "Plan vive" ✅
🔙 [10:42:31] Volviendo a lista de prospectos...
```

---

## Comparación: Puppeteer vs Stagehand

| Aspecto | Puppeteer (Anterior) | Stagehand (Nueva) |
|---------|---------------------|-------------------|
| **Selectores** | CSS frágiles (`button[name="ChangeOwnerOne"]`) | Semánticos ("click on Change Owner button") |
| **Mantenimiento** | Alto (DOM cambia) | Bajo (IA interpreta visualmente) |
| **Resiliencia** | Baja | Alta |
| **Legibilidad** | Selectores crípticos | Lenguaje natural |
| **Velocidad inicial** | Más rápido | Más lento (uso de IA) |
| **Confiabilidad** | Media | Alta |

---

## Troubleshooting

### Error: "GEMINI_API_KEY not found"

**Solución**: Crea archivo `.env` con tu API key:
```bash
GEMINI_API_KEY=tu_api_key
```

### Error: "Session expired" o redirección a login

**Solución**:
1. Abre Salesforce manualmente
2. Inicia sesión
3. Vuelve a ejecutar la automatización

### El agente no encuentra leads

**Posibles causas:**
1. La vista de leads está vacía
2. Salesforce está cargando
3. La sesión expiró

**Solución**: Espera 30 segundos y la automatización recargará automáticamente

### "No se pudo extraer solución"

**Posibles causas:**
1. El campo "Solución" está vacío en ese lead
2. El lead no tiene ese campo
3. La página no cargó completamente

**Comportamiento esperado**: El agente saltará ese lead y continuará con el siguiente

### Timeout en cambio de propietario

**Posibles causas:**
1. El usuario "Diego Ignacio Alvarez Franco" no existe en la lista
2. Salesforce está lento
3. No tienes permisos para cambiar propietario

**Solución**: Revisa manualmente en Salesforce que el usuario existe y tienes permisos

---

## Estructura del código

```
services/automatizacion-salesforce-stagehand.ts
├── ejecutarAutomatizacion()      # Función principal
├── detectarYAbrirNuevoLead()     # Observación y detección
├── extraerSolucion()             # Extracción con IA
├── verificarBotonCambiarPropietario()
├── cambiarPropietario()          # Flujo completo con act()
└── volverAListaProspectos()
```

---

## Próximas mejoras

- [ ] Soporte para múltiples usuarios destino
- [ ] Integración con Socket.IO para actualizaciones en tiempo real
- [ ] Sistema de priorización de leads
- [ ] Notificaciones por email/Slack
- [ ] Dashboard de métricas
- [ ] Modo headless para producción

---

## Licencia

Uso interno - SURA

## Contacto

Para dudas o soporte, contactar al equipo de automatización.
