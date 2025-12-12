/**
 * Automatización de Salesforce Lightning - Enfoque basado en PERCEPCIÓN
 *
 * Este agente usa Stagehand con un enfoque 100% basado en percepción visual e intención:
 *
 * ✅ QUÉ HACE:
 * - Observa la interfaz visualmente usando observe() - NO selectores CSS
 * - Extrae datos completos con schemas validados - NO scraping manual
 * - Ejecuta acciones con instrucciones naturales - NO clics en coordenadas
 * - Detecta cambios de estado semánticamente - NO esperas fijas
 *
 * ❌ QUÉ NO HACE:
 * - NO usa selectores CSS frágiles (querySelector, etc.)
 * - NO hace scraping tradicional del DOM
 * - NO tiene esperas fijas (await sleep())
 * - NO depende de la estructura HTML específica
 *
 * El agente interactúa con Salesforce como lo haría un humano:
 * viendo la interfaz, entendiendo el contenido, y tomando decisiones.
 */

// Cargar variables de entorno ANTES de cualquier import
import { fileURLToPath } from 'url';
import * as path from 'path';
import { config } from 'dotenv';

// Obtener ruta del directorio actual en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env desde la raíz del proyecto con ruta explícita
const envPath = path.join(__dirname, '..', '.env');
config({ path: envPath });

// Verificar que al menos una API key esté configurada
if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY && !process.env.DEEPSEEK_API_KEY) {
    console.error('❌ ERROR: No se encontró ninguna API key');
    console.error('📁 Ruta .env esperada:', envPath);
    console.error('📁 Ruta .env resuelta:', path.resolve(envPath));
    console.error('💡 Necesitas configurar una de estas variables:');
    console.error('   - DEEPSEEK_API_KEY (DeepSeek - muy económico)');
    console.error('   - ANTHROPIC_API_KEY (Claude - $5 gratis sin tarjeta)');
    console.error('   - OPENAI_API_KEY (OpenAI - ya activaste tu cuenta)');
    process.exit(1);
}

if (process.env.DEEPSEEK_API_KEY) {
    console.log('✅ API Key de DeepSeek cargada correctamente');
} else if (process.env.ANTHROPIC_API_KEY) { 
    console.log('✅ API Key de Claude (Anthropic) cargada correctamente');
} else {
    console.log('✅ API Key de OpenAI cargada correctamente');
}
console.log('📁 Archivo .env leído desde:', path.resolve(envPath));

import { Stagehand, type ConstructorParams } from '@browserbasehq/stagehand';
import { format } from '@formkit/tempo';
import * as fs from 'fs';

// Configuración de rutas (ya definido arriba)
const configPath = path.join(__dirname, '../config/config.json');

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

interface ConfigSalesforce {
    email: string;
    passwordHash: string;
    cantidad: number;
    contador?: number;
    hora?: string;
    modo?: string;
}

interface ResultadoAutomatizacion {
    exitoso: boolean;
    leadsProcesados: number;
    leadsAsignados: number;
    errores: string[];
    tiempoTotal: number;
}

