// 🤖 AUTOMATIZACIÓN CONECTANDO A NAVEGADOR EXISTENTE
// Se conecta al navegador que ya tienes abierto en puerto 9222

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('🚀 Iniciando automatización conectando a navegador existente...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../config/config.json');

// Función para hora actual
const horaActual = () => new Date().toLocaleTimeString();

// Función para normalizar texto (igual que tu automatización)
function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Soluciones válidas (igual que tu automatización)
const SOLUCIONES_VALIDAS = [
    'Plan vive',
    'Salud familiar',
    'Salud evoluciona familiar',
    'Plan credito protegido'
];

const SOLUCIONES_VALIDAS_NORMALIZADAS = SOLUCIONES_VALIDAS.map(s => normalizarTexto(s));
console.log('✅ Soluciones válidas normalizadas:', SOLUCIONES_VALIDAS_NORMALIZADAS);

// URL de leads (igual que tu automatización)
const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';

export async function automatizarConectandoExistente() {
    console.log(`🚀 [${horaActual()}] Iniciando automatización conectando a navegador existente...`);

    let browser;
    let page;
    let leadsProcesados = 0;
    let prospectosCambiados = 0;

    try {
        // Leer configuración
        console.log(`📋 [${horaActual()}] Leyendo configuración...`);
        
        let config;
        try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            console.log(`✅ [${horaActual()}] Configuración leída correctamente`);
        } catch (configError) {
            console.error(`❌ [${horaActual()}] Error leyendo configuración: ${configError.message}`);
            throw configError;
        }
        
        const { email, passwordHash, cantidad, contador = 0 } = config;

        console.log(`📊 [${horaActual()}] Config - Email: ${email}, Cantidad: ${cantidad}, Contador: ${contador}`);

        if (!email || !passwordHash || !cantidad) {
            throw new Error('Configuración incompleta en config.json');
        }

        console.log(`📋 [${horaActual()}] Objetivo: ${cantidad} prospectos`);

        // Conectar al navegador existente
        console.log(`🔗 [${horaActual()}] Conectando al navegador existente en puerto 9222...`);
        
        try {
            browser = await chromium.connectOverCDP('http://localhost:9222');
            console.log(`✅ [${horaActual()}] Conectado al navegador existente`);
        } catch (connectError) {
            console.error(`❌ [${horaActual()}] Error conectando al navegador: ${connectError.message}`);
            throw new Error(`No se pudo conectar al navegador en puerto 9222: ${connectError.message}`);
        }

        // Usar el contexto existente (donde ya tienes login)
        const contexts = browser.contexts();
        console.log(`📊 [${horaActual()}] Contextos disponibles: ${contexts.length}`);
        
        if (contexts.length === 0) {
            throw new Error('No se encontraron contextos en el navegador');
        }
        
        const context = contexts[0];
        console.log(`📑 [${horaActual()}] Usando contexto con ${context.pages().length} pestañas`);

        // Crear nueva página para nuestra automatización
        page = await context.newPage();
        console.log(`📄 [${horaActual()}] Nueva página creada`);

        console.log(`🌐 [${horaActual()}] Navegando a lista de leads...`);
        await page.goto(PROSPECTOS_URL);
        console.log(`✅ [${horaActual()}] Navegación completada`);

        prospectosCambiados = contador;
        console.log(`📊 [${horaActual()}] Empezando desde contador: ${prospectosCambiados}`);

        // BUCLE PRINCIPAL (igual que tu automatización)
        let intentos = 0;
        const maxIntentos = 50; // Más intentos para encontrar leads

        while (prospectosCambiados < cantidad && intentos < maxIntentos) {
            intentos++;
            console.log(`\n🔄 [${horaActual()}] Intento ${intentos}: Recargando página para buscar nuevos leads...`);
            
            // Recargar página cada 5 segundos
            await page.reload();
            console.log(`⏳ [${horaActual()}] Esperando 5 segundos...`);
            await page.waitForTimeout(5000);

            console.log(`🔍 [${horaActual()}] Buscando leads disponibles...`);

            try {
                // Buscar tabla de leads
                const leads = await page.$$('table tbody tr');
                console.log(`📊 [${horaActual()}] Encontradas ${leads.length} filas en la tabla`);
                
                if (leads.length === 0) {
                    console.log(`❌ [${horaActual()}] No se encontraron leads, reintentando...`);
                    continue;
                }

                console.log(`✅ [${horaActual()}] Encontrados ${leads.length} leads`);

                // Procesar primer lead
                const primerLead = leads[0];
                
                // Extraer nombre del lead
                const nombreTexto = await primerLead.$eval('a.slds-truncate[href^="/lightning/r/"]', 
                    el => el.textContent.trim()).catch(() => 'Lead sin nombre');

                leadsProcesados++;
                console.log(`👤 [${horaActual()}] Procesando lead ${leadsProcesados}: "${nombreTexto}"`);

                // Hacer clic en el lead para abrirlo
                const enlaceLead = await primerLead.$('a.slds-truncate[href^="/lightning/r/"]');
                if (!enlaceLead) {
                    console.log(`❌ [${horaActual()}] No se pudo encontrar enlace del lead`);
                    continue;
                }

                console.log(`🖱️ [${horaActual()}] Haciendo clic en el lead...`);
                await enlaceLead.click();
                await page.waitForTimeout(3000);

                // Verificar que estamos en la página del lead
                if (!page.url().includes('/lightning/r/Lead/')) {
                    console.log(`❌ [${horaActual()}] No se pudo abrir el lead. URL actual: ${page.url()}`);
                    continue;
                }

                console.log(`📄 [${horaActual()}] Lead abierto correctamente: ${page.url()}`);

                // Extraer solución (igual que tu automatización)
                const solucionDetalle = await obtenerSolucionDesdePaginaDetalle(page);
                
                if (!solucionDetalle) {
                    console.log(`⚠️ [${horaActual()}] No se pudo extraer solución, saltando...`);
                    await volverALista(page);
                    continue;
                }

                const solucionNormalizada = normalizarTexto(solucionDetalle);
                console.log(`🔍 [${horaActual()}] Solución: "${solucionDetalle}" -> normalizada: "${solucionNormalizada}"`);

                const esSolucionValida = SOLUCIONES_VALIDAS_NORMALIZADAS.includes(solucionNormalizada);
                console.log(`${esSolucionValida ? '✅' : '❌'} [${horaActual()}] Solución ${esSolucionValida ? 'válida' : 'inválida'}`);

                if (!esSolucionValida) {
                    console.log(`⏩ [${horaActual()}] Saltando lead con solución inválida`);
                    await volverALista(page);
                    continue;
                }

                // Buscar botón de cambiar propietario
                console.log(`🔄 [${horaActual()}] Buscando botón de cambiar propietario...`);
                
                const buttonChange = await page.$('button[name="ChangeOwnerOne"]').catch(() => null);
                
                if (!buttonChange) {
                    console.log(`❌ [${horaActual()}] No se encontró botón de cambiar propietario`);
                    await volverALista(page);
                    continue;
                }

                // Hacer clic en cambiar propietario
                console.log(`🎯 [${horaActual()}] Haciendo clic en cambiar propietario...`);
                await buttonChange.click();
                await page.waitForTimeout(2000);

                // Proceso de cambio de propietario (usando la misma lógica que tu automatización)
                try {
                    console.log(`🔍 [${horaActual()}] Buscando campo de propietario...`);
                    
                    // Buscar el campo de búsqueda del usuario
                    const searchInput = await page.$('input[placeholder*="Buscar usuarios"]').catch(() => null);
                    
                    if (searchInput) {
                        console.log(`⌨️ [${horaActual()}] Escribiendo email en campo de búsqueda...`);
                        await searchInput.fill(email);
                        await page.waitForTimeout(1000);
                        
                        // Buscar y hacer clic en la opción del usuario
                        const userOption = await page.$(`[title="${email}"]`).catch(() => null);
                        if (userOption) {
                            await userOption.click();
                            console.log(`✅ [${horaActual()}] Usuario seleccionado`);
                        }
                    }

                    console.log(`💾 [${horaActual()}] Buscando botón Guardar...`);
                    
                    // Buscar y hacer clic en el botón de guardar
                    const saveButton = await page.$('button[title="Guardar"]').catch(() => null) || 
                                      await page.$('button:has-text("Guardar")').catch(() => null);
                    
                    if (saveButton) {
                        await saveButton.click();
                        await page.waitForTimeout(3000);

                        prospectosCambiados++;
                        console.log(`✅ [${horaActual()}] Prospecto cambiado exitosamente! Total: ${prospectosCambiados}/${cantidad}`);

                        // Actualizar contador en config
                        config.contador = prospectosCambiados;
                        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                    } else {
                        console.log(`❌ [${horaActual()}] No se encontró botón de guardar`);
                    }

                } catch (cambioError) {
                    console.log(`❌ [${horaActual()}] Error en cambio de propietario: ${cambioError.message}`);
                }

                // Volver a la lista
                await volverALista(page);

                // Pausa entre leads
                await page.waitForTimeout(3000);

            } catch (error) {
                console.error(`⚠️ [${horaActual()}] Error procesando leads: ${error.message}`);
                await volverALista(page);
            }
        }

        console.log(`🎉 [${horaActual()}] ¡Automatización completada! Prospectos cambiados: ${prospectosCambiados}`);

    } catch (error) {
        console.error(`❌ [${horaActual()}] Error crítico: ${error.message}`);
        console.error('Stack trace:', error.stack);
        throw error;
    } finally {
        if (page) {
            console.log(`🔴 [${horaActual()}] Cerrando página...`);
            await page.close();
        }
        // NO cerrar el browser porque es el existente
        console.log(`✅ [${horaActual()}] Script finalizado (navegador principal sigue abierto)`);
    }

    return { leadsProcesados, prospectosCambiados };
}

