// 🧠 AUTOMATIZACIÓN HÍBRIDA: Playwright + IA de Stagehand
// Se conecta al navegador existente Y usa IA para las acciones

import { chromium } from 'playwright';
import { Stagehand } from '@browserbasehq/stagehand';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('🧠 Iniciando automatización híbrida (Playwright + Stagehand IA)...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../config/config.json');

// Función para hora actual
const horaActual = () => new Date().toLocaleTimeString();

// Función para normalizar texto
function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Soluciones válidas
const SOLUCIONES_VALIDAS = [
    'Plan vive',
    'Salud familiar',
    'Salud evoluciona familiar',
    'Plan credito protegido'
];

const SOLUCIONES_VALIDAS_NORMALIZADAS = SOLUCIONES_VALIDAS.map(s => normalizarTexto(s));
console.log('✅ Soluciones válidas:', SOLUCIONES_VALIDAS_NORMALIZADAS);

// URL de leads
const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';

export async function automatizarHibrido() {
    console.log(`🧠 [${horaActual()}] Iniciando automatización híbrida...`);

    let browser;
    let page;
    let stagehand;
    let leadsProcesados = 0;
    let prospectosCambiados = 0;

    try {
        // Leer configuración
        console.log(`📋 [${horaActual()}] Leyendo configuración...`);
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const { email, cantidad, contador = 0 } = config;

        console.log(`📊 [${horaActual()}] Email: ${email}, Cantidad: ${cantidad}, Contador: ${contador}`);

        if (!email || !cantidad) {
            throw new Error('Configuración incompleta en config.json');
        }

        // PASO 1: Conectar a navegador existente con Playwright
        console.log(`🔗 [${horaActual()}] Conectando al navegador existente...`);
        browser = await chromium.connectOverCDP('http://localhost:9222');
        console.log(`✅ [${horaActual()}] Conectado al navegador existente`);

        const context = browser.contexts()[0];
        page = await context.newPage();
        console.log(`📄 [${horaActual()}] Nueva página creada`);

        // PASO 2: Inicializar Stagehand para IA (sin navegador propio)
        console.log(`🧠 [${horaActual()}] Inicializando Stagehand para IA...`);
        stagehand = new Stagehand({
            env: 'LOCAL',
            verbose: 1,
            enableCaching: false,
            // Usar la página de Playwright
            page: page
        });

        await stagehand.init();
        console.log(`✅ [${horaActual()}] Stagehand IA inicializado con página existente`);

        console.log(`🌐 [${horaActual()}] Navegando a lista de leads...`);
        await page.goto(PROSPECTOS_URL);
        console.log(`✅ [${horaActual()}] Navegación completada`);

        prospectosCambiados = contador;

        // BUCLE PRINCIPAL
        let intentos = 0;
        const maxIntentos = 50;

        while (prospectosCambiados < cantidad && intentos < maxIntentos) {
            intentos++;
            console.log(`\n🔄 [${horaActual()}] Intento ${intentos}: Recargando página...`);
            
            await page.reload();
            await page.waitForTimeout(5000);

            try {
                console.log(`🧠 [${horaActual()}] Verificando si hay leads...`);

                // Verificación simple con Playwright primero
                const leads = await page.$$('table tbody tr');
                console.log(`📊 [${horaActual()}] Leads detectados: ${leads.length}`);

                if (leads.length === 0) {
                    console.log(`❌ [${horaActual()}] No hay leads, reintentando...`);
                    continue;
                }

                console.log(`✅ [${horaActual()}] Encontrados ${leads.length} leads`);

                // Usar IA para hacer clic en el primer lead
                console.log(`🎯 [${horaActual()}] Usando IA para abrir el primer lead...`);
                await stagehand.act({
                    action: "click",
                    text: "Hacer clic en el primer nombre de lead en la tabla"
                });

                await page.waitForTimeout(3000);

                // Verificar que estamos en la página del lead
                const urlActual = page.url();
                if (!urlActual.includes('/lightning/r/Lead/')) {
                    console.log(`❌ [${horaActual()}] No se abrió el lead. URL: ${urlActual}`);
                    continue;
                }

                leadsProcesados++;
                console.log(`📄 [${horaActual()}] Lead ${leadsProcesados} abierto: ${urlActual}`);

                // Extraer solución con Playwright (más confiable)
                console.log(`🔍 [${horaActual()}] Extrayendo solución con Playwright...`);
                const solucion = await page.evaluate(() => {
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

                console.log(`� [${horaActual()}] Solución encontrada: "${solucion}"`);

                if (!solucion) {
                    console.log(`⚠️ [${horaActual()}] No se pudo extraer la solución, saltando...`);
                    await volverALista(page);
                    continue;
                }

                const solucionNormalizada = normalizarTexto(solucion);
                console.log(`🔍 [${horaActual()}] Solución normalizada: "${solucionNormalizada}"`);

                const esSolucionValida = SOLUCIONES_VALIDAS_NORMALIZADAS.includes(solucionNormalizada);
                console.log(`${esSolucionValida ? '✅' : '❌'} [${horaActual()}] Solución ${esSolucionValida ? 'VÁLIDA' : 'INVÁLIDA'}`);

                if (!esSolucionValida) {
                    console.log(`⏩ [${horaActual()}] Saltando lead con solución inválida`);
                    await volverALista(page);
                    continue;
                }

                // Usar IA para cambiar el propietario
                console.log(`🔄 [${horaActual()}] Usando IA para cambiar propietario...`);
                
                try {
                    // Buscar botón "Cambiar propietario" con IA
                    console.log(`🎯 [${horaActual()}] Buscando botón 'Cambiar propietario' con IA...`);
                    await stagehand.act({
                        action: "click",
                        text: "Cambiar propietario"
                    });

                    await page.waitForTimeout(2000);
                    console.log(`✅ [${horaActual()}] Modal abierto por IA`);

                    // Buscar usuario con IA
                    console.log(`🔍 [${horaActual()}] Usando IA para buscar usuario...`);
                    await stagehand.act({
                        action: "type",
                        text: email
                    });

                    await page.waitForTimeout(1000);

                    // Seleccionar el usuario con IA
                    console.log(`👆 [${horaActual()}] Seleccionando usuario con IA...`);
                    await stagehand.act({
                        action: "click",
                        text: email
                    });

                    // Guardar cambios con IA
                    console.log(`💾 [${horaActual()}] Guardando cambios con IA...`);
                    await stagehand.act({
                        action: "click",
                        text: "Guardar"
                    });

                    await page.waitForTimeout(3000);

                    prospectosCambiados++;
                    console.log(`🎉 [${horaActual()}] ¡ÉXITO CON IA! Prospecto cambiado. Total: ${prospectosCambiados}/${cantidad}`);

                    // Actualizar configuración
                    config.contador = prospectosCambiados;
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

                } catch (cambioError) {
                    console.log(`❌ [${horaActual()}] Error en cambio con IA: ${cambioError.message}`);
                }

                // Volver a la lista
                await volverALista(page);
                await page.waitForTimeout(3000);

            } catch (error) {
                console.error(`⚠️ [${horaActual()}] Error en procesamiento: ${error.message}`);
                await volverALista(page);
            }
        }

        console.log(`🎉 [${horaActual()}] ¡Automatización híbrida completada! Total: ${prospectosCambiados}`);

    } catch (error) {
        console.error(`❌ [${horaActual()}] Error crítico: ${error.message}`);
        throw error;
    } finally {
        if (stagehand) {
            console.log(`🔴 [${horaActual()}] Cerrando Stagehand...`);
            await stagehand.close();
        }
        if (page) {
            console.log(`📄 [${horaActual()}] Cerrando página...`);
            await page.close();
        }
        // NO cerrar browser porque es el existente
    }

    return { leadsProcesados, prospectosCambiados };
}

// Función para volver a la lista
async function volverALista(page) {
    try {
        console.log(`🔄 [${horaActual()}] Volviendo a la lista...`);
        await page.goto(PROSPECTOS_URL);
        await page.waitForTimeout(2000);
    } catch (error) {
        console.log(`⚠️ [${horaActual()}] Error volviendo a lista: ${error.message}`);
    }
}

// Función para ejecutar
export async function ejecutar() {
    try {
        console.log('🎯 Ejecutando automatización híbrida...');
        const resultado = await automatizarHibrido();
        console.log('📊 Resultado final:', resultado);
        return resultado;
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

// Ejecutar directamente
console.log('🎯 Iniciando automatización híbrida...');
ejecutar().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
});