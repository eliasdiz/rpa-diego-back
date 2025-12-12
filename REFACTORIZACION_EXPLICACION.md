# Refactorización de Automatización de Salesforce

## 📋 Resumen de Cambios

Se ha creado una versión completamente refactorizada del archivo `automatizacion.js` en `automatizacion-refactorizada-v2.js` que:

**IMPORTANTE:** Esta versión V2 utiliza **exactamente** el patrón del script Puppeteer con Lighthouse que proporcionaste, incluyendo:
- `puppeteer.Locator.race()` para selectores robustos
- Viewport específico (1522x911)
- Patrón de navegación entre leads usando clicks en lugar de URLs directas
- Estructura de código basada en tu grabación de flujo

Se ha creado también una versión V1 (`automatizacion-refactorizada.js`) más simple que NO usa Lighthouse.

**Recomendación:** Usa la **V2** ya que sigue el patrón de tu script grabado.

---

### ✅ Cambios Implementados (V2)

1. ✅ **Elimina código redundante** (de 1184 líneas a ~280 líneas - reducción del 76%)
2. ✅ **Implementa detección de nuevos leads** mediante polling periódico
3. ✅ **Valida el campo "Solución"** antes de procesar
4. ✅ **Usa el flujo de cambio de propietario** del script Puppeteer proporcionado
5. ✅ **Código más limpio y mantenible**

---

## 🔍 Problemas Identificados en el Código Original

### 1. Complejidad Excesiva
- **Función `abrirLeadRobusto`** (líneas 57-244): 3 estrategias diferentes para abrir un lead con mucho código duplicado
- **Función `observarYHacerClicEnNuevosLeads`** (líneas 851-1184): 333 líneas de código con MutationObserver muy complejo

### 2. Código Comentado
- Bloques grandes de código comentado (líneas 246-399) que no aportan valor

### 3. Múltiples Estrategias de Extracción
- `obtenerSolucionDesdePaginaDetalle` (línea 307)
- `obtenerSolucionDesdeDetalles` (línea 700)
- `obtenerSolucionDesdeHeader` (línea 727)
- Todas hacen prácticamente lo mismo

### 4. Lógica Confusa
- El flujo principal (líneas 454-656) es difícil de seguir
- Muchas banderas y estados (`procesandoLead`, `mostradoMensajeBusqueda`, etc.)
- Reintentos y recargas sin criterio claro

---

## ✨ Mejoras Implementadas

### 1. Arquitectura Simplificada

```
Bucle Principal (Polling cada 10 segundos)
    ↓
Detectar Nuevo Lead (compara con leads vistos)
    ↓
Abrir Lead (navegación directa por URL)
    ↓
Obtener Solución (1 sola estrategia optimizada)
    ↓
Validar Solución (contra lista predefinida)
    ↓
    ├─ Si es inválida → Saltar lead
    └─ Si es válida → Cambiar Propietario
```

### 2. Detección de Nuevos Leads

**Antes:** MutationObserver complejo de 333 líneas con múltiples casos

**Ahora:** Función simple de 25 líneas
```javascript
async function detectarNuevoLead(page, leadsVistos) {
    const leads = await page.evaluate(() => {
        const filas = document.querySelectorAll('table tbody tr');
        return Array.from(filas).map(fila => {
            const enlace = fila.querySelector('a.slds-truncate[href^="/lightning/r/"]');
            return enlace ? {
                nombre: enlace.textContent.trim(),
                url: enlace.getAttribute('href')
            } : null;
        }).filter(Boolean);
    });

    // Encontrar el primer lead que no hayamos visto
    for (const lead of leads) {
        if (!leadsVistos.has(lead.nombre)) {
            return lead;
        }
    }
    return null;
}
```

**Ventajas:**
- Polling simple cada 10 segundos
- Set de leads vistos para evitar duplicados
- No depende de eventos del DOM
- Más confiable y predecible

### 3. Validación de Solución

**Antes:** Múltiples intentos de extracción con cascada de estrategias

**Ahora:**
- 1 función principal `obtenerSolucionLead()`
- Validación clara con `esSolucionValida()`
- Lista de soluciones válidas al inicio del archivo

```javascript
const SOLUCIONES_VALIDAS = [
    'plan vive',
    'salud familiar',
    'salud evoluciona familiar',
    'plan credito protegido'
];
```

### 4. Flujo de Cambio de Propietario

Basado directamente en tu script Puppeteer grabado:

1. Click en botón "Cambiar propietario"
2. Click en campo de búsqueda de usuarios
3. Seleccionar "Diego Ignacio Alvarez Franco"
4. Click en "Enviar"
5. Verificar errores

**Simplificación:** Eliminadas múltiples estrategias y reintentos innecesarios

---

## 📊 Comparación de Código

