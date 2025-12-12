import puppeteer from 'puppeteer-core';
import { format } from '@formkit/tempo';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Configuración básica
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../config/config.json');

// Constantes
const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';
const NUEVO_PROPIETARIO = 'Diego Ignacio Alvarez Franco';
const SOLUCIONES_VALIDAS = [
    'plan vive',
    'salud familiar',
    'salud evoluciona familiar',
    'plan credito protegido'
];

// Utilidades de log
const horaActual = () => format(new Date(), { time: 'medium' });
const log = (emoji: string, msg: string) => console.log(`${emoji} [${horaActual()}] ${msg}`);

function normalizarTexto(texto: string): string {
    if (!texto) return '';
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function main() {
    let browser;
    try {
        // 1. Conectar a Chrome existente
        log('🔌', 'Conectando a Chrome (puerto 9222)...');
        browser = await puppeteer.connect({
            browserURL: 'http://localhost:9222',
            defaultViewport: null
        });
        
        // Usar la primera página abierta o crear una nueva si no hay
        const pages = await browser.pages();
        const page = pages.length > 0 ? pages[0] : await browser.newPage();
        
        log('✅', 'Conectado correctamente');

        // 2. Leer configuración
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const cantidadObjetivo = process.argv[2] ? parseInt(process.argv[2]) : (config.cantidad || 5);
        
        log('📋', `Objetivo: Procesar ${cantidadObjetivo} leads válidos`);

        // 3. Navegar a la lista
        log('🌐', 'Navegando a lista de prospectos...');
        await page.goto(PROSPECTOS_URL, { waitUntil: 'networkidle0' });

        let leadsProcesados = 0;
        let leadsAsignados = 0;
        const leadsVistos = new Set<string>();

        while (leadsAsignados < cantidadObjetivo) {
            // 4. Buscar leads en la tabla
            log('🔍', 'Buscando leads en la tabla...');
            
            // Esperar a que la tabla cargue
            try {
                await page.waitForSelector('table tbody tr th a', { timeout: 10000 });
            } catch (e) {
                log('🔄', 'Tabla no detectada, recargando...');
                await page.reload({ waitUntil: 'networkidle0' });
                continue;
            }

            // Obtener enlaces de leads visibles
            const leadsEnTabla = await page.$$eval('table tbody tr th a', (anchors: any[]) => {
                return anchors.map(a => ({
                    nombre: a.innerText,
                    url: a.href
                }));
            });

            log('📊', `Encontrados ${leadsEnTabla.length} leads visibles`);

            let leadEncontrado = false;

            for (const lead of leadsEnTabla) {
                if (leadsVistos.has(lead.nombre)) continue;
                
                leadsVistos.add(lead.nombre);
                leadEncontrado = true;
                leadsProcesados++;

                log('👉', `Procesando lead: ${lead.nombre}`);
                
                // Navegar al lead
                await page.goto(lead.url, { waitUntil: 'domcontentloaded' });
                await page.waitForSelector('body', { timeout: 10000 }); // Esperar algo básico

                // 5. Extraer "Solución"
                // Intentamos buscar el campo por etiqueta o estructura común
                // Estrategia: Buscar todos los elementos que podrían ser campos y filtrar por label
                const solucion = await page.evaluate(() => {
                    // Buscar etiquetas que contengan "Solución"
                    const labels = Array.from(document.querySelectorAll('span.test-id__field-label, span.slds-form-element__label'));
                    const labelSolucion = labels.find(l => l.textContent?.includes('Solución') || l.textContent?.includes('Solution'));
                    
                    if (labelSolucion) {
                        // Intentar encontrar el valor asociado (generalmente en un div hermano o hijo cercano)
                        // Salesforce suele agrupar label y value en un div contenedor
                        const container = labelSolucion.closest('.slds-form-element') || labelSolucion.closest('.test-id__output-root');
                        if (container) {
                            const valueElement = container.querySelector('.slds-form-element__control, .test-id__field-value');
                            return valueElement?.textContent?.trim() || '';
                        }
                    }
                    return '';
                });

                log('📝', `Solución detectada: "${solucion}"`);
                
                const esValida = SOLUCIONES_VALIDAS.includes(normalizarTexto(solucion));

                if (!esValida) {
                    log('⏭️', 'Solución no válida, saltando...');
                    await page.goBack({ waitUntil: 'networkidle0' });
                    continue;
                }

                log('✅', 'Solución VÁLIDA. Iniciando cambio de propietario...');

                // 6. Cambiar Propietario
                try {
                    // Click en botón "Cambiar propietario" (Change Owner)
                    // Usamos selectores robustos basados en ARIA o texto
                    const btnCambiar = await page.waitForSelector(
                        'button[name="ChangeOwnerOne"], button[title="Cambiar propietario"], button[title="Change Owner"]', 
                        { timeout: 5000 }
                    ).catch(() => null);

                    if (!btnCambiar) {
                        // Intentar buscar en el menú de acciones si no está visible directamente
                        log('⚠️', 'Botón directo no encontrado, buscando en menú de acciones...');
                        // Aquí podríamos agregar lógica para abrir el dropdown de acciones si fuera necesario
                        // Por ahora asumimos que está visible o fallamos
                        throw new Error('Botón Cambiar Propietario no encontrado');
                    }

                    await btnCambiar.click();
                    
                    // Esperar al modal
                    log('⏳', 'Esperando modal...');
                    await page.waitForSelector('div.modal-container, div.slds-modal__container', { timeout: 5000 });

                    // Buscar input de usuario
                    const inputUsuario = await page.waitForSelector('input[placeholder*="Buscar"], input[placeholder*="Search"]', { timeout: 5000 });
                    if (!inputUsuario) throw new Error('Input de búsqueda no encontrado');

                    await inputUsuario.type(NUEVO_PROPIETARIO);
                    await new Promise(r => setTimeout(r, 2000)); // Esperar resultados

                    // Seleccionar el usuario de la lista (primera coincidencia)
                    const opcionUsuario = await page.waitForSelector('div[role="listbox"] li:first-child', { timeout: 5000 });
                    if (!opcionUsuario) throw new Error('Usuario no encontrado en resultados');
                    
                    await opcionUsuario.click();

                    // Click en Enviar/Guardar
                    // A veces es "Enviar", "Guardar", "Change Owner", etc.
                    const btnEnviar = await page.waitForSelector(
                        'button[title="Enviar"], button[title="Guardar"], button.slds-button_brand', 
                        { timeout: 5000 }
                    );
                    
                    if (btnEnviar) {
                        await btnEnviar.click();
                        log('📨', 'Enviado cambio de propietario');
                        
                        // Esperar confirmación o cierre del modal
                        await new Promise(r => setTimeout(r, 3000));
                        leadsAsignados++;
                        log('🎉', `¡Lead asignado correctamente! (${leadsAsignados}/${cantidadObjetivo})`);
                    } else {
                        throw new Error('Botón Enviar no encontrado');
                    }

                } catch (err) {
                    const mensaje = err instanceof Error ? err.message : String(err);
                    log('❌', `Error cambiando propietario: ${mensaje}`);
                }

                // Volver a la lista
                await page.goto(PROSPECTOS_URL, { waitUntil: 'networkidle0' });
                
                // Si ya cumplimos el objetivo, salir
                if (leadsAsignados >= cantidadObjetivo) break;
            }

            if (!leadEncontrado) {
                log('zzz', 'No hay leads nuevos, esperando 10s...');
                await new Promise(r => setTimeout(r, 10000));
                await page.reload({ waitUntil: 'networkidle0' });
            }
        }

        log('🏁', 'Automatización finalizada con éxito');
        browser.disconnect();

    } catch (error) {
        console.error('❌ Error fatal:', error);
        if (browser) browser.disconnect();
        process.exit(1);
    }
}

main();
