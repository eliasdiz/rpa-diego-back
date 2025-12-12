// Reemplazo de page.waitForTimeout por una función compatible
async function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { format } from '@formkit/tempo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../config/config.json');

// Función para normalizar texto (quita tildes, espacios extra, convierte a minúsculas)
function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()           // convierte "SEGURO EXEQUIAL" a "seguro exequial"
        .normalize('NFD')        // normaliza caracteres Unicode
        .replace(/[\u0300-\u036f]/g, '') // elimina acentos
        .replace(/\s+/g, ' ')   // reemplaza múltiples espacios por uno solo
        .trim();                // elimina espacios al inicio y final
}

// Constantes
const SOLUCIONES_VALIDAS = [
    'Plan vive',
    'Salud familiar',
    'Salud evoluciona familiar',
    'Plan credito protegido'
];

// Soluciones normalizadas para comparación
const SOLUCIONES_VALIDAS_NORMALIZADAS = SOLUCIONES_VALIDAS.map(s => normalizarTexto(s));
// console.log(SOLUCIONES_VALIDAS_NORMALIZADAS);

// Función para hora actual (formato HH:MM:SS)
const horaActual = () => format(new Date(), { time: 'medium' });

// URL de la lista de prospectos
const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';

// Configuración para tiempos de espera y reintentos
const CONFIG = {
    navegacionTimeout: 30000,      // Reducido a 30s para recargas más rápidas
    protocolTimeout: 60000,        // Reducido a 60s 
    maxReintentoConexion: 3,
    maxReintentosApertura: 3,      // Reintentos específicos para apertura de leads
    tiempoEsperaEntreReintentos: 5000,
    tiempoEsperaEntreLeads: 3000,
    tiempoEntreRecargas: 5000      // 5 segundos entre recargas
};

// Función robusta para abrir leads con múltiples estrategias y reintentos
async function abrirLeadRobusto(page, lead, nombreTexto) {
    console.log(`🔍 [${horaActual()}] Abriendo lead: ${nombreTexto}...`);
    // lead puede ser:
    // - un ElementHandle que es un <tr> (fila)
    // - un ElementHandle que es un <a> (anchor directo)
    // - una string con la URL del lead
    let leadUrl = '';
    let elementoTag = null;
    try {
        if (typeof lead === 'string') {
            leadUrl = lead;
        } else {
            // Determinar tag name del elemento
            elementoTag = await page.evaluate(el => el && el.tagName ? el.tagName.toLowerCase() : null, lead).catch(() => null);
            if (elementoTag === 'a') {
                leadUrl = await lead.evaluate(el => el.getAttribute('href')).catch(() => null);
            } else {
                // Asumir que es una fila <tr> y buscar el anchor dentro
                leadUrl = await lead.$eval('a.slds-truncate[href^="/lightning/r/"]', el => el.getAttribute('href')).catch(() => null);
            }

            // Construir URL absoluta si es relativa
            if (leadUrl && !leadUrl.startsWith('http')) {
                try {
                    const baseUrl = new URL(page.url()).origin;
                    leadUrl = `${baseUrl}${leadUrl}`;
                } catch (uErr) {
                    // Ignorar
                }
            }
        }
    } catch (err) {
        console.log(`⚠️ [${horaActual()}] No se pudo extraer URL del lead: ${err.message}`);
    }

    // Estrategias de apertura con reintentos
    let exito = false;
    let intentos = 0;
    let error = null;

    while (!exito && intentos < CONFIG.maxReintentosApertura) {
        intentos++;
        console.log(`⏱️ [${horaActual()}] Intento ${intentos} de abrir lead`);

        try {
            // Estrategia 1: Navegación directa por URL (si está disponible)
            if (leadUrl) {
                console.log(`🌐 [${horaActual()}] Navegando por URL directa...`);
                await Promise.race([
                    page.goto(leadUrl, { timeout: CONFIG.navegacionTimeout }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout navegación directa')), CONFIG.navegacionTimeout)
                    )
                ]);
            } else {
                // Si no tenemos URL, intentaremos abrir haciendo click en el elemento
                // (si es un anchor clickará directamente, si es una fila buscará el anchor dentro)
                console.log(`🖱️ [${horaActual()}] URL no disponible — intentar clic directo en elemento`);
            }

            // Verificación rápida de URL
            await esperar(1000);
            if (page.url().includes('/lightning/r/Lead/')) {
                console.log(`✅ [${horaActual()}] Lead abierto correctamente mediante URL directa`);
                exito = true;
                continue;
            }
            throw new Error('URL incorrecta tras navegación directa');
        } catch (err1) {
            console.log(`⚠️ [${horaActual()}] Estrategia 1 falló: ${err1.message}`);

            try {
                // Estrategia 2: Clic tradicional
                console.log(`🖱️ [${horaActual()}] Intentando clic tradicional...`);
                // Volver a la lista si no estamos en ella
                if (!page.url().includes('list?filterName=')) {
                    await page.goto(PROSPECTOS_URL, {
                        waitUntil: 'domcontentloaded',
                        timeout: CONFIG.navegacionTimeout
                    });
                    await esperar(3000);

                    // Recuperar la referencia al lead nuevamente
                    const leads = await page.$$('table tbody tr');
                    let encontrado = false;

                    for (const leadItem of leads) {
                        const nombreItem = await leadItem.$eval('a.slds-truncate[href^="/lightning/r/"]',
                            el => el.textContent.trim()).catch(() => '');

                        if (nombreItem === nombreTexto) {
                            const link = await leadItem.$('a.slds-truncate[href^="/lightning/r/"]');
                            if (link) {
                                await link.click();
                                encontrado = true;
                                break;
                            }
                        }
                    }

                    if (!encontrado) throw new Error('Lead no encontrado en la lista');
                } else {
                    // Si el elemento es un <a>, hacer click directamente
                    if (elementoTag === 'a') {
                        await lead.click().catch(() => { throw new Error('No se pudo clickear el anchor'); });
                    } else {
                        // Intentar encontrar el anchor dentro de la fila
                        const nombreLead = await lead.$('a.slds-truncate[href^="/lightning/r/"]');
                        if (nombreLead) await nombreLead.click();
                        else throw new Error('Elemento de lead no encontrado');
                    }
                }

                // Esperar cambio de URL con timeout aumentado
                await page.waitForFunction(
                    'window.location.href.includes("/lightning/r/Lead/")',
                    { timeout: 10000 }
                );

                await esperar(2000);
                if (page.url().includes('/lightning/r/Lead/')) {
                    console.log(`✅ [${horaActual()}] Lead abierto correctamente mediante clic tradicional`);
                    exito = true;
                    continue;
                }
                throw new Error('URL incorrecta tras clic tradicional');
            } catch (err2) {
                console.log(`⚠️ [${horaActual()}] Estrategia 2 falló: ${err2.message}`);

                try {
                    // Estrategia 3: Evaluación JavaScript en el navegador
                    console.log(`🧪 [${horaActual()}] Intentando apertura por evaluación JS...`);

                    // Volver a la lista si no estamos en ella
                    if (!page.url().includes('list?filterName=')) {
                        await page.goto(PROSPECTOS_URL, { waitUntil: 'domcontentloaded' });
                        await esperar(3000);
                    }

                    // Intentar abrir mediante JS
                    const abierto = await page.evaluate((nombreBuscado) => {
                        // Buscar todos los enlaces de leads
                        const enlaces = Array.from(document.querySelectorAll('a.slds-truncate[href^="/lightning/r/"]'));
                        // Encontrar el enlace con el nombre correcto
                        const enlace = enlaces.find(a => a.textContent.trim() === nombreBuscado);
                        if (enlace) {
                            enlace.click();
                            return true;
                        }
                        return false;
                    }, nombreTexto);

                    if (!abierto) throw new Error('No se encontró el enlace por JS');

                    // Esperar cambio de URL
                    await page.waitForFunction(
                        'window.location.href.includes("/lightning/r/Lead/")',
                        { timeout: 10000 }
                    ).catch(() => { });

                    await esperar(2000);
                    if (page.url().includes('/lightning/r/Lead/')) {
                        console.log(`✅ [${horaActual()}] Lead abierto correctamente mediante JS`);
                        exito = true;
                        continue;
                    }
                    throw new Error('URL incorrecta tras clic por JS');
                } catch (err3) {
                    console.log(`⚠️ [${horaActual()}] Estrategia 3 falló: ${err3.message}`);
                    error = err3;
                }
            }
        }

        // Esperar antes del siguiente intento
        if (!exito && intentos < CONFIG.maxReintentosApertura) {
            console.log(`🔄 [${horaActual()}] Esperando antes del siguiente intento...`);
            await esperar(3000);
        }
    }

    if (!exito) {
        console.log(`❌ [${horaActual()}] Todos los intentos de apertura fallaron`);
        throw new Error('Fallo al abrir lead después de múltiples intentos');
    }

    return exito;
}

