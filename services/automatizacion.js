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
const horaActual = () => format(new Date(), { time: 'short' });

// URL de la lista de prospectos
const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';

// Configuración para tiempos de espera y reintentos
const CONFIG = {
    navegacionTimeout: 60000,      // 60 segundos para navegación
    protocolTimeout: 60000,        // 60 segundos para operaciones de protocolo
    maxReintentoConexion: 3,       // Número máximo de reintentos de conexión
    tiempoEsperaEntreReintentos: 5000, // 5 segundos entre reintentos
    tiempoEsperaEntreLeads: 3000   // 3 segundos entre leads para reducir carga
};

export async function automatizar(socket, setBrowser) {
    let browser;
    let intentosConexion = 0;

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

            // 1. Iniciar navegador con tiempos de espera aumentados
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
            while (prospectosCambiados < cantidad) {
                try {
                    // Recarga silenciosa con manejo de errores
                    await page.reload({
                        waitUntil: 'networkidle0',
                        timeout: CONFIG.navegacionTimeout
                    }).catch(() => {
                        // Silenciar errores de recarga para mantener log limpio
                    });

                    const tablaLeads = await page.$('table[aria-label="Antioquia - PYF"]');
                    if (!tablaLeads) {
                        if (!mostradoMensajeBusqueda) {
                            console.log(`🔍 [${horaActual()}] Buscando tabla de leads...`);
                            mostradoMensajeBusqueda = true;
                        }
                        await esperar(5000);
                        continue;
                    }

                    // Reiniciar la bandera cuando encuentra la tabla
                    mostradoMensajeBusqueda = false;

                    // Mostrar mensaje al analizar un nuevo lead
                    console.log(`🔍 [${horaActual()}] Analizando nuevos leads (${prospectosCambiados + 1}/${cantidad})...`);

                    const leads = await page.$$('table tbody tr');
                    let leadProcesado = false;

                    for (const lead of leads) {
                        try {
                            // Abrir lead directamente sin evaluar la solución previamente
                            const nombreLead = await lead.$('a.slds-truncate[href^="/lightning/r/"]');
                            if (!nombreLead) {
                                console.log(`⚠️ [${horaActual()}] No se pudo encontrar el enlace del lead`);
                                continue;
                            }

                            // Extraer el nombre del lead para mostrar en log
                            const nombreTexto = await lead.$eval('a.slds-truncate[href^="/lightning/r/"]', el => el.textContent.trim())
                                .catch(() => 'Lead sin nombre');
                            console.log(`🔍 [${horaActual()}] Abriendo lead: ${nombreTexto}...`);

                            try {
                                await Promise.all([
                                    nombreLead.click(),
                                    page.waitForNavigation({
                                        waitUntil: 'networkidle0',
                                        timeout: CONFIG.navegacionTimeout
                                    })
                                ]);
                            } catch (navError) {
                                console.log(`⚠️ [${horaActual()}] Error en navegación: ${navError.message}`);
                                // Verificar si la página cambió a pesar del error
                                if (!(page.url()).includes('list?filterName=')) {
                                    console.log(`🔄 [${horaActual()}] Continuando a pesar del error de navegación...`);
                                } else {
                                    // Si estamos todavía en la lista, saltamos este lead
                                    throw new Error('Fallo al abrir lead');
                                }
                            }

                            // Ahora dentro del lead, validar si está el botón Cambiar propietario
                            const buttonChange = await Promise.race([
                                page.waitForSelector('button[name="ChangeOwnerOne"]', { timeout: 3000 }),
                                page.waitForSelector('div.none li:nth-of-type(1) button', { timeout: 3000 }),
                                page.waitForSelector('button:has(span:contains("Cambiar propietario"))', { timeout: 3000 })
                            ]).catch(() => null);

                            if (!buttonChange) {
                                console.log(`⏩ [${horaActual()}] Lead no requiere cambio. Volviendo...`);
                                await page.goto(PROSPECTOS_URL, {
                                    waitUntil: 'networkidle0',
                                    timeout: CONFIG.navegacionTimeout
                                });
                                continue;
                            }

                            // Evaluar la solución dentro del lead
                            const solucionTexto = await page.evaluate(() => {
                                // Buscar en diferentes ubicaciones donde podría estar la solución
                                const solucionLabel = Array.from(document.querySelectorAll('span.test-id__field-label, div.test-id__field-label'))
                                    .find(el => el.textContent.includes('Solución'));
                                
                                if (solucionLabel) {
                                    const solucionValue = solucionLabel.closest('div.slds-form-element')
                                        ?.querySelector('span.test-id__field-value, div.test-id__field-value');
                                    return solucionValue ? solucionValue.textContent.trim() : '';
                                }
                                return '';
                            }).catch(() => '');

                            console.log(`🔎 [${horaActual()}] Solución encontrada dentro del lead: "${solucionTexto}"`);
                            
                            // Normalizar y verificar si es una solución válida
                            const solucionNormalizada = normalizarTexto(solucionTexto);
                            if (!SOLUCIONES_VALIDAS_NORMALIZADAS.includes(solucionNormalizada)) {
                                console.log(`❌ [${horaActual()}] Solución no válida: ${solucionTexto}, volviendo...`);
                                await page.goto(PROSPECTOS_URL, {
                                    waitUntil: 'networkidle0',
                                    timeout: CONFIG.navegacionTimeout
                                });
                                continue;
                            }
                            
                            console.log(`✅ [${horaActual()}] Solución válida: "${solucionTexto}" - Procediendo con cambio de propietario...`);
                            leadProcesado = true;

                            // Proceder con el cambio de propietario
                            console.log(`🔄 [${horaActual()}] Cambiando propietario...`);

                            // MEJORA 4: Hacemos un intento robusto de clic en el botón
                            await buttonChange.click().catch(async () => {
                                // Si falla el clic directo, intentar con evaluación
                                await page.evaluate(() => {
                                    const buttons = Array.from(document.querySelectorAll('button'));
                                    const changeButton = buttons.find(b => 
                                        b.getAttribute('name') === 'ChangeOwnerOne' || 
                                        (b.textContent && b.textContent.includes('Cambiar propietario'))
                                    );
                                    if (changeButton) changeButton.click();
                                });
                            });

                            // Esperamos el modal con timeout aumentado
                            const modal = await page.waitForSelector('div[role="dialog"]', {
                                timeout: 10000
                            }).catch(() => null);

                            if (modal) {
                                // MEJORA 5: Buscar usuario con múltiples selectores
                                let inputChange = await Promise.race([
                                    page.waitForSelector('input[title="Buscar Usuarios"]', { timeout: 5000 }),
                                    page.waitForSelector('#\\31 2\\:997\\;a', { timeout: 5000 }),
                                    page.waitForSelector('input[placeholder*="Buscar"]', { timeout: 5000 })
                                ]).catch(() => null);

                                if (inputChange) {
                                    await inputChange.click().catch(() => null);
                                    await inputChange.type('Diego Ignacio Alvarez Franco', { delay: 100 }).catch(() => null);

                                    // MEJORA 6: Seleccionar usuario con múltiples selectores
                                    await esperar(1000);
                                    const diego = await Promise.race([
                                        page.waitForSelector('div[title="Diego Ignacio Alvarez Franco"]', { timeout: 5000 }),
                                        page.waitForSelector('li.highlighted div.primaryLabel span', { timeout: 5000 }),
                                        page.waitForSelector('li:has-text("Diego Ignacio")', { timeout: 5000 })
                                    ]).catch(() => null);

                                    if (diego) {
                                        await diego.click().catch(() => null);

                                        // MEJORA 7: Botón enviar con múltiples selectores
                                        await esperar(1000);
                                        const enviar = await Promise.race([
                                            page.waitForSelector('button[title="Enviar"]', { timeout: 5000 }),
                                            page.waitForSelector('button.uiButton--default > span', { timeout: 5000 }),
                                            page.waitForSelector('button:has-text("Enviar")', { timeout: 5000 })
                                        ]).catch(() => null);

                                        if (enviar) {
                                            await enviar.click().catch(() => null);

                                            // Verificación de errores con tiempo de espera más largo
                                            await esperar(3000);
                                            const modalError = await page.$('div[class*="modalError"]');

                                            if (modalError) {
                                                const errorMsg = await page.$eval(
                                                    '.changeOwnerErrorMessage, div[class*="error"]',
                                                    el => el.textContent?.trim()
                                                ).catch(() => 'Error desconocido');

                                                console.log(`❌ [${horaActual()}] Error en cambio: ${errorMsg}`);
                                                socket.emit('error-automatizacion', {
                                                    message: errorMsg,
                                                    etapa: 'cambio-propietario'
                                                });
                                            } else {
                                                // Éxito
                                                prospectosCambiados++;
                                                console.log(`✅ [${horaActual()}] Cambio exitoso! Total: ${prospectosCambiados}`);
                                                socket.emit('update-leads', { count: prospectosCambiados });

                                                // Actualizar contador en tiempo real
                                                config.contador = prospectosCambiados;
                                                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                                            }
                                        } else {
                                            console.log(`⚠️ [${horaActual()}] Botón Enviar no encontrado`);
                                        }
                                    } else {
                                        console.log(`⚠️ [${horaActual()}] Usuario no encontrado en la búsqueda`);
                                    }
                                } else {
                                    console.log(`⚠️ [${horaActual()}] Campo de búsqueda no encontrado`);
                                }
                            } else {
                                console.log(`⚠️ [${horaActual()}] Modal no apareció`);
                                socket.emit('error-automatizacion', {
                                    message: 'Modal no apareció',
                                    etapa: 'cambio-propietario'
                                });
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
                                await page.goto(PROSPECTOS_URL, {
                                    waitUntil: 'networkidle0',
                                    timeout: CONFIG.navegacionTimeout
                                });
                            } catch (navError) {
                                // Silenciar errores de navegación
                                // Forzar la navegación incluso si hay timeout
                                await page.goto(PROSPECTOS_URL, { timeout: 0 });
                            }
                        }

                        if (prospectosCambiados >= cantidad) break;
                    }

                    // No hacemos espera adicional si se procesó un lead
                    if (!leadProcesado) {
                        await esperar(5000);
                    }
                } catch (bucleError) {
                    // Errores silenciosos en el bucle principal para mantener logs limpios
                    try {
                        await page.goto(PROSPECTOS_URL, { timeout: CONFIG.navegacionTimeout });
                    } catch (e) {
                        await page.reload({ waitUntil: 'domcontentloaded' });
                    }
                    await esperar(5000);
                }
            }

            // Automatización completada exitosamente
            console.log(`\n🎉 [${horaActual()}] Automatización completada! Total prospectos: ${prospectosCambiados}`);
            socket.emit('automatizacion-detenida');
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