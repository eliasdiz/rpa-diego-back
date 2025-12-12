import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { format } from '@formkit/tempo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../config/config.json');

// Configuración
const CONFIG = {
    SALESFORCE_URL: 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead',
    BROWSER_URL: 'http://localhost:9222',
    TIMEOUT: 5000,
    POLLING_INTERVAL: 10000, // 10 segundos entre verificaciones
    MAX_RETRIES: 3
};

// Soluciones válidas (normalizadas para comparación)
const SOLUCIONES_VALIDAS = [
    'plan vive',
    'salud familiar',
    'salud evoluciona familiar',
    'plan credito protegido'
];

// Utilidades
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const horaActual = () => format(new Date(), { time: 'medium' });

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Función para extraer solución del lead en la página de detalle
async function obtenerSolucionLead(page) {
    try {
        await esperar(2000);

        const solucion = await page.evaluate(() => {
            // Buscar el campo "Solución" en la página de detalle
            const pSolucion = Array.from(document.querySelectorAll('p')).find(p =>
                p.getAttribute('title') === 'Solución'
            );

            if (!pSolucion) return '';

            const contenedor = pSolucion.closest('records-highlights-details-item');
            if (!contenedor) return '';

            const spanTruncate = contenedor.querySelector('span.slds-truncate');
            if (!spanTruncate) return '';

            const spanHijo = spanTruncate.querySelector('span');
            return spanHijo ? spanHijo.textContent.trim() : spanTruncate.textContent.trim();
        });

        console.log(`🔍 [${horaActual()}] Solución encontrada: "${solucion}"`);
        return solucion;
    } catch (error) {
        console.log(`⚠️ [${horaActual()}] Error al obtener solución: ${error.message}`);
        return '';
    }
}

// Función para validar si la solución es válida
function esSolucionValida(solucion) {
    const solucionNormalizada = normalizarTexto(solucion);
    const valida = SOLUCIONES_VALIDAS.some(s => normalizarTexto(s) === solucionNormalizada);
    console.log(`${valida ? '✅' : '❌'} [${horaActual()}] Solución "${solucion}" es ${valida ? 'válida' : 'inválida'}`);
    return valida;
}

// Función para detectar nuevos leads en la tabla
async function detectarNuevoLead(page, leadsVistos) {
    try {
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
                console.log(`🆕 [${horaActual()}] Nuevo lead detectado: "${lead.nombre}"`);
                return lead;
            }
        }

        return null;
    } catch (error) {
        console.log(`⚠️ [${horaActual()}] Error al detectar nuevos leads: ${error.message}`);
        return null;
    }
}

// Función para cambiar el propietario del lead (basada en tu script de Puppeteer)
async function cambiarPropietario(page, nombreLead) {
    try {
        console.log(`🔄 [${horaActual()}] Iniciando cambio de propietario para: "${nombreLead}"`);

        // Hacer clic en el botón "Cambiar propietario"
        await page.waitForSelector('button[name="ChangeOwnerOne"]', { timeout: CONFIG.TIMEOUT });
        await page.click('button[name="ChangeOwnerOne"]');
        console.log(`✅ [${horaActual()}] Clic en botón "Cambiar propietario"`);

        await esperar(1000);

        // Hacer clic en el campo de selección de nuevo propietario
        const selectorInput = await page.waitForSelector('input[title="Buscar Usuarios"]', { timeout: CONFIG.TIMEOUT });
        await selectorInput.click();
        console.log(`✅ [${horaActual()}] Clic en campo de búsqueda de usuarios`);

        await esperar(500);

        // Seleccionar el usuario (Diego Ignacio Alvarez Franco)
        const usuarioSelector = await page.waitForSelector('div[title="Diego Ignacio Alvarez Franco"]', { timeout: CONFIG.TIMEOUT });
        await usuarioSelector.click();
        console.log(`✅ [${horaActual()}] Usuario seleccionado: Diego Ignacio Alvarez Franco`);

        await esperar(500);

        // Hacer clic en el botón "Enviar"
        const botonEnviar = await page.waitForSelector('button[title="Enviar"]', { timeout: CONFIG.TIMEOUT });
        await botonEnviar.click();
        console.log(`✅ [${horaActual()}] Clic en botón "Enviar"`);

        await esperar(2000);

        // Verificar si hubo algún error
        const hayError = await page.evaluate(() => {
            const errorElement = document.querySelector('.modalError, .slds-text-color_error');
            return !!errorElement;
        });

        if (hayError) {
            const mensajeError = await page.evaluate(() => {
                const errorElement = document.querySelector('.modalError, .slds-text-color_error');
                return errorElement ? errorElement.textContent.trim() : 'Error desconocido';
            });
            throw new Error(`Error en el cambio de propietario: ${mensajeError}`);
        }

        console.log(`✅ [${horaActual()}] Propietario cambiado exitosamente`);
        return true;

    } catch (error) {
        console.log(`❌ [${horaActual()}] Error al cambiar propietario: ${error.message}`);
        return false;
    }
}