/*
// Función para extraer la solución directamente de la tabla de leads
async function extraerSolucionDesdeTabla(lead) {
    try {
        // Buscar la celda que contiene la solución (por data-label="Solución" o data-col-key-value que contenga "Solucion")
        const solucionCelda = await lead.evaluate(row => {
            // Buscar todas las celdas en esta fila
            const celdas = Array.from(row.querySelectorAll('td'));

            // Encontrar la celda que corresponde a la solución
            const celdaSolucion = celdas.find(celda =>
                celda.getAttribute('data-label') === 'Solución' ||
                celda.getAttribute('data-col-key-value')?.includes('Solucion')
            );

            if (!celdaSolucion) return null;

            // Extraer el texto de la celda de solución - siguiendo la estructura del HTML
            // Opción 1: Obtener desde el span más específico
            const spanSolucion = celdaSolucion.querySelector('span[lwc-47ngqe6rvah]');
            if (spanSolucion) return spanSolucion.textContent.trim();

            // Opción 2: Obtener desde el texto del enlace
            const enlaceSolucion = celdaSolucion.querySelector('a.slds-truncate');
            if (enlaceSolucion) return enlaceSolucion.textContent.trim();

            // Opción 3: Obtener cualquier texto disponible dentro de la celda
            return celdaSolucion.textContent.trim();
        });

        return solucionCelda || '';
    } catch (error) {
        console.log(`⚠️ [${horaActual()}] Error al extraer solución de tabla: ${error.message}`);
        return '';
    }
}
*/

// Nueva función para extraer todos los datos de la tabla (sin usar console.table)
async function extraerTodosLosDatosDeLaTabla(page) {
    try {
        // Obtener todas las filas de la tabla
        const filas = await page.$$('table tbody tr');
        console.log(`🔍 [${horaActual()}] Encontrados ${filas.length} leads en la tabla`);

        // Solo extraer nombres para mostrar en log
        for (let i = 0; i < filas.length; i++) {
            const fila = filas[i];
            const nombre = await fila.$eval('a.slds-truncate[href^="/lightning/r/"]',
                el => el.textContent.trim()).catch(() => 'No disponible');
            console.log(`👤 [${horaActual()}] Lead ${i + 1}: "${nombre}"`);
        }

        return true;
    } catch (error) {
        console.error(`❌ [${horaActual()}] Error al extraer datos de la tabla: ${error.message}`);
        return false;
    }
}

