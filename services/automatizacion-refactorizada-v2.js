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
    POLLING_INTERVAL: 10000,
    VIEWPORT: { width: 1522, height: 911 }
};

// Soluciones válidas
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
    const solucionesNormalizadas = SOLUCIONES_VALIDAS.map(s => normalizarTexto(s));
    const valida = solucionesNormalizadas.includes(solucionNormalizada);
    console.log(`${valida ? '✅' : '❌'} [${horaActual()}] Solución "${solucion}" es ${valida ? 'válida' : 'inválida'}`);
    return valida;
}

// Función para detectar nuevos leads en la tabla
async function obtenerLeadsDisponibles(page) {
    try {
        const leads = await page.evaluate(() => {
            const filas = document.querySelectorAll('table tbody tr');
            return Array.from(filas).map((fila, index) => {
                const enlace = fila.querySelector('a.slds-truncate[href^="/lightning/r/"]');
                return enlace ? {
                    nombre: enlace.textContent.trim(),
                    index: index + 1
                } : null;
            }).filter(Boolean);
        });

        return leads;
    } catch (error) {
        console.log(`⚠️ [${horaActual()}] Error al obtener leads: ${error.message}`);
        return [];
    }
}

// Función para hacer clic en un lead usando el patrón del script proporcionado
async function abrirLead(page, nombreLead, index) {
    const timeout = CONFIG.TIMEOUT;

    try {
        console.log(`🖱️ [${horaActual()}] Haciendo clic en lead: "${nombreLead}" (posición ${index})`);

        // Usar puppeteer.Locator.race como en el script proporcionado
        await puppeteer.Locator.race([
            page.locator(`::-p-aria(${nombreLead}[role="link"])`),
            page.locator(`tr:nth-of-type(${index}) > th > span span`),
            page.locator('tbody th a'),
            page.locator(':scope >>> tbody th a')
        ])
            .setTimeout(timeout)
            .click();

        console.log(`✅ [${horaActual()}] Clic realizado en lead "${nombreLead}"`);
        await esperar(3000);
        return true;
    } catch (error) {
        console.log(`⚠️ [${horaActual()}] Error al hacer clic en lead: ${error.message}`);
        return false;
    }
}

