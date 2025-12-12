// Stagehand conectándose a navegador existente - VERSIÓN FINAL
import { chromium } from 'playwright';
import { format } from '@formkit/tempo';

const horaActual = () => format(new Date(), { time: 'medium' });
const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';

/**
 * Conecta a navegador Chrome existente usando CDP
 */
async function conectarANavegadorExistente() {
    console.log(`🚀 [${horaActual()}] Conectando a navegador existente...`);
    
    let browser;
    let context;
    let page;
    
    try {
        // 1. Conectar al navegador existente usando CDP
        console.log(`🔗 [${horaActual()}] Conectando a Chrome en puerto 9222...`);
        browser = await chromium.connectOverCDP('http://localhost:9222');
        console.log(`✅ [${horaActual()}] Conectado al navegador existente`);
        
        // 2. Obtener el contexto por defecto (donde están las pestañas actuales)
        const contexts = browser.contexts();
        context = contexts[0]; // Usar el primer contexto disponible
        console.log(`📑 [${horaActual()}] Usando contexto existente con ${context.pages().length} pestañas`);
        
        // 3. Crear nueva pestaña en el navegador existente
        console.log(`📄 [${horaActual()}] Creando nueva pestaña...`);
        page = await context.newPage();
        console.log(`✅ [${horaActual()}] Nueva pestaña creada`);
        
        // 4. Navegar a la página de prospectos
        console.log(`🌐 [${horaActual()}] Navegando a: ${PROSPECTOS_URL}`);
        await page.goto(PROSPECTOS_URL);
        console.log(`✅ [${horaActual()}] Navegación completada`);
        
        // 5. Esperar que cargue
        console.log(`⏳ [${horaActual()}] Esperando 8 segundos que cargue...`);
        await page.waitForTimeout(8000);
        
        // 6. Información de la página
        console.log(`📊 [${horaActual()}] URL actual: ${page.url()}`);
        console.log(`📊 [${horaActual()}] Título: ${await page.title()}`);
        
        // 7. Buscar y hacer click en primer lead
        console.log(`🔍 [${horaActual()}] Buscando primer lead...`);
        
        try {
            // Estrategia 1: Buscar enlaces que contengan "Lead/" en href
            let leadEncontrado = false;
            
            const enlacesLead = await page.$$('a[href*="Lead/"]');
            if (enlacesLead.length > 0) {
                console.log(`✅ [${horaActual()}] Encontrados ${enlacesLead.length} enlaces de Lead`);
                const primerLead = enlacesLead[0];
                const textoLead = await primerLead.textContent();
                console.log(`🎯 [${horaActual()}] Haciendo click en: "${textoLead?.trim()}"`);
                
                await primerLead.click();
                leadEncontrado = true;
                console.log(`🎉 [${horaActual()}] ¡Click realizado exitosamente!`);
            }
            
            // Estrategia 2: Si no hay enlaces Lead/, buscar en tabla
            if (!leadEncontrado) {
                console.log(`🔄 [${horaActual()}] Buscando en tabla...`);
                const primerEnlaceTabla = await page.$('table a, tr a, tbody a');
                if (primerEnlaceTabla) {
                    await primerEnlaceTabla.click();
                    leadEncontrado = true;
                    console.log(`✅ [${horaActual()}] Click en primer enlace de tabla`);
                }
            }
            
            if (leadEncontrado) {
                await page.waitForTimeout(3000);
                console.log(`📄 [${horaActual()}] URL después del click: ${page.url()}`);
            } else {
                console.log(`⚠️ [${horaActual()}] No se encontraron leads para hacer click`);
            }
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(`⚠️ [${horaActual()}] Error en click: ${errorMsg}`);
        }
        
        // 8. Mantener conexión abierta
        console.log(`🔓 [${horaActual()}] Navegador se mantiene abierto`);
        console.log(`💡 [${horaActual()}] La pestaña nueva permanece activa para inspección`);
        
        // No cerrar browser ni context para mantener la conexión
        
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ [${horaActual()}] ERROR: ${errorMsg}`);
        console.log(`\n💡 [${horaActual()}] INSTRUCCIONES:`);
        console.log(`1. Asegúrate de que Chrome esté abierto con:`);
        console.log(`   chrome.exe --remote-debugging-port=9222`);
        console.log(`2. Haz login en Salesforce en cualquier pestaña de ese Chrome`);
        console.log(`3. Ejecuta este script nuevamente`);
    }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    conectarANavegadorExistente()
        .then(() => {
            console.log(`\n✅ [${horaActual()}] Proceso completado`);
        })
        .catch((error) => {
            console.error(`\n❌ [${horaActual()}] Error final: ${error.message}`);
        });
}

export { conectarANavegadorExistente };