// Reemplazar la estrategia actual por esta nueva función
async function obtenerSolucionDesdePaginaDetalle(page) {
    try {
        // Esperar a que la página cargue completamente
        await esperar(3000);

        const solucionTexto = await page.evaluate(() => {
            // 1. PRIMERO buscar el p con title "Solución"
            const pSolucion = Array.from(document.querySelectorAll('p')).find(p =>
                p.getAttribute('title') === 'Solución'
            );

            if (!pSolucion) {
                console.log('No se encontró el campo Solución');
                return '';
            }

            // 2. Subir al contenedor padre (records-highlights-details-item)
            const contenedorSolucion = pSolucion.closest('records-highlights-details-item');
            if (!contenedorSolucion) {
                console.log('No se encontró el contenedor de la solución');
                return '';
            }

            // 3. Buscar el span con clase slds-truncate
            const spanTruncate = contenedorSolucion.querySelector('span.slds-truncate');
            if (!spanTruncate) {
                console.log('No se encontró el span con clase slds-truncate');
                return '';
            }

            // 4. Obtener el texto - intentar primero del span hijo directo
            let texto = '';

            // Buscar el primer span hijo que tenga texto
            const spanHijo = spanTruncate.querySelector('span');
            if (spanHijo && spanHijo.textContent && spanHijo.textContent.trim() !== '') {
                texto = spanHijo.textContent.trim();
            }
            // Si no hay span hijo con texto, usar el texto del span padre
            else if (spanTruncate.textContent && spanTruncate.textContent.trim() !== '') {
                texto = spanTruncate.textContent.trim();
            }
            // Último recurso: usar innerText que captura texto visible
            else if (spanTruncate.innerText && spanTruncate.innerText.trim() !== '') {
                texto = spanTruncate.innerText.trim();
            }

            console.log('Texto de solución encontrado:', texto);
            return texto;
        });

        console.log(`🔎 [${horaActual()}] Solución encontrada en página detalle: "${solucionTexto}"`);
        return solucionTexto;
    } catch (error) {
        console.log(`⚠️ [${horaActual()}] Error al extraer solución desde detalle: ${error.message}`);
        return '';
    }
}

// Modifica la función para procesar leads:
// async function procesarLead(page, lead, nombreTexto) {
//     // 1. Extraer la solución DIRECTAMENTE DE LA TABLA antes de abrir el lead
//     const solucionTabla = await lead.evaluate(row => {
//         // Buscar la celda con data-label="Solución"
//         const celdaSolucion = Array.from(row.querySelectorAll('td')).find(
//             celda => celda.getAttribute('data-label') === 'Solución'
//         );

//         if (celdaSolucion) {
//             // Extraer el texto del span dentro del enlace
//             const spanSolucion = celdaSolucion.querySelector('span[lwc-47ngqe6rvah]');
//             if (spanSolucion) return spanSolucion.textContent.trim();

//             // Alternativa: cualquier texto en la celda
//             return celdaSolucion.textContent.trim();
//         }
//         return '';
//     });

//     console.log(`✅ [${horaActual()}] Solución extraída de tabla: "${solucionTabla}"`);

//     // Evaluar si la solución es válida sin necesidad de abrir el lead
//     if (!SOLUCIONES_VALIDAS.includes(solucionTabla)) {
//         console.log(`⏩ [${horaActual()}] Lead con solución inválida (${solucionTabla}). Saltando...`);
//         return false;
//     }

//     // 2. Solo abrir el lead si la solución es válida
//     console.log(`🔍 [${horaActual()}] Solución válida. Abriendo lead: ${nombreTexto}...`);
//     await abrirLeadRobusto(page, lead, nombreTexto);

//     // Resto del proceso...
// }

