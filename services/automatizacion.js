import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { format } from '@formkit/tempo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../config/config.json');

// Constantes
const SOLUCIONES_VALIDAS = [
    'Plan vive',
    'Salud familiar',
    'Salud evoluciona familiar',
    'Plan credito protegido'
];

// Función para hora actual (formato HH:MM:SS)
const horaActual = () => format(new Date(), { time: 'short' });

const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF';

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
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        continue;
                    }

                    // Reiniciar la bandera cuando encuentra la tabla
                    mostradoMensajeBusqueda = false;
                    
                    // Mostrar mensaje al analizar un nuevo lead
                    console.log(`🔍 [${horaActual()}] Analizando nuevo lead (${prospectosCambiados + 1}/${cantidad})...`);
                    
                    const leads = await page.$$('table tbody tr');
                    let leadProcesado = false;

                    for (const lead of leads) {
                        try {
                            // 3.1 Validar estado (silencioso)
                            const estado = await lead.$eval(
                                'td[data-label="Estado de prospecto"] span',
                                el => el.textContent.trim()
                            ).catch(() => '');

                            if (estado === 'Abierto') continue;

                            // 3.2 Procesar nuevo lead
                            leadProcesado = true;
                            
                            // Abrir lead con manejo de errores mejorado
                            const nombreLead = await lead.$('a.slds-truncate[href^="/lightning/r/"]');
                            if (!nombreLead) continue;

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
                                if (!(await page.url()).includes('list?filterName=')) {
                                    console.log(`🔄 [${horaActual()}] Continuando a pesar del error de navegación...`);
                                } else {
                                    // Si estamos todavía en la lista, saltamos este lead
                                    throw new Error('Fallo al abrir lead');
                                }
                            }

                            // 3.3 Validar botón cambio propietario
                            const buttonChange = await page.waitForSelector('button[name="ChangeOwnerOne"]', {
                                timeout: 5000
                            }).catch(() => null);

                            if (!buttonChange) {
                                console.log(`⏩ [${horaActual()}] Lead no requiere cambio. Volviendo...`);
                                await page.goto(PROSPECTOS_URL, { 
                                    waitUntil: 'networkidle0',
                                    timeout: CONFIG.navegacionTimeout 
                                });
                                continue;
                            }

                            // 3.4 Validar solución con manejo mejorado de errores
                            const solucionTexto = await page.$eval(
                                'records-highlights-details-item p[title="Solución"] + p force-lookup a span',
                                el => el.textContent.trim()
                            ).catch(() => '');

                            const solucionNormalizada = solucionTexto.toLowerCase().trim();
                            const solucionesValidasNormalizadas = SOLUCIONES_VALIDAS.map(s => s.toLowerCase().trim());

                            if (!solucionesValidasNormalizadas.includes(solucionNormalizada)) {
                                console.log(`❌ [${horaActual()}] Solución no válida: ${solucionTexto}`);
                                socket.emit('error-automatizacion', {
                                    message: `Solución no válida: ${solucionTexto}`,
                                    etapa: 'validacion-solucion'
                                });
                                continue;
                            }

                            console.log(`✓ [${horaActual()}] Solución válida: "${solucionTexto}" - Procediendo con cambio...`);

                            // 3.5 Cambio de propietario con manejo mejorado
                            console.log(`🔄 [${horaActual()}] Cambiando propietario...`);
                            
                            // Hacemos un intento robusto de clic en el botón
                            await page.evaluate((buttonSelector) => {
                                const button = document.querySelector(buttonSelector);
                                if (button) button.click();
                            }, 'button[name="ChangeOwnerOne"]').catch(() => null);
                            
                            // Esperamos el modal con timeout aumentado
                            const modal = await page.waitForSelector('div[role="dialog"]', { 
                                timeout: 10000 
                            }).catch(() => null);
                            
                            if (modal) {
                                // Paso 1: Buscar usuario con reintentos si falla
                                let inputChange;
                                for (let i = 0; i < 3; i++) {
                                    inputChange = await page.waitForSelector('input[title="Buscar Usuarios"]', {
                                        timeout: 5000
                                    }).catch(() => null);
                                    
                                    if (inputChange) break;
                                    await page.waitForTimeout(1000);
                                }
                                
                                if (inputChange) {
                                    await inputChange.click().catch(() => null);
                                    await inputChange.type('Diego Ignacio Alvarez Franco', { delay: 100 }).catch(() => null);

                                    // Paso 2: Seleccionar usuario con espera adecuada
                                    await page.waitForTimeout(1000);
                                    const diego = await page.waitForSelector('div[title="Diego Ignacio Alvarez Franco"]', {
                                        timeout: 5000
                                    }).catch(() => null);
                                    
                                    if (diego) {
                                        await diego.click().catch(() => null);
                                        
                                        // Paso 3: Confirmar con espera adecuada
                                        const enviar = await page.waitForSelector('button[title="Enviar"]', {
                                            timeout: 5000
                                        }).catch(() => null);
                                        
                                        if (enviar) {
                                            await enviar.click().catch(() => null);
                                            
                                            // Verificación de errores con tiempo de espera más largo
                                            await page.waitForTimeout(3000);
                                            const modalError = await page.$('div[class="modalError"]');

                                            if (modalError) {
                                                const errorMsg = await page.$eval(
                                                    '.changeOwnerErrorMessage', 
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
                            await page.waitForTimeout(CONFIG.tiempoEsperaEntreLeads);
                            
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
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                } catch (bucleError) {
                    // Errores silenciosos en el bucle principal para mantener logs limpios
                    try {
                        await page.goto(PROSPECTOS_URL, { timeout: CONFIG.navegacionTimeout });
                    } catch (e) {
                        await page.reload({ waitUntil: 'domcontentloaded' });
                    }
                    await page.waitForTimeout(5000);
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
                console.log(`🔄 [${horaActual()}] Reintentando en ${CONFIG.tiempoEsperaEntreReintentos/1000} segundos...`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.tiempoEsperaEntreReintentos));
            }
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (e) {
                    console.error(`⚠️ [${horaActual()}] Error al cerrar navegador: ${e.message}`);
                }
            }
        }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    console.error(`\n❌ [${horaActual()}] Automatización fallida después de ${CONFIG.maxReintentoConexion} intentos`);
    socket.emit('automatizacion-detenida', { error: 'Falló después de múltiples intentos' });
}