// Función principal de automatización
export async function automatizar(socket, setBrowser) {
    let browser;
    let procesadosExitosos = 0;
    const leadsVistos = new Set();

    try {
        console.log(`🚀 [${horaActual()}] Iniciando automatización...`);

        // Leer configuración
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const { cantidad } = config;

        if (!cantidad || cantidad <= 0) {
            throw new Error('Cantidad de prospectos no válida en config.json');
        }

        // Conectar al navegador
        console.log(`🔌 [${horaActual()}] Conectando al navegador...`);
        browser = await puppeteer.connect({
            browserURL: CONFIG.BROWSER_URL,
            defaultViewport: null
        });

        setBrowser(browser);
        const page = await browser.newPage();
        page.setDefaultTimeout(CONFIG.TIMEOUT);

        // Navegar a la página de leads
        console.log(`🌐 [${horaActual()}] Navegando a Salesforce...`);
        await page.goto(CONFIG.SALESFORCE_URL, { waitUntil: 'domcontentloaded' });
        await esperar(3000);

        console.log(`📊 [${horaActual()}] Meta: procesar ${cantidad} leads exitosamente`);

        // Bucle principal: polling continuo
        while (procesadosExitosos < cantidad) {
            try {
                // Asegurarse de estar en la lista de leads
                if (!page.url().includes('/Lead/list')) {
                    console.log(`🔄 [${horaActual()}] Volviendo a la lista de leads...`);
                    await page.goto(CONFIG.SALESFORCE_URL, { waitUntil: 'domcontentloaded' });
                    await esperar(3000);
                }

                // Detectar nuevo lead
                const nuevoLead = await detectarNuevoLead(page, leadsVistos);

                if (!nuevoLead) {
                    console.log(`⏳ [${horaActual()}] No hay nuevos leads. Esperando ${CONFIG.POLLING_INTERVAL / 1000}s...`);
                    await esperar(CONFIG.POLLING_INTERVAL);

                    // Recargar la página para detectar nuevos leads
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await esperar(2000);
                    continue;
                }

                // Marcar el lead como visto
                leadsVistos.add(nuevoLead.nombre);

                console.log(`🔍 [${horaActual()}] Procesando lead: "${nuevoLead.nombre}"`);
                socket.emit('lead-detectado', { nombre: nuevoLead.nombre });

                // Abrir el lead
                const baseUrl = new URL(page.url()).origin;
                const leadUrl = nuevoLead.url.startsWith('http') ? nuevoLead.url : `${baseUrl}${nuevoLead.url}`;

                await page.goto(leadUrl, { waitUntil: 'domcontentloaded' });
                await esperar(3000);

                // Obtener y validar la solución
                const solucion = await obtenerSolucionLead(page);

                if (!solucion) {
                    console.log(`⚠️ [${horaActual()}] No se pudo obtener la solución. Saltando lead.`);
                    socket.emit('lead-saltado', { nombre: nuevoLead.nombre, razon: 'Sin solución' });
                    continue;
                }

                if (!esSolucionValida(solucion)) {
                    console.log(`⏩ [${horaActual()}] Solución inválida: "${solucion}". Saltando lead.`);
                    socket.emit('lead-saltado', { nombre: nuevoLead.nombre, razon: `Solución inválida: ${solucion}` });
                    continue;
                }

                // La solución es válida, proceder con el cambio de propietario
                console.log(`✅ [${horaActual()}] Solución válida: "${solucion}". Cambiando propietario...`);

                const exitoso = await cambiarPropietario(page, nuevoLead.nombre);

                if (exitoso) {
                    procesadosExitosos++;
                    console.log(`🎉 [${horaActual()}] Lead procesado exitosamente! (${procesadosExitosos}/${cantidad})`);
                    socket.emit('prospecto-cambiado', {
                        nombre: nuevoLead.nombre,
                        solucion: solucion,
                        total: procesadosExitosos
                    });
                } else {
                    console.log(`❌ [${horaActual()}] Fallo al cambiar propietario`);
                    socket.emit('lead-error', { nombre: nuevoLead.nombre, razon: 'Error al cambiar propietario' });
                }

                // Esperar antes de procesar el siguiente lead
                await esperar(2000);

            } catch (error) {
                console.error(`❌ [${horaActual()}] Error en bucle principal: ${error.message}`);
                socket.emit('error-automatizacion', { message: error.message });
                await esperar(5000);
            }
        }

        console.log(`\n🎊 [${horaActual()}] ¡Automatización completada! Total procesados: ${procesadosExitosos}`);
        socket.emit('automatizacion-completada', { total: procesadosExitosos });

    } catch (error) {
        console.error(`\n❌ [${horaActual()}] Error crítico: ${error.message}`);
        socket.emit('error-automatizacion', { message: error.message, critico: true });
    } finally {
        if (browser) {
            try {
                const pages = await browser.pages();
                for (const page of pages) {
                    await page.close();
                }
            } catch (e) {
                console.error(`⚠️ [${horaActual()}] Error al cerrar páginas: ${e.message}`);
            }
        }
    }
}