export async function automatizar(socket, setBrowser) {
    let browser;
    let intentosConexion = 0;
    let leadsProcesados = 0; // Nuevo contador de leads procesados
    let ultimoLeadProcesado = ""; // Variable para recordar el último lead procesado

    while (intentosConexion < CONFIG.maxReintentoConexion) {
        try {
            console.log(`🔌 [${horaActual()}] Intentando conectar al navegador (intento ${intentosConexion + 1})...`);

            // Leer configuración
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const { email, passwordHash, cantidad, contador = 0 } = config;

            // Validaciones iniciales
            if (!email || !passwordHash) {
                throw new Error('Credenciales no configuradas en config.json');
            }

            if (!cantidad || cantidad <= 0) {
                throw new Error('Cantidad de prospectos no válida en config.json');
            }

            // 1. Iniciar navegador with tiempos de espera aumentados
            browser = await puppeteer.connect({
                browserURL: 'http://localhost:9222',
                defaultViewport: null,
                protocolTimeout: CONFIG.protocolTimeout, // Aumentar timeout para operaciones de protocolo
            });

            setBrowser(browser);
            const page = await browser.newPage();

            // Configurar timeouts de página
            page.setDefaultNavigationTimeout(CONFIG.navegacionTimeout);
            page.setDefaultTimeout(CONFIG.navegacionTimeout);

            // 2. Navegar a prospectos con manejo de errores (usando domcontentloaded para más velocidad)
            await page.goto(PROSPECTOS_URL, {
                waitUntil: 'domcontentloaded',
                timeout: CONFIG.navegacionTimeout
            });

            let prospectosCambiados = contador;

            console.log(`🚀 [${horaActual()}] Iniciando automatización para ${cantidad} prospectos...`);

            // 3. Bucle principal con manejo de errores mejorado
            let mostradoMensajeBusqueda = false;
            let primerLogBusqueda = true; // mostrar 'Buscando tabla...' solo una vez
            let procesandoLead = false; // Nueva bandera para controlar recargas
            let lastSeenRowCount = 0; // cuenta de filas vistas la última vez

            while (prospectosCambiados < cantidad) {
                try {
                    // Verificar si el frame está desconectado
                    try {
                        await page.evaluate(() => true);
                    } catch (frameErr) {
                        if (frameErr.message.includes('detached')) {
                            console.log(`⚠️ [${horaActual()}] Frame desconectado, reconectando...`);
                            await page.goto(PROSPECTOS_URL, {
                                waitUntil: 'domcontentloaded',
                                timeout: CONFIG.navegacionTimeout
                            }).catch(() => { });
                            await esperar(3000);
                            continue;
                        }
                    }

                    // Si estamos procesando un lead, no recargamos
                    if (procesandoLead) {
                        await esperar(1000);
                        continue;
                    }

                    // Recargar la página cada 5 segundos, sin más verificaciones
                    await page.reload().catch(() => { });
                    await esperar(5000);

                    // Marcar que estamos procesando un lead - no recargará
                    procesandoLead = true;

                    // Usar la nueva función para detectar y abrir automáticamente un lead
                    console.log(`🔄 [${horaActual()}] Buscando lead disponible usando observador...`);
                    try {
                        const nombreTexto = await observarYHacerClicEnNuevosLeads(page);

                        // VERIFICACIÓN: Si el lead actual es igual al último procesado, lo saltamos
                        if (nombreTexto === ultimoLeadProcesado) {
                            console.log(`⏩ [${horaActual()}] Lead "${nombreTexto}" ya fue procesado. Saltando...`);
                            procesandoLead = false;

                            // Volver a la lista de prospectos
                            await page.goto(PROSPECTOS_URL, {
                                waitUntil: 'domcontentloaded',
                                timeout: CONFIG.navegacionTimeout
                            }).catch(() => { });

                            continue;
                        }

                        // Actualizar el nombre del último lead procesado
                        ultimoLeadProcesado = nombreTexto;

                        // Contar cada lead nuevo que entra al procesamiento
                        leadsProcesados++;

                        console.log(`🔍 [${horaActual()}] Procesando lead: ${nombreTexto}... (Total procesados: ${leadsProcesados})`);

                        // Intentar extracción en orden: detalle -> sección de detalles del producto -> header
                        console.log(`🔍 [${horaActual()}] Intentando extraer solución (primaria)`);
                        let solucionDetalle = await obtenerSolucionDesdePaginaDetalle(page);

                        if (!solucionDetalle || solucionDetalle.trim() === '') {
                            console.log(`🔍 [${horaActual()}] Estrategia primaria no encontró solución. Probando detalles...`);
                            solucionDetalle = await obtenerSolucionDesdeDetalles(page);
                        }

                        if (!solucionDetalle || solucionDetalle.trim() === '') {
                            console.log(`🔁 [${horaActual()}] Estrategia de detalles no encontró solución. Probando header...`);
                            solucionDetalle = await obtenerSolucionDesdeHeader(page);
                        }

                        const solucionNormalizada = normalizarTexto(solucionDetalle);
                        console.log(`🔄 [${horaActual()}] Solución encontrada (final): "${solucionDetalle}" -> normalizada: "${solucionNormalizada}"`);

                        const esSolucionValida = SOLUCIONES_VALIDAS_NORMALIZADAS.includes(solucionNormalizada);
                        console.log(esSolucionValida)
                        console.log(`${esSolucionValida ? '✅' : '❌'} [${horaActual()}] Solución final es ${esSolucionValida ? 'válida' : 'inválida'}`);

                        if (!esSolucionValida) {
                            console.log(`⏩ [${horaActual()}] Ninguna estrategia encontró una solución válida. Volviendo a prospectos...`);
                            try {
                                await page.goto(PROSPECTOS_URL, { waitUntil: 'networkidle0', timeout: CONFIG.navegacionTimeout });
                            } catch (navErr) {
                                await page.goto(PROSPECTOS_URL, { timeout: 0 }).catch(() => { });
                            }
                            continue;
                        }

                        // Si llegamos aquí, la solución es válida
                        console.log(`✅ [${horaActual()}] Solución válida encontrada. Procediendo con cambio de propietario...`);

                        // Buscar el botón para cambiar propietario
                        const buttonChange = await Promise.race([
                            page.waitForSelector('button[name="ChangeOwnerOne"]', { timeout: 3000 }),
                            page.waitForSelector('div.none li:nth-of-type(1) button', { timeout: 3000 }),
                            page.waitForSelector('button:has-span:contains("Cambiar propietario"))', { timeout: 3000 })
                        ]).catch(() => null);

                        if (!buttonChange) {
                            console.log(`⚠️ [${horaActual()}] No se encontró botón de cambio de propietario`);
                            // Continuar con la siguiente iteración
                            continue;
                        }

                        // Ejecutar el cambio de propietario (flujo completo)
                        console.log(`🔄 [${horaActual()}] Haciendo clic en botón de cambio de propietario...`);
                        await buttonChange.click();

                        // Intentar flujo completo dentro del modal
                        try {
                            // Esperar modal de cambio de propietario
                            const modal = await Promise.race([
                                page.waitForSelector('div[role="dialog"]', { timeout: 5000 }),
                                new Promise(resolve => setTimeout(() => resolve(null), 5000))
                            ]).catch(() => null);

                            if (!modal) {
                                console.log(`⚠️ [${horaActual()}] No apareció el modal de cambio de propietario`);
                            } else {
                                // Buscar input para buscar usuarios
                                const inputChange = await page.waitForSelector('input[title="Buscar Usuarios"]', { timeout: 4000 }).catch(() => null);
                                if (inputChange) {
                                    await inputChange.click().catch(() => { });
                                    await esperar(500);
                                }

                                // Seleccionar usuario específico (Diego Ignacio Alvarez Franco)
                                const usuarioDiego = await page.waitForSelector('div[title="Diego Ignacio Alvarez Franco"]', { timeout: 4000 }).catch(() => null);
                                if (usuarioDiego) {
                                    await usuarioDiego.click().catch(() => { });
                                    await esperar(500);
                                } else {
                                    console.log(`⚠️ [${horaActual()}] No se encontró el usuario objetivo en la lista`);
                                }

                                // Botón enviar/guardar
                                const enviar = await page.waitForSelector('button[title="Enviar"]', { timeout: 4000 }).catch(() => null);
                                if (enviar) {
                                    await enviar.click().catch(() => { });
                                    // Esperar breve para que el cambio se procese
                                    await esperar(1500);

                                    // Detectar posible error en modal
                                    const modalErrorElem = await page.$('.modalError');
                                    const modalError = !!modalErrorElem;
                                    if (modalError) {
                                        const errorMessageElement = await page.$('.changeOwnerErrorMessage');
                                        const errorMessage = errorMessageElement ? await page.evaluate(el => el.textContent, errorMessageElement) : 'Error desconocido';
                                        console.log(`❌ [${horaActual()}] Error al cambiar propietario: ${errorMessage}`);
                                        socket.emit('error-automatizacion', { message: errorMessage, etapa: 'cambio-propietario' });
                                    } else {
                                        // Asumimos éxito si no hay modalError
                                        prospectosCambiados++;
                                        console.log(`✅ [${horaActual()}] Cambio de propietario realizado. Prospectos cambiados: ${prospectosCambiados}`);
                                        socket.emit('prospecto-cambiado', { nombre: nombreTexto, total: prospectosCambiados });
                                    }
                                } else {
                                    console.log(`⚠️ [${horaActual()}] Botón 'Enviar' no encontrado en modal`);
                                }
                            }
                        } catch (errCambio) {
                            console.error(`⚠️ [${horaActual()}] Error durante flujo de cambio de propietario: ${errCambio.message}`);
                            socket.emit('error-automatizacion', { message: errCambio.message, etapa: 'cambio-propietario' });
                        }
                    } catch (error) {
                        console.error(`⚠️ [${horaActual()}] Error en procesamiento de lead: ${error.message}`);
                        socket.emit('error-automatizacion', {
                            message: error.message,
                            etapa: 'procesamiento-lead'
                        });
                    } finally {
                        // Pausa para reducir carga
                        await esperar(CONFIG.tiempoEsperaEntreLeads);

                        // Siempre volver a la lista
                        try {
                            console.log(`🔙 [${horaActual()}] Volviendo a la lista de prospectos...`);
                            await page.goto(PROSPECTOS_URL, {
                                waitUntil: 'networkidle0',
                                timeout: CONFIG.navegacionTimeout
                            });
                        } catch (navError) {
                            // Silenciar errores de navegación
                            // Forzar la navegación incluso si hay timeout
                            await page.goto(PROSPECTOS_URL, { timeout: 0 });
                        }

                        // Marcar que ya no estamos procesando un lead - podemos recargar
                        procesandoLead = false;
                    }

                    if (prospectosCambiados >= cantidad) break;
                } catch (error) {
                    // Manejo de error del bucle principal
                    console.error(`⚠️ [${horaActual()}] Error en bucle principal: ${error.message}`);
                    socket.emit('error-automatizacion', {
                        message: error.message,
                        etapa: 'bucle-principal'
                    });
                    await esperar(5000);
                    procesandoLead = false; // Resetear en caso de error
                }
            }

            // Automatización completada exitosamente
            console.log(`\n🎉 [${horaActual()}] Automatización completada! Total prospectos cambiados: ${prospectosCambiados}, Total leads procesados: ${leadsProcesados}`);
            socket.emit('automatizacion-detenida', { leadsProcesados });
            return; // Salir de la función si todo fue exitoso

        } catch (error) {
            intentosConexion++;
            console.error(`\n❌ [${horaActual()}] Error crítico (intento ${intentosConexion}): ${error.message}`);

            socket.emit('error-automatizacion', {
                message: error.message,
                etapa: error.etapa || 'general',
                intento: intentosConexion
            });

            // Esperar antes de reintentar
            if (intentosConexion < CONFIG.maxReintentoConexion) {
                console.log(`🔄 [${horaActual()}] Reintentando en ${CONFIG.tiempoEsperaEntreReintentos / 1000} segundos...`);
                await esperar(CONFIG.tiempoEsperaEntreReintentos);
            }
        } finally {
            if (browser) {
                try {
                    // Si usas puppeteer.connect, NO cierres el navegador completo
                    const pages = await browser.pages();
                    for (const page of pages) {
                        await page.close();
                    }
                    // No hagas: await browser.close();
                } catch (e) {
                    console.error(`⚠️ [${horaActual()}] Error al cerrar páginas: ${e.message}`);
                }
            }
        }
    }

    // Si llegamos aquí, todos los intentos fallaron
    console.error(`\n❌ [${horaActual()}] Automatización fallida después de ${CONFIG.maxReintentoConexion} intentos`);
    socket.emit('automatizacion-detenida', { error: 'Falló después de múltiples intentos' });
}