| Aspecto | Original | Refactorizado | Mejora |
|---------|----------|---------------|--------|
| **Líneas de código** | 1,184 | ~280 | -76% |
| **Funciones** | 11 | 6 | -45% |
| **Complejidad ciclomática** | Alta | Baja | ↓↓↓ |
| **Código comentado** | Sí | No | ✅ |
| **Estrategias de apertura** | 3 | 1 | -66% |
| **Estrategias extracción** | 3 | 1 | -66% |
| **Uso de MutationObserver** | Sí (333 líneas) | No | ✅ |
| **Polling para nuevos leads** | No | Sí | ✅ |

---

## 🎯 Funcionalidades Implementadas

### ✅ 1. Detección de Nuevos Leads
- Sistema de polling cada 10 segundos
- Compara leads actuales con leads ya vistos
- Detecta automáticamente cuando aparece un nuevo lead

### ✅ 2. Validación de Solución
- Extrae el campo "Solución" de la página de detalle del lead
- Normaliza el texto (quita acentos, mayúsculas, espacios extra)
- Valida contra lista predefinida de soluciones válidas
- Solo procesa leads con solución válida

### ✅ 3. Cambio de Propietario Condicional
- Solo ejecuta el cambio si la solución es válida
- Usa el flujo del script Puppeteer proporcionado
- Manejo de errores mejorado

### ✅ 4. Emisión de Eventos al Socket
- `lead-detectado`: Cuando se detecta un nuevo lead
- `lead-saltado`: Cuando se salta un lead (solución inválida)
- `prospecto-cambiado`: Cuando se cambia el propietario exitosamente
- `lead-error`: Cuando hay un error al procesar
- `automatizacion-completada`: Al finalizar

---

## 🚀 Cómo Usar

### Opción 1: Reemplazar el archivo original

```bash
# Hacer backup del original
cp services/automatizacion.js services/automatizacion-backup.js

# Reemplazar con la versión refactorizada
cp services/automatizacion-refactorizada.js services/automatizacion.js
```

### Opción 2: Usar directamente el nuevo archivo (RECOMENDADO)

En `routes/index.js`, cambiar el import:

```javascript
// Antes
import { automatizar } from '../services/automatizacion.js';

// Después - USA LA V2
import { automatizar } from '../services/automatizacion-refactorizada-v2.js';
```

**Diferencias entre V1 y V2:**
- **V1** (`automatizacion-refactorizada.js`): Navegación simple por URL, selectores básicos
- **V2** (`automatizacion-refactorizada-v2.js`): Usa `puppeteer.Locator.race()` como tu script grabado - **MÁS ROBUSTO**

---

## 🔧 Configuración

Las soluciones válidas se configuran en la constante `SOLUCIONES_VALIDAS`:

```javascript
const SOLUCIONES_VALIDAS = [
    'plan vive',
    'salud familiar',
    'salud evoluciona familiar',
    'plan credito protegido'
];
```

El intervalo de polling se configura en `CONFIG.POLLING_INTERVAL`:

```javascript
const CONFIG = {
    POLLING_INTERVAL: 10000, // 10 segundos
    // ...
};
```

---

## 📝 Logs y Depuración

El código refactorizado tiene logs más claros:

```
🚀 [12:30:45] Iniciando automatización...
🔌 [12:30:46] Conectando al navegador...
🌐 [12:30:47] Navegando a Salesforce...
📊 [12:30:50] Meta: procesar 5 leads exitosamente
🆕 [12:31:00] Nuevo lead detectado: "Juan Pérez"
🔍 [12:31:00] Procesando lead: "Juan Pérez"
🔍 [12:31:03] Solución encontrada: "Plan Vive"
✅ [12:31:03] Solución "Plan Vive" es válida
✅ [12:31:03] Solución válida: "Plan Vive". Cambiando propietario...
🔄 [12:31:03] Iniciando cambio de propietario para: "Juan Pérez"
✅ [12:31:04] Clic en botón "Cambiar propietario"
✅ [12:31:05] Clic en campo de búsqueda de usuarios
✅ [12:31:06] Usuario seleccionado: Diego Ignacio Alvarez Franco
✅ [12:31:07] Clic en botón "Enviar"
✅ [12:31:09] Propietario cambiado exitosamente
🎉 [12:31:09] Lead procesado exitosamente! (1/5)
```

---

## ⚠️ Consideraciones

1. **Intervalo de Polling**: Actualmente 10 segundos. Puede ajustarse según necesidad
2. **Timeouts**: 5 segundos por defecto. Puede ajustarse si la conexión es lenta
3. **Soluciones Válidas**: Actualizar la lista según los productos reales de Salesforce
4. **Selector de Usuario**: Actualmente busca "Diego Ignacio Alvarez Franco". Cambiar si es necesario

---

## 🧪 Testing Recomendado

1. Probar con 1-2 leads primero
2. Verificar que las soluciones se detectan correctamente
3. Verificar que solo procesa leads con soluciones válidas
4. Verificar que el cambio de propietario funciona
5. Verificar que los eventos del socket se emiten correctamente

---

## 📚 Próximos Pasos (Opcional)

1. Agregar más soluciones válidas según necesidad
2. Implementar reintentos para cambios de propietario fallidos
3. Agregar métricas y estadísticas
4. Implementar sistema de logs a archivo
5. Agregar tests unitarios