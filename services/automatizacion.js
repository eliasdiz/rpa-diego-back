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
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
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

// Función para hora actual (formato HH:MM:SS)
const horaActual = () => format(new Date(), { time: 'medium' });

// URL de la lista de prospectos
const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';

// Configuración para tiempos de espera y reintentos
const CONFIG = {
    navegacionTimeout: 90000,      // Aumentado de 60s a 90s 
    protocolTimeout: 120000,       // Aumentado de 60s a 120s
    maxReintentoConexion: 3,
    maxReintentosApertura: 3,      // NUEVO: Reintentos específicos para apertura de leads
    tiempoEsperaEntreReintentos: 5000,
    tiempoEsperaEntreLeads: 3000,
    tiempoEntreRecargas: 4000      // NUEVO: Tiempo explícito entre recargas de la página
};

// Función robusta para abrir leads con múltiples estrategias y reintentos
async function abrirLeadRobusto(page, lead, nombreTexto) {
    console.log(`🔍 [${horaActual()}] Abriendo lead: ${nombreTexto}...`);

    // Extraer la URL del lead para navegación directa
    let leadUrl = '';
    try {
        leadUrl = await lead.$eval('a.slds-truncate[href^="/lightning/r/"]', el => el.getAttribute('href'));
        // Asegurar que es una URL absoluta
        if (leadUrl && !leadUrl.startsWith('http')) {
            // Construir URL absoluta basada en la URL actual
            const baseUrl = new URL(page.url()).origin;
            leadUrl = `${baseUrl}${leadUrl}`;
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
                // Si no tenemos URL, saltar a estrategia 2
                throw new Error('URL no disponible');
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
                    const nombreLead = await lead.$('a.slds-truncate[href^="/lightning/r/"]');
                    if (nombreLead) await nombreLead.click();
                    else throw new Error('Elemento de lead no encontrado');
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
            console.log(`👤 [${horaActual()}] Lead ${i+1}: "${nombre}"`);
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
        const solucionTexto = await page.evaluate(() => {
            // Buscar el bloque de detalle de solución
            const etiquetaSolucion = document.querySelector('p.slds-text-title[title="Solución"]');
            if (!etiquetaSolucion) return '';

            const bloqueDetalle = etiquetaSolucion.closest('.slds-page-header__detail-block');
            if (!bloqueDetalle) return '';

            // Buscar el texto de la solución en los elementos hijos
            // 1. Buscar el span anidado
            const spanSolucion = bloqueDetalle.querySelector('span.slds-truncate, span[lwc-47ngqe6rvah]');
            if (spanSolucion && spanSolucion.textContent) return spanSolucion.textContent.trim();

            // 2. Buscar el enlace
            const enlaceSolucion = bloqueDetalle.querySelector('a.slds-truncate');
            if (enlaceSolucion && enlaceSolucion.textContent) return enlaceSolucion.textContent.trim();

            // 3. Buscar cualquier texto dentro del bloque
            const posibleTexto = bloqueDetalle.textContent;
            if (posibleTexto) return posibleTexto.trim();

            return '';
        });

        console.log(`🔎 [${horaActual()}] Solución encontrada en página detalle: "${solucionTexto}"`);
        return solucionTexto;
    } catch (error) {
        console.log(`⚠️ [${horaActual()}] Error al extraer solución desde detalle: ${error.message}`);
        return '';
    }
}

export async function automatizar(socket, setBrowser) {
    let browser;
    let intentosConexion = 0;
    let leadsProcesados = 0; // Nuevo contador de leads procesados

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

            // 2. Navegar a prospectos con manejo de errores
            await page.goto(PROSPECTOS_URL, {
                waitUntil: 'networkidle0',
                timeout: CONFIG.navegacionTimeout
            });

            let prospectosCambiados = contador;

            console.log(`🚀 [${horaActual()}] Iniciando automatización para ${cantidad} prospectos...`);

            // 3. Bucle principal con manejo de errores mejorado
            let mostradoMensajeBusqueda = false;
            let procesandoLead = false; // Nueva bandera para controlar recargas

            while (prospectosCambiados < cantidad) {
                try {
                    // Solo recargamos si NO estamos procesando un lead actualmente
                    if (!procesandoLead) {
                        // Esperar explícitamente antes de recargar
                        await esperar(CONFIG.tiempoEntreRecargas);
                        
                        // console.log(`🔄 [${horaActual()}] Recargando página de prospectos...`);
                        
                        // Recarga más rápida usando domcontentloaded
                        await page.reload({
                            waitUntil: 'domcontentloaded',
                            timeout: CONFIG.navegacionTimeout
                        }).catch(() => { });
                    }
                    
                    // Esperar solo por la tabla, no por toda la página
                    const tablaLeads = await Promise.race([
                        page.$('table tbody tr'),
                        page.$('div.slds-table_header-fixed_container table tbody tr'),
                        new Promise(resolve => setTimeout(() => resolve(null), 5000))
                    ]);

                    // Si estamos procesando un lead, saltamos el resto del bucle
                    if (procesandoLead) {
                        await esperar(1000);
                        continue;
                    }

                    // Extraer y mostrar todos los datos de la tabla
                    if (tablaLeads) {
                        console.log(`✅ [${horaActual()}] Tabla encontrada, extrayendo datos...`);
                        await extraerTodosLosDatosDeLaTabla(page);
                    }

                    if (!tablaLeads) {
                        if (!mostradoMensajeBusqueda) {
                            console.log(`🔍 [${horaActual()}] Buscando tabla con leads...`);
                            mostradoMensajeBusqueda = true;
                        }
                        await esperar(5000);
                        continue;
                    }

                    // Selector robusto para la tabla de leads Salesforce
                    const tabla = await page.$('table.slds-table_header-fixed');
                    const leads = tabla
                        ? await tabla.$$('tbody > tr')
                        : [];
                    console.log(`✅ [${horaActual()}] Encontrados ${leads.length} leads en la tabla`);
                    mostradoMensajeBusqueda = false;
                    console.log(`🔍 [${horaActual()}] Analizando nuevos leads (${prospectosCambiados + 1}/${cantidad})...`);

                    for (const lead of leads) {
                        try {
                            // Marcar que estamos procesando un lead - no recargará
                            procesandoLead = true;

                            // Contar cada lead que entra al procesamiento
                            leadsProcesados++;

                            // Extraer el nombre del lead para mostrar en log
                            const nombreTexto = await lead.$eval('a.slds-truncate[href^="/lightning/r/"]',
                                el => el.textContent.trim()).catch(() => 'Lead sin nombre');

                            console.log(`🔍 [${horaActual()}] Procesando lead: ${nombreTexto}... (Total procesados: ${leadsProcesados})`);

                            // Usar la función robusta que ya existe para abrir el lead
                            await abrirLeadRobusto(page, lead, nombreTexto);

                            // AQUÍ AÑADIMOS LA EVALUACIÓN DE LA SOLUCIÓN
                            console.log(`🔍 [${horaActual()}] Evaluando solución del lead...`);
                            const solucionDetalle = await obtenerSolucionDesdePaginaDetalle(page);
                            const solucionNormalizada = normalizarTexto(solucionDetalle);

                            // Verificar si es una solución válida
                            const esSolucionValida = SOLUCIONES_VALIDAS_NORMALIZADAS.includes(solucionNormalizada);
                            console.log(`${esSolucionValida ? '✅' : '❌'} [${horaActual()}] Solución "${solucionDetalle}" es ${esSolucionValida ? 'válida' : 'inválida'}`);

                            // Solo proceder si la solución es válida
                            if (!esSolucionValida) {
                                console.log(`⏩ [${horaActual()}] Lead con solución inválida. Volviendo...`);
                                await page.goto(PROSPECTOS_URL, {
                                    waitUntil: 'networkidle0',
                                    timeout: CONFIG.navegacionTimeout
                                });
                                continue;
                            }

                            // Buscar el botón para cambiar propietario
                            const buttonChange = await Promise.race([
                                page.waitForSelector('button[name="ChangeOwnerOne"]', { timeout: 3000 }),
                                page.waitForSelector('div.none li:nth-of-type(1) button', { timeout: 3000 }),
                                page.waitForSelector('button:has-span:contains("Cambiar propietario"))', { timeout: 3000 })
                            ]).catch(() => null);

                            if (!buttonChange) {
                                console.log(`⏩ [${horaActual()}] Lead no requiere cambio. Volviendo...`);
                                // Aquí falta el código para cambiar el propietario
                                // ...
                            }

                            // Aquí agregarías la implementación del cambio de propietario
                            // ...

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
                    }
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