// Estrategia alternativa: obtener solución desde la sección de detalles del producto
async function obtenerSolucionDesdeDetalles(page) {
    try {
        return await page.evaluate(() => {
            // 1. Buscar el enlace del producto
            const enlaceProducto = document.querySelector('a[href^="/lightning/r/Product2/"]');
            if (!enlaceProducto) return '';

            // 2. Buscar TODOS los spans dentro del enlace
            const spansEnEnlace = enlaceProducto.querySelectorAll('span');

            // 3. Encontrar el span que tenga innerText no vacío
            for (const span of spansEnEnlace) {
                const texto = span.innerText.trim();
                if (texto !== '') {
                    return texto;
                }
            }

            return '';
        });
    } catch (error) {
        console.log(`⚠️ Error en estrategia detalles: ${error.message}`);
        return '';
    }
}

// Estrategia alternativa: obtener solución desde el header/records-highlights
async function obtenerSolucionDesdeHeader(page) {
    try {
        return await page.evaluate(() => {
            // 1. Buscar el p con title "Solución"
            const pSolucion = Array.from(document.querySelectorAll('p')).find(p =>
                p.getAttribute('title') === 'Solución'
            );

            if (!pSolucion) return '';

            // 2. Subir al contenedor padre
            const contenedorPadre = pSolucion.closest('records-highlights-details-item');
            if (!contenedorPadre) return '';

            // 3. Buscar todos los spans dentro del contenedor
            const todosLosSpans = contenedorPadre.querySelectorAll('span');

            // 4. Encontrar el span que tenga innerText no vacío
            for (const span of todosLosSpans) {
                const texto = span.innerText.trim();
                if (texto !== '') {
                    return texto;
                }
            }

            return '';
        });
    } catch (error) {
        console.log(`⚠️ Error en estrategia header: ${error.message}`);
        return '';
    }
}