// Función para extraer solución (igual que tu automatización)
async function obtenerSolucionDesdePaginaDetalle(page) {
    try {
        console.log(`🔍 [${horaActual()}] Extrayendo solución de la página...`);
        await page.waitForTimeout(2000);

        const solucionTexto = await page.evaluate(() => {
            const pSolucion = Array.from(document.querySelectorAll('p')).find(p =>
                p.getAttribute('title') === 'Solución'
            );

            if (!pSolucion) return '';

            const contenedorSolucion = pSolucion.closest('records-highlights-details-item');
            if (!contenedorSolucion) return '';

            const spanTruncate = contenedorSolucion.querySelector('span.slds-truncate');
            if (!spanTruncate) return '';

            const spanHijo = spanTruncate.querySelector('span');
            if (spanHijo && spanHijo.textContent && spanHijo.textContent.trim() !== '') {
                return spanHijo.textContent.trim();
            } else if (spanTruncate.textContent && spanTruncate.textContent.trim() !== '') {
                return spanTruncate.textContent.trim();
            }

            return '';
        });

        console.log(`🔎 [${horaActual()}] Solución encontrada: "${solucionTexto}"`);
        return solucionTexto;
    } catch (error) {
        console.log(`⚠️ [${horaActual()}] Error extrayendo solución: ${error.message}`);
        return '';
    }
}

// Función para volver a la lista
async function volverALista(page) {
    try {
        console.log(`🔄 [${horaActual()}] Volviendo a la lista de leads...`);
        await page.goto(PROSPECTOS_URL);
        await page.waitForTimeout(2000);
    } catch (error) {
        console.log(`⚠️ [${horaActual()}] Error volviendo a lista: ${error.message}`);
    }
}

// Función simple para ejecutar
export async function ejecutar() {
    try {
        console.log('🎯 Ejecutando automatización conectando a navegador existente...');
        const resultado = await automatizarConectandoExistente();
        console.log('📊 Resultado final:', resultado);
        return resultado;
    } catch (error) {
        console.error('❌ Error en automatización:', error);
        throw error;
    }
}

// Si se ejecuta directamente
console.log('🎯 Iniciando ejecución...');
ejecutar().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
});