// Función para cambiar propietario usando el patrón del script proporcionado
async function cambiarPropietario(page, nombreLead) {
    const timeout = CONFIG.TIMEOUT;

    try {
        console.log(`🔄 [${horaActual()}] Iniciando cambio de propietario para: "${nombreLead}"`);

        // Paso 1: Click en botón "Cambiar propietario" - usando Locator.race
        await puppeteer.Locator.race([
            page.locator('div.none li:nth-of-type(1) button'),
            page.locator('div.windowViewMode-normal li:nth-of-type(1) button'),
            page.locator(':scope >>> div.none li:nth-of-type(1) button')
        ])
            .setTimeout(timeout)
            .click();

        console.log(`✅ [${horaActual()}] Clic en botón "Cambiar propietario"`);
        await esperar(1000);

        // Paso 2: Click en campo de búsqueda de nuevo propietario
        await puppeteer.Locator.race([
            page.locator('::-p-aria(Seleccionar nuevo propietario *)'),
            page.locator('input[title="Buscar Usuarios"]')
        ])
            .setTimeout(timeout)
            .click();

        console.log(`✅ [${horaActual()}] Clic en campo de búsqueda`);
        await esperar(500);

        // Paso 3: Seleccionar usuario "Diego Ignacio Alvarez Franco"
        await puppeteer.Locator.race([
            page.locator('div.primaryLabel'),
            page.locator('div[title="Diego Ignacio Alvarez Franco"]'),
            page.locator(':scope >>> div.primaryLabel')
        ])
            .setTimeout(timeout)
            .click();

        console.log(`✅ [${horaActual()}] Usuario seleccionado: Diego Ignacio Alvarez Franco`);
        await esperar(500);

        // Paso 4: Click en botón "Enviar"
        await puppeteer.Locator.race([
            page.locator('::-p-aria(Enviar)'),
            page.locator('button.uiButton--default'),
            page.locator('button[title="Enviar"]'),
            page.locator(':scope >>> button.uiButton--default')
        ])
            .setTimeout(timeout)
            .click();

        console.log(`✅ [${horaActual()}] Clic en botón "Enviar"`);
        await esperar(2000);

        // Verificar si hubo error
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

// Función para volver a la lista de prospectos usando el patrón del script
async function volverAListaProspectos(page) {
    const timeout = CONFIG.TIMEOUT;

    try {
        console.log(`🔙 [${horaActual()}] Volviendo a la lista de prospectos...`);

        // Hacer clic en "Prospectos" en la navegación
        await puppeteer.Locator.race([
            page.locator('::-p-aria(Prospectos) >>>> ::-p-aria([role="generic"])'),
            page.locator('one-app-nav-bar-item-root.slds-is-active > a > span'),
            page.locator('a[title="Prospectos"]'),
            page.locator(':scope >>> one-app-nav-bar-item-root.slds-is-active > a > span')
        ])
            .setTimeout(timeout)
            .click();

        await esperar(2000);

        // Click en el filtro de vista si es necesario
        const enListaCorrecta = await page.evaluate(() => {
            return window.location.href.includes('filterName=Antioquia_PYF_Lead');
        });

        if (!enListaCorrecta) {
            console.log(`🔄 [${horaActual()}] Seleccionando filtro "Antioquia - PYF"...`);

            await puppeteer.Locator.race([
                page.locator('span.slds-page-header__title'),
                page.locator(':scope >>> span.slds-page-header__title')
            ])
                .setTimeout(timeout)
                .click();

            await esperar(500);

            await puppeteer.Locator.race([
                page.locator('::-p-aria(Antioquia - PYF)'),
                page.locator('ul:nth-of-type(1) > li:nth-of-type(3) span.slds-media__body > span')
            ])
                .setTimeout(timeout)
                .click();
        }

        await esperar(2000);
        console.log(`✅ [${horaActual()}] De vuelta en la lista de prospectos`);
        return true;

    } catch (error) {
        console.log(`⚠️ [${horaActual()}] Error al volver a lista: ${error.message}`);
        // Fallback: navegación directa
        await page.goto(CONFIG.SALESFORCE_URL, { waitUntil: 'domcontentloaded' });
        await esperar(3000);
        return true;
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

        // Configurar viewport como en el script proporcionado
        await page.setViewport(CONFIG.VIEWPORT);

        // Navegar a la página de leads
        console.log(`🌐 [${horaActual()}] Navegando a Salesforce...`);
        await page.goto(CONFIG.SALESFORCE_URL, { waitUntil: 'domcontentloaded' });
        await esperar(3000);

        console.log(`📊 [${horaActual()}] Meta: procesar ${cantidad} leads exitosamente`);

        // Bucle principal: polling continuo
        while (procesadosExitosos < cantidad) {
            try {
                // Obtener leads disponibles
                const leadsDisponibles = await obtenerLeadsDisponibles(page);

                if (leadsDisponibles.length === 0) {
                    console.log(`⏳ [${horaActual()}] No hay leads disponibles. Esperando ${CONFIG.POLLING_INTERVAL / 1000}s...`);
                    await esperar(CONFIG.POLLING_INTERVAL);
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await esperar(2000);
                    continue;
                }

                // Buscar el primer lead que no hayamos visto
                let nuevoLead = null;
                for (const lead of leadsDisponibles) {
                    if (!leadsVistos.has(lead.nombre)) {
                        nuevoLead = lead;
                        break;
                    }
                }

                if (!nuevoLead) {
                    console.log(`⏳ [${horaActual()}] No hay nuevos leads. Esperando ${CONFIG.POLLING_INTERVAL / 1000}s...`);
                    await esperar(CONFIG.POLLING_INTERVAL);
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await esperar(2000);
                    continue;
                }

                // Marcar el lead como visto
                leadsVistos.add(nuevoLead.nombre);

                console.log(`🆕 [${horaActual()}] Nuevo lead detectado: "${nuevoLead.nombre}"`);
                socket.emit('lead-detectado', { nombre: nuevoLead.nombre });

                // Abrir el lead usando el patrón del script
                const abierto = await abrirLead(page, nuevoLead.nombre, nuevoLead.index);

                if (!abierto) {
                    console.log(`⚠️ [${horaActual()}] No se pudo abrir el lead. Continuando...`);
                    await volverAListaProspectos(page);
                    continue;
                }

                // Obtener y validar la solución
                const solucion = await obtenerSolucionLead(page);

                if (!solucion) {
                    console.log(`⚠️ [${horaActual()}] No se pudo obtener la solución. Saltando lead.`);
                    socket.emit('lead-saltado', { nombre: nuevoLead.nombre, razon: 'Sin solución' });
                    await volverAListaProspectos(page);
                    continue;
                }

                if (!esSolucionValida(solucion)) {
                    console.log(`⏩ [${horaActual()}] Solución inválida: "${solucion}". Saltando lead.`);
                    socket.emit('lead-saltado', { nombre: nuevoLead.nombre, razon: `Solución inválida: ${solucion}` });
                    await volverAListaProspectos(page);
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

                // Volver a la lista de prospectos usando el patrón del script
                await volverAListaProspectos(page);

                await esperar(2000);

            } catch (error) {
                console.error(`❌ [${horaActual()}] Error en bucle principal: ${error.message}`);
                socket.emit('error-automatizacion', { message: error.message });

                // Intentar volver a la lista
                try {
                    await page.goto(CONFIG.SALESFORCE_URL, { waitUntil: 'domcontentloaded' });
                    await esperar(3000);
                } catch (navError) {
                    console.error(`❌ [${horaActual()}] Error al navegar: ${navError.message}`);
                }

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