// Esperar a que la lista de leads sea visible: versión optimizada
async function esperarAListaVisible(page, timeout = 2000) {
    const start = Date.now();

    // Helper: comprobar si hay overlays o error visibles - versión rápida
    const hayOverlayOError = await page.evaluate(() => {
        const loading = document.querySelector('#auraLoadingBox, .oneLoadingBox, #spinner-container');
        const error = document.querySelector('#auraErrorMask, .auraErrorBox');
        // Versión simplificada de la verificación de visibilidad
        return !!(loading || error);
    }).catch(() => true);

    while ((Date.now() - start) < timeout) {
        // Si hay overlay o error, esperar y reintentar
        if (hayOverlayOError) {
            await esperar(1000);
            // re-evaluar
            const siguiente = await page.evaluate(() => {
                const loading = document.querySelector('#auraLoadingBox') || document.querySelector('.oneLoadingBox') || document.querySelector('#spinner-container');
                const error = document.querySelector('#auraErrorMask') || document.querySelector('.auraErrorBox');
                const visible = el => el && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden';
                return (loading && visible(loading)) || (error && visible(error));
            }).catch(() => true);
            if (!siguiente) return true;
            hayOverlayOError = siguiente;
        }

        // Comprobar si existen filas o anchors de leads
        const existeTabla = await page.evaluate(() => {
            if (document.querySelector('table tbody tr')) return true;
            if (document.querySelector('a.slds-truncate[href^="/lightning/r/"]')) return true;
            return false;
        }).catch(() => false);

        if (existeTabla) return true;

        // Si no hay, esperar un poco y reintentar
        await esperar(800);
    }

    return false;
}

// Esperar por la aparición de nuevas filas en la tabla (usa MutationObserver en el contexto del navegador)
async function esperarPorNuevoLead(page, ultimoCuenta = 0, timeout = 20000) {
    return await page.evaluate((ultimoCuenta, timeout) => {
        return new Promise(resolve => {
            try {
                const selectorTabla = 'div.slds-table_header-fixed_container table, table.slds-table_header-fixed';
                const tabla = document.querySelector(selectorTabla);
                const obtenerCuenta = () => {
                    const t = document.querySelector(selectorTabla);
                    if (!t) return 0;
                    const tb = t.querySelectorAll('tbody > tr');
                    if (tb && tb.length) return tb.length;
                    // fallback a atributo data-num-rows
                    const v = t.getAttribute('data-num-rows');
                    return v ? parseInt(v, 10) : 0;
                };

                // Si ya hay más filas que ultimoCuenta, resolvemos inmediatamente
                const actual = obtenerCuenta();
                if (actual > ultimoCuenta) return resolve({ found: true, count: actual });

                // Si no existe la tabla aún, observamos el contenedor principal
                const contenedor = document.querySelector('div.slds-table_header-fixed_container') || document.querySelector('div.slds-scrollable_y') || document.body;

                const observer = new MutationObserver(() => {
                    const nueva = obtenerCuenta();
                    if (nueva > ultimoCuenta) {
                        observer.disconnect();
                        return resolve({ found: true, count: nueva });
                    }
                });

                observer.observe(contenedor, { childList: true, subtree: true });

                // Timeout fallback
                setTimeout(() => {
                    try { observer.disconnect(); } catch (e) { }
                    const ultima = obtenerCuenta();
                    resolve({ found: ultima > ultimoCuenta, count: ultima });
                }, timeout);
            } catch (e) {
                resolve({ found: false, count: 0 });
            }
        });
    }, ultimoCuenta, timeout).catch(() => ({ found: false, count: 0 }));
}

