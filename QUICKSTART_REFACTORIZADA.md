# 🚀 Quick Start - Automatización Refactorizada

## Ejecutar la Automatización (Versión Refactorizada V2)

### ✅ Paso 1: Abrir Chrome en modo debug

```bash
npm run chrome
```

### ✅ Paso 2: Asegurarse de tener sesión activa en Salesforce

Abre Chrome y navega a Salesforce, asegúrate de estar logueado.

### ✅ Paso 3: Ejecutar la automatización

```bash
npm run salesforce-refactorizada
```

## 📋 ¿Qué hace?

1. ✅ **Detecta nuevos leads** automáticamente cada 10 segundos
2. ✅ **Valida el campo "Solución"** contra lista predefinida
3. ✅ **Cambia el propietario** solo si la solución es válida
4. ✅ **Salta leads** con solución inválida

## 📊 Soluciones Válidas

- Plan vive
- Salud familiar
- Salud evoluciona familiar
- Plan credito protegido

## 🔧 Configuración

Edita `config/config.json`:

```json
{
  "email": "tu-email@sura.com",
  "passwordHash": "tu-hash",
  "cantidad": 5
}
```

## 🛑 Detener

Presiona `Ctrl + C` en la terminal.

## 📚 Más Información

- [REFACTORIZACION_EXPLICACION.md](REFACTORIZACION_EXPLICACION.md) - Detalles técnicos
- [EJECUTAR_AUTOMATIZACION.md](EJECUTAR_AUTOMATIZACION.md) - Guía de Stagehand

---

## 🎯 Diferencias entre Versiones

| Script | Tecnología | Comando |
|--------|-----------|---------|
| **Refactorizada V2** ⭐ | Puppeteer + Locator.race() | `npm run salesforce-refactorizada` |
| Stagehand | IA (Claude/Gemini) + Puppeteer | `npm run salesforce-stagehand` |
| Puppeteer Original | Puppeteer básico | `npm run salesforce-puppeteer` |

**Recomendado:** Usa la versión refactorizada V2 - es más rápida y no requiere API keys de IA.