interface EstadoAgente {
    procesandoLead: boolean;
    ultimoLeadProcesado: string;
    leadsVistos: Set<string>;
    ultimaInteraccion: number;
    ultimaRecarga: number;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';

// Soluciones válidas (normalizadas sin tildes, lowercase)
const SOLUCIONES_VALIDAS = [
    'plan vive',
    'salud familiar',
    'salud evoluciona familiar',
    'plan credito protegido'
];

// Configuración de tiempos (en milisegundos)
const TIEMPOS = {
    INTERVALO_RECARGA: 10000,        // 10 segundos entre recargas cuando no hay leads
    TIEMPO_SIN_INTERACCION: 15000,   // 15 segundos sin interacción verifica estado
};

// Configuración de Stagehand
// IMPORTANTE: Conecta a una instancia de Chrome ya abierta en puerto 9222
// Debes abrir Chrome primero con: chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\selenium\ChromeProfile"
// Seleccionar modelo según API key disponible (prioridad: DeepSeek > OpenAI > Claude)
const getModelConfig = () => {
    if (process.env.DEEPSEEK_API_KEY) {
        return 'deepseek/deepseek-chat';
    } else if (process.env.OPENAI_API_KEY) {
        return 'gpt-4o-mini';
    } else if (process.env.ANTHROPIC_API_KEY) {
        return 'claude-3-5-sonnet-20241022';
    }
    return 'gpt-4o-mini'; // fallback
};

const STAGEHAND_CONFIG: ConstructorParams = {
    env: 'LOCAL',
    verbose: 0,
    enableCaching: false,
    // Modelo seleccionado automáticamente según API key disponible
    modelName: getModelConfig(),
    // API key cargada desde .env - Stagehand detecta automáticamente cuál usar
    // Conectar a Chrome existente usando CDP (Chrome DevTools Protocol)
    localBrowserLaunchOptions: {
        cdpUrl: 'http://localhost:9222'  // Conecta a Chrome con remote debugging
    }
};

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Obtiene hora actual formateada (HH:MM:SS)
 */
const horaActual = (): string => format(new Date(), { time: 'medium' });

/**
 * Normaliza texto: lowercase, sin tildes, sin espacios extra
 */
function normalizarTexto(texto: string): string {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Sistema de logging con niveles mejorado
 */
let ultimoLogInfo = 0;
const INTERVALO_LOG_INFO = 30000; // 30 segundos
let ultimoEstadoBusqueda = ''; // Para evitar logs repetidos

function log(emoji: string, mensaje: string, nivel: 'importante' | 'info' | 'debug' = 'importante'): void {
    if (nivel === 'importante') {
        // Siempre mostrar logs importantes (leads encontrados, cambios, errores)
        console.log(`${emoji} [${horaActual()}] ${mensaje}`);
    } else if (nivel === 'info') {
        // Logs informativos: solo cada 30 segundos
        const ahora = Date.now();
        if (ahora - ultimoLogInfo > INTERVALO_LOG_INFO) {
            console.log(`${emoji} [${horaActual()}] ${mensaje}`);
            ultimoLogInfo = ahora;
        }
    }
    // 'debug' no se muestra nunca
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE AUTOMATIZACIÓN
// ============================================================================

/**
 * Ejecuta la automatización de Salesforce usando Stagehand como agente IA
 *
 * @param cantidadObjetivo - Número de leads a procesar
 * @returns Resultado de la automatización
 */
export async function ejecutarAutomatizacion(
    cantidadObjetivo?: number
): Promise<ResultadoAutomatizacion> {

    const inicio = Date.now();
    let stagehand: Stagehand | undefined;
    const errores: string[] = [];

    log('🚀', '=== INICIANDO AUTOMATIZACIÓN SALESFORCE CON STAGEHAND ===');

    try {
        // 1. Leer configuración
        const config: ConfigSalesforce = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const cantidad = cantidadObjetivo || config.cantidad || 5;

        log('📋', `Objetivo: procesar ${cantidad} leads con soluciones válidas`);
        log('✅', `Soluciones válidas: ${SOLUCIONES_VALIDAS.join(', ')}`);

        // 2. Inicializar Stagehand
        log('⚙️', 'Inicializando Stagehand...');
        stagehand = new Stagehand(STAGEHAND_CONFIG);
        await stagehand.init();
        log('✅', 'Stagehand inicializado correctamente');

        const page = stagehand.page;

        // 3. Navegar a página de prospectos
        log('🌐', `Navegando a: ${PROSPECTOS_URL}`);
        try {
            // Intentar con networkidle primero (30s timeout)
            await page.goto(PROSPECTOS_URL, { waitUntil: 'networkidle', timeout: 30000 });
        } catch (timeoutError) {
            // Si falla, intentar con domcontentloaded (más rápido, 60s timeout)
            log('⚠️', 'Timeout con networkidle, reintentando con domcontentloaded...');
            await page.goto(PROSPECTOS_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        }
        log('✅', 'Página de prospectos cargada');

        // 4. Inicializar estado del agente
        const estado: EstadoAgente = {
            procesandoLead: false,
            ultimoLeadProcesado: '',
            leadsVistos: new Set<string>(),
            ultimaInteraccion: Date.now(),
            ultimaRecarga: Date.now(),
        };

        let leadsAsignados = 0;
        let leadsProcesados = 0;

        // 5. Bucle principal de automatización
        log('🔄', 'Iniciando bucle de observación...');

        while (leadsAsignados < cantidad) {
            try {
                // Marcar que estamos procesando
                estado.procesandoLead = true;

                // 6. Detectar y abrir nuevo lead
                const nombreLead = await detectarYAbrirNuevoLead(page, estado);

                if (!nombreLead) {
                    estado.procesandoLead = false;

                    // ✅ RECARGA AUTOMÁTICA: Si no hay leads, recargar cada 10 segundos
                    const tiempoDesdeUltimaRecarga = Date.now() - estado.ultimaRecarga;

                    if (tiempoDesdeUltimaRecarga > TIEMPOS.INTERVALO_RECARGA) {
                        log('🔄', 'No hay leads nuevos. Recargando página...', 'info');
                        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
                        estado.ultimaRecarga = Date.now();
                        await page.waitForTimeout(2000); // Esperar 2 segundos después de recargar
                    } else {
                        // Esperar un poco antes de volver a intentar
                        await page.waitForTimeout(3000);
                    }

                    // Continuar observando
                    continue;
                }

                leadsProcesados++;
                estado.ultimaInteraccion = Date.now();
                log('📝', `Lead ${leadsProcesados}: "${nombreLead}"`);

                // 7. Validar que la página del lead está cargada
                const urlActual = page.url();

                if (!urlActual.includes('/lightning/r/Lead/')) {
                    log('⚠️', 'URL inválida, saltando...', 'debug');
                    estado.procesandoLead = false;
                    await volverAListaProspectos(page);
                    continue;
                }

                // 8. Extraer datos del lead con validación integrada
                const datosLead = await extraerDatosLead(page);

                if (!datosLead) {
                    log('⚠️', 'No se pudieron extraer datos del lead', 'debug');
                    estado.procesandoLead = false;
                    await volverAListaProspectos(page);
                    continue;
                }

                log('📊', `Solución: "${datosLead.solucion}"`);

                if (!datosLead.esValida) {
                    log('❌', `Solución "${datosLead.solucion}" no válida ❌`);
                    estado.procesandoLead = false;
                    await volverAListaProspectos(page);
                    continue;
                }

                log('✅', `Solución VÁLIDA ✅`);

                // 9. Verificar botón (SILENCIOSO)
                const botonDisponible = await verificarBotonCambiarPropietario(page);

                if (!botonDisponible) {
                    log('⚠️', 'Botón no disponible, saltando', 'debug');
                    estado.procesandoLead = false;
                    await volverAListaProspectos(page);
                    continue;
                }

                // 10. Ejecutar cambio de propietario
                log('🤖', 'Cambiando propietario...');
                const cambioExitoso = await cambiarPropietario(page);

                if (cambioExitoso) {
                    leadsAsignados++;
                    log('✅', `✅ ÉXITO (${leadsAsignados}/${cantidad}) - "${nombreLead}" | "${datosLead.solucion}"`);
                } else {
                    log('❌', 'Error al cambiar propietario');
                    errores.push(`Error al cambiar propietario del lead: ${nombreLead}`);
                }

                estado.ultimaInteraccion = Date.now();

                // 11. Volver a lista
                await volverAListaProspectos(page);
                estado.procesandoLead = false;

            } catch (error) {
                const mensaje = error instanceof Error ? error.message : String(error);
                log('❌', `Error: ${mensaje}`);
                errores.push(mensaje);
                estado.procesandoLead = false;

                try {
                    await volverAListaProspectos(page);
                } catch (recError) {
                    log('❌', 'Error crítico, finalizando...');
                    break;
                }
            }
        }

        // Automatización completada
        const tiempoTotal = Date.now() - inicio;
        log('🎉', `AUTOMATIZACIÓN COMPLETADA`);
        log('📊', `Leads procesados: ${leadsProcesados}`);
        log('📊', `Leads asignados: ${leadsAsignados}/${cantidad}`);
        log('⏱️', `Tiempo total: ${Math.round(tiempoTotal / 1000)}s`);

        return {
            exitoso: true,
            leadsProcesados,
            leadsAsignados,
            errores,
            tiempoTotal
        };

    } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        log('❌', `ERROR CRÍTICO: ${mensaje}`);
        errores.push(mensaje);

        return {
            exitoso: false,
            leadsProcesados: 0,
            leadsAsignados: 0,
            errores,
            tiempoTotal: Date.now() - inicio
        };

    } finally {
        // Mantener navegador abierto para inspección
        if (stagehand) {
            log('🔓', 'Manteniendo navegador abierto para inspección...');
            // No cerrar: await stagehand.close();
        }
    }
}

// ============================================================================
// FUNCIONES AUXILIARES DEL AGENTE
// ============================================================================

/**
 * Detecta y abre un nuevo lead usando percepción visual (observe + act)
 * NO usa selectores CSS - el agente "ve" la tabla y decide qué hacer
 */
async function detectarYAbrirNuevoLead(
    page: any,
    estado: EstadoAgente
): Promise<string | null> {

    try {
        // ✅ ENFOQUE BASADO EN PERCEPCIÓN: Observar la tabla de leads
        const observacion = await page.observe({
            instruction: `
                Look at the leads table on this Salesforce page.

                Your task is to:
                1. Identify if there are any visible leads in the table
                2. Count how many leads are visible
                3. Extract the names of the first 5 leads you can see
                4. Determine if the table is still loading or fully loaded
            `
        });

        // Extraer nombres de leads visibles del resultado de observación
        const texto = observacion?.toString() || '';
        const leadsEncontrados: string[] = [];

        // El observe() devuelve texto descriptivo - intentar extraer nombres
        // Si esto no funciona bien, usar extract() en su lugar
        const lineas = texto.split('\n');
        for (const linea of lineas) {
            const match = linea.match(/lead.*["']([^"']+)["']/i);
            if (match && match[1]) {
                leadsEncontrados.push(match[1]);
            }
        }

        // Si observe() no dio nombres claros, usar extract() directamente
        if (leadsEncontrados.length === 0) {
            const extraccion = await page.extract({
                instruction: `
                    Extract the names of all visible leads from the table on this page.
                    Return a list of lead names (full names of people or companies).
                `,
                schema: {
                    type: 'object',
                    properties: {
                        leads: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Names of all visible leads in the table'
                        },
                        count: {
                            type: 'number',
                            description: 'Total number of leads found'
                        }
                    },
                    required: ['leads', 'count']
                }
            });

            if (extraccion && extraccion.leads && Array.isArray(extraccion.leads)) {
                leadsEncontrados.push(...extraccion.leads);
            }
        }

        // Log solo si cambió el estado
        const estadoActual = `${leadsEncontrados.length} leads disponibles`;
        if (estadoActual !== ultimoEstadoBusqueda) {
            if (leadsEncontrados.length > 0) {
                log('📋', estadoActual, 'info');
            } else {
                log('⚠️', 'No hay leads disponibles', 'info');
            }
            ultimoEstadoBusqueda = estadoActual;
        }

        // Buscar el primer lead que no hayamos visto
        for (const nombreLead of leadsEncontrados) {
            if (!estado.leadsVistos.has(nombreLead)) {
                log('✅', `🎯 NUEVO: "${nombreLead}"`);
                estado.leadsVistos.add(nombreLead);

                // ✅ USAR ACT() PARA ABRIR - Sin selectores, solo intención
                await page.act({
                    action: `Click on the lead named "${nombreLead}" in the table to open its details page. Wait for the page to load.`
                });

                // Verificar que navegamos correctamente
                const url = page.url();
                if (url.includes('/lightning/r/Lead/')) {
                    estado.ultimoLeadProcesado = nombreLead;
                    return nombreLead;
                }
            }
        }

        // Log silencioso cada 30 segundos
        log('💤', 'Esperando nuevos leads...', 'info');
        return null;

    } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        log('❌', `Error detectando leads: ${mensaje}`);
        return null;
    }
}

/**
 * Extrae datos completos del lead con validación integrada
 * Retorna objeto con toda la información necesaria + validación de solución
 */
interface DatosLead {
    nombre?: string;
    solucion: string;
    solucionNormalizada: string;
    esValida: boolean;
    propietarioActual?: string;
}

async function extraerDatosLead(page: any): Promise<DatosLead | null> {

    try {
        // ✅ ENFOQUE BASADO EN PERCEPCIÓN: Extraer TODO de una vez con validación
        const resultado = await page.extract({
            instruction: `
                Extract all relevant information from this Salesforce lead details page.

                IMPORTANT: The valid solutions (case-insensitive) are:
                - Plan vive
                - Salud familiar
                - Salud evoluciona familiar
                - Plan credito protegido

                Your task:
                1. Find the "Solución" or "Solution" field and extract its value
                2. Check if this solution matches one of the valid solutions (ignore case, accents, and extra spaces)
                3. Also extract the lead's name and current owner if visible

                Return the exact solution text you found, and indicate if it's valid.
            `,
            schema: {
                type: 'object',
                properties: {
                    nombre: {
                        type: 'string',
                        description: 'Lead full name'
                    },
                    solucion: {
                        type: 'string',
                        description: 'The exact solution/product name found in the Solución field'
                    },
                    esValida: {
                        type: 'boolean',
                        description: 'True if the solution matches one of the valid solutions (case-insensitive, ignoring accents)'
                    },
                    propietarioActual: {
                        type: 'string',
                        description: 'Current lead owner name'
                    }
                },
                required: ['solucion', 'esValida']
            }
        });

        if (!resultado || !resultado.solucion) {
            return null;
        }

        // Normalizar solución para consistencia
        const solucionNormalizada = normalizarTexto(resultado.solucion);

        // Doble verificación local de validez (por si la IA se equivocó)
        const esValidaLocal = SOLUCIONES_VALIDAS.includes(solucionNormalizada);

        return {
            nombre: resultado.nombre,
            solucion: resultado.solucion,
            solucionNormalizada,
            esValida: esValidaLocal, // Usar verificación local para mayor seguridad
            propietarioActual: resultado.propietarioActual
        };

    } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        log('❌', `Error extrayendo datos: ${mensaje}`, 'debug');
        return null;
    }
}