// Nueva función para detectar y abrir leads automáticamente usando MutationObserver
async function observarYHacerClicEnNuevosLeads(page) {
    console.log(`🔍 [${horaActual()}] Iniciando observación automática de nuevos leads...`);

    try {
        const nombreLead = await page.evaluate(() => {
            return new Promise((resolve, reject) => {
                console.log('🔍 Iniciando observación de nuevos leads...');

                // Configurar MutationObserver
                const observer = new MutationObserver((mutations) => {
                    // Verificar si ya existe algún lead disponible
                    const verificarLeadsExistentes = () => {
                        // Buscar tabla de leads por diferentes selectores
                        const tbody = document.querySelector('tbody[data-rowgroup-body]');
                        if (tbody) {
                            const filas = tbody.querySelectorAll('tr.slds-hint-parent');
                            if (filas && filas.length > 0) {
                                console.log(`✅ Se encontraron ${filas.length} leads existentes`);
                                buscarYHacerClicEnPrimerLead(tbody);
                                return true;
                            }
                        }

                        // Buscar enlaces de leads directamente
                        const enlaces = document.querySelectorAll('a[href^="/lightning/r/00Q"], a[href^="/lightning/r/Lead/"]');
                        if (enlaces && enlaces.length > 0) {
                            console.log(`✅ Se encontraron ${enlaces.length} enlaces a leads`);
                            const leadEncontrado = Array.from(enlaces).find(enlace => {
                                const contenedor = enlace.closest('tr') || enlace.closest('.slds-card');
                                if (contenedor) {
                                    buscarYHacerClicEnLead(contenedor);
                                    return true;
                                }
                                return false;
                            });

                            if (leadEncontrado) return true;
                        }
                        
                        return false;
                    };

                    // Verificar primero si hay leads existentes
                    if (verificarLeadsExistentes()) return;

                    // Si no hay leads existentes, analizar las mutaciones
                    for (const mutation of mutations) {
                        // Verificar si se añadió el tbody
                        if (mutation.type === 'childList') {
                            for (const node of mutation.addedNodes) {
                                // Caso 1: Se añadió el tbody completo
                                if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-rowgroup-body')) {
                                    console.log('✅ tbody detectado - hay leads disponibles');
                                    buscarYHacerClicEnPrimerLead(node);
                                    return;
                                }

                                // Caso 2: Se añadieron nuevas filas dentro del tbody existente
                                if (node.nodeType === 1 && node.tagName === 'TR' &&
                                    node.classList && node.classList.contains('slds-hint-parent')) {
                                    console.log('✅ Nueva fila de lead detectada');
                                    buscarYHacerClicEnLead(node);
                                    return;
                                }
                                
                                // Caso 3: Se añadió otro tipo de elemento que podría contener leads
                                if (node.nodeType === 1 && node.querySelectorAll) {
                                    // Buscar dentro del nodo añadido si hay alguna tabla o enlaces de leads
                                    const tbody = node.querySelector('tbody[data-rowgroup-body]');
                                    if (tbody) {
                                        console.log('✅ tbody detectado dentro de un nuevo elemento');
                                        buscarYHacerClicEnPrimerLead(tbody);
                                        return;
                                    }
                                    
                                    const enlaces = node.querySelectorAll('a[href^="/lightning/r/00Q"], a[href^="/lightning/r/Lead/"]');
                                    if (enlaces && enlaces.length > 0) {
                                        console.log(`✅ Se encontraron ${enlaces.length} enlaces a leads en nuevo elemento`);
                                        const leadEncontrado = Array.from(enlaces).find(enlace => {
                                            const contenedor = enlace.closest('tr') || enlace.closest('.slds-card');
                                            if (contenedor) {
                                                buscarYHacerClicEnLead(contenedor);
                                                return true;
                                            }
                                            return false;
                                        });
                                        if (leadEncontrado) return;
                                    }
                                }
                            }
                        }
                    }
                });

                // Función para buscar y hacer clic en el primer lead del tbody
                function buscarYHacerClicEnPrimerLead(tbody) {
                    const primeraFila = tbody.querySelector('tr.slds-hint-parent');
                    if (primeraFila) {
                        buscarYHacerClicEnLead(primeraFila);
                    } else {
                        console.log('⚠️ tbody vacío - esperando filas...');
                        // Observar el tbody para nuevas filas
                        observer.observe(tbody, {
                            childList: true,
                            subtree: false
                        });
                    }
                }

                // Función para buscar y hacer clic en el enlace del nombre del lead
                function buscarYHacerClicEnLead(filaLead) {
                    // Arreglo de selectores para encontrar enlaces en diferentes formatos
                    const selectoresEnlaces = [
                        'a.slds-truncate[href^="/lightning/r/00Q"]',
                        'a.slds-truncate[href^="/lightning/r/Lead/"]',
                        'a[href^="/lightning/r/00Q"]', 
                        'a[href^="/lightning/r/Lead"]',
                        'a[href*="Lead/"]',
                        'a[title*="Lead"]',
                        'a.slds-truncate'
                    ];
                    
                    // 1. Buscar el force-lookup que contiene el enlace del nombre
                    const forceLookup = filaLead.querySelector('force-lookup');
                    if (forceLookup) {
                        // Intentar todos los selectores
                        for (const selector of selectoresEnlaces) {
                            const enlaceNombre = forceLookup.querySelector(selector);
                            if (enlaceNombre) {
                                const nombreLead = enlaceNombre.textContent.trim();
                                console.log(`🎯 Lead encontrado (selector: ${selector}): "${nombreLead}" - Haciendo clic...`);
                                
                                try {
                                    // Hacer clic en el enlace
                                    enlaceNombre.click();
                                    
                                    // Desconectar observer y resolver
                                    observer.disconnect();
                                    resolve(nombreLead);
                                    return;
                                } catch (err) {
                                    console.log(`⚠️ Error al hacer clic: ${err.message}`);
                                }
                            }
                        }
                    }
                    
                    // 2. Buscar directamente en la fila usando todos los selectores
                    for (const selector of selectoresEnlaces) {
                        const enlaceDirecto = filaLead.querySelector(selector);
                        if (enlaceDirecto) {
                            const nombreLead = enlaceDirecto.textContent.trim();
                            console.log(`🎯 Lead encontrado (selector directo: ${selector}): "${nombreLead}" - Haciendo clic...`);
                            
                            try {
                                enlaceDirecto.click();
                                observer.disconnect();
                                resolve(nombreLead);
                                return;
                            } catch (err) {
                                console.log(`⚠️ Error al hacer clic: ${err.message}`);
                            }
                        }
                    }
                    
                    // 3. Buscar cualquier elemento que parezca un lead
                    const elementosPosibles = filaLead.querySelectorAll('a, span, div');
                    for (const elem of elementosPosibles) {
                        const texto = elem.textContent.trim();
                        // Buscar elementos que parezcan contener un nombre de lead
                        if ((texto.includes(' ') || texto.length > 8) && elem.tagName === 'A') {
                            console.log(`🎯 Posible lead encontrado por texto: "${texto}" - Intentando clic...`);
                            try {
                                elem.click();
                                observer.disconnect();
                                resolve(texto);
                                return;
                            } catch (err) {
                                console.log(`⚠️ Error al hacer clic: ${err.message}`);
                            }
                        }
                    }
                    
                    console.log('⚠️ No se pudo encontrar el enlace del lead');
                }

                // Verificar si el tbody ya existe al inicio
                const tbodyExistente = document.querySelector('tbody[data-rowgroup-body]');
                if (tbodyExistente) {
                    console.log('✅ tbody ya existe - buscando leads...');
                    buscarYHacerClicEnPrimerLead(tbodyExistente);
                } else {
                    console.log('⏳ Esperando a que aparezca tbody...');
                    // Observar el contenedor padre (table) para cuando aparezca el tbody
                    const tablaContenedora = document.querySelector('table') ||
                        document.querySelector('.slds-table') ||
                        document.querySelector('.slds-table_header-fixed_container') ||
                        document.querySelector('.slds-card__body') ||
                        document.querySelector('.slds-grid');

                    if (tablaContenedora) {
                        console.log('✅ Encontrada estructura contenedora - observando cambios...');
                        observer.observe(tablaContenedora, {
                            childList: true,
                            subtree: true // Cambio a true para detectar cambios más profundos
                        });
                    } else {
                        // Si no encuentra ninguna tabla, observar el cuerpo del documento para detectar cambios
                        console.log('⚠️ No se encontró tabla contenedora - observando el documento completo');
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true
                        });
                        
                        // También intentar observar cuando aparezca el contenedor de la aplicación
                        const checkForContainer = setInterval(() => {
                            const container = document.querySelector('.slds-table') || 
                                             document.querySelector('.slds-card__body') ||
                                             document.querySelector('#brandBand_2');
                            
                            if (container) {
                                clearInterval(checkForContainer);
                                console.log('✅ Contenedor encontrado posteriormente - reasignando observador');
                                observer.disconnect();
                                observer.observe(container, {
                                    childList: true,
                                    subtree: true
                                });
                            }
                        }, 1000); // Comprobar cada segundo
                    }
                }

                // Timeout de seguridad (aumentado a 45 segundos)
                setTimeout(() => {
                    // Antes de fallar, hacer un último intento de buscar leads en toda la página
                    console.log('⚠️ Se alcanzó el tiempo límite - haciendo último intento de búsqueda...');
                    
                    // Buscar cualquier enlace que parezca un lead
                    const todosLosEnlaces = document.querySelectorAll('a[href*="/lightning/r/"]');
                    
                    if (todosLosEnlaces && todosLosEnlaces.length > 0) {
                        console.log(`✅ Encontrados ${todosLosEnlaces.length} posibles enlaces en último intento`);
                        
                        // Filtrar los enlaces que parezcan leads
                        const posiblesLeads = Array.from(todosLosEnlaces).filter(enlace => 
                            enlace.href.includes('/Lead/') || 
                            enlace.href.includes('/00Q') ||
                            (enlace.textContent && enlace.textContent.trim().length > 0 && enlace.textContent.includes(' '))
                        );
                        
                        if (posiblesLeads.length > 0) {
                            const enlace = posiblesLeads[0];
                            const nombreLead = enlace.textContent.trim() || 'Lead sin nombre';
                            console.log(`🎯 Lead encontrado en último intento: "${nombreLead}" - Haciendo clic...`);
                            
                            try {
                                enlace.click();
                                observer.disconnect();
                                resolve(nombreLead);
                                return;
                            } catch (err) {
                                console.log(`⚠️ Error al hacer clic en último intento: ${err.message}`);
                            }
                        }
                    }
                    
                    // Si no funciona el último intento, intentar navegar a la vista de leads
                    try {
                        // Buscar el enlace "Leads" en la navegación
                        const enlacesNavegacion = document.querySelectorAll('a');
                        const enlaceLista = Array.from(enlacesNavegacion).find(a => 
                            a.textContent && a.textContent.toLowerCase().includes('lead') && 
                            !a.href.includes('/lightning/r/') // Excluir enlaces a leads específicos
                        );
                        
                        if (enlaceLista) {
                            console.log('🔄 Intentando navegar a la lista de leads...');
                            enlaceLista.click();
                            
                            // Dar algo de tiempo para que cargue la página y resolver con mensaje especial
                            setTimeout(() => {
                                observer.disconnect();
                                resolve('__NAVEGADO_A_LISTA__'); // Valor especial para indicar que se navegó a la lista
                            }, 2000);
                            return;
                        }
                    } catch (err) {
                        console.log(`⚠️ Error al intentar navegar a la lista: ${err.message}`);
                    }
                    
                    // Si todo falla, rechazar con error
                    observer.disconnect();
                    reject(new Error('Timeout: No se detectaron nuevos leads en 45 segundos'));
                }, 45000);
            });
        });
        
        // Verificar si se recibió el valor especial que indica navegación a la lista
        if (nombreLead === '__NAVEGADO_A_LISTA__') {
            console.log(`🔄 [${horaActual()}] Navegado a la lista de leads - intentando nuevamente...`);
            await esperar(2000); // Esperar a que la página cargue
            // Recursivamente llamar a la función otra vez para intentar encontrar leads en la nueva página
            return await observarYHacerClicEnNuevosLeads(page);
        }
        
        console.log(`✅ [${horaActual()}] Lead detectado y abierto: "${nombreLead}"`);
        await esperar(2000); // Esperar a que la página del lead cargue completamente
        return nombreLead;
    } catch (error) {
        console.log(`❌ [${horaActual()}] Error al observar y hacer clic en leads: ${error.message}`);
        
        // Si el error es porque no encontró la tabla, intentar refrescar la página y reintentar
        if (error.message.includes('No se encontró la tabla contenedora') || 
            error.message.includes('Timeout: No se detectaron nuevos leads')) {
            console.log(`🔄 [${horaActual()}] Intentando refrescar la página y reintentar...`);
            
            try {
                // Intentar navegar a la lista de leads (URL relativa)
                await page.goto('/lightning/o/Lead/list', { waitUntil: 'networkidle0' });
                console.log(`🔄 [${horaActual()}] Página refrescada - esperando 3 segundos...`);
                await esperar(3000); // Dar tiempo a que cargue la página
                
                // Reintentar la operación
                return await observarYHacerClicEnNuevosLeads(page);
            } catch (refreshError) {
                console.log(`❌ [${horaActual()}] Error al refrescar la página: ${refreshError.message}`);
                throw error; // Mantener el error original
            }
        }
        
        throw error;
    }
}