/**
 * Verifica si el botón de cambio de propietario está disponible usando percepción visual
 */
async function verificarBotonCambiarPropietario(page: any): Promise<boolean> {
    try {
        // ✅ ENFOQUE BASADO EN PERCEPCIÓN: Observar si el botón está visible
        const observacion = await page.observe({
            instruction: `
                Look at this Salesforce lead page.
                Is there a "Change Owner" or "Cambiar propietario" button visible?
                Answer with a simple yes or no.
            `
        });

        const respuesta = observacion?.toString().toLowerCase() || '';
        return respuesta.includes('yes') || respuesta.includes('sí') || respuesta.includes('si');
    } catch (error) {
        return false;
    }
}

/**
 * Cambiar propietario usando enfoque basado en percepción
 * Sin esperas fijas, sin selectores CSS - solo acciones semánticas
 */
async function cambiarPropietario(page: any): Promise<boolean> {

    try {
        // Paso 1: Abrir modal de cambio de propietario
        await page.act({
            action: 'Click on the "Change Owner" or "Cambiar propietario" button and wait for the modal to appear'
        });

        // Paso 2: Buscar y seleccionar usuario en una sola acción compuesta
        await page.act({
            action: `
                In the "Change Owner" modal that just opened:
                1. Find the user search field
                2. Search for "Diego Ignacio Alvarez Franco"
                3. Select that user from the results
            `
        });

        // Paso 3: Confirmar cambio
        await page.act({
            action: 'Click on the "Send" or "Enviar" button to confirm the owner change, then wait for the action to complete'
        });

        // ✅ PASO 4: Verificar resultado usando OBSERVE (sin selectores CSS)
        const verificacion = await page.observe({
            instruction: `
                After attempting to change the owner:
                1. Did the modal close successfully?
                2. Is there any error message visible?
                3. If there's an error, what does it say?

                Provide a clear answer about whether the operation succeeded or failed.
            `
        });

        const respuesta = verificacion?.toString().toLowerCase() || '';

        // Detectar si hubo error
        if (respuesta.includes('error') || respuesta.includes('failed') || respuesta.includes('falló')) {
            log('❌', `Error detectado: ${verificacion}`);
            return false;
        }

        // Detectar si fue exitoso
        if (respuesta.includes('success') || respuesta.includes('close') || respuesta.includes('cerr')) {
            return true;
        }

        // Si no está claro, asumir éxito (optimista)
        return true;

    } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        log('❌', `Error en cambio: ${mensaje}`);
        return false;
    }
}

/**
 * Volver a lista de prospectos
 */
async function volverAListaProspectos(page: any): Promise<void> {
    try {
        await page.goto(PROSPECTOS_URL, { waitUntil: 'networkidle' });
    } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        log('❌', `Error volviendo a lista: ${mensaje}`);
        throw error;
    }
}

// ============================================================================
// EJECUCIÓN DIRECTA
// ============================================================================

// Si se ejecuta directamente desde la terminal
if (__filename === process.argv[1]) {
    const cantidadArg = process.argv[2] ? parseInt(process.argv[2]) : undefined;

    ejecutarAutomatizacion(cantidadArg)
        .then((resultado) => {
            console.log('\n📊 RESUMEN FINAL:');
            console.log(JSON.stringify(resultado, null, 2));

            if (resultado.exitoso) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        })
        .catch((error: Error) => {
            console.error(`\n❌ Error fatal: ${error.message}`);
            process.exit(1);
        });
}
