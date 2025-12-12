// Prueba HÍBRIDA: Stagehand + Playwright básico
import { Stagehand, type ConstructorParams } from '@browserbasehq/stagehand';
import { format } from '@formkit/tempo';

// Función para hora actual
const horaActual = (): string => format(new Date(), { time: 'medium' });

// URL de prospectos 
const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';

/**
 * Prueba HÍBRIDA - Sin LLM, solo usando Playwright a través de Stagehand
 */
async function pruebaHibrida(): Promise<void> {
    console.log(`🚀 [${horaActual()}] === PRUEBA HÍBRIDA (SIN LLM) ===`);
    console.log(`🎯 [${horaActual()}] Usando Stagehand + Playwright básico`);
    
    let stagehand: Stagehand | undefined;
    const inicio = Date.now();
    
    try {
        // 1. Inicializar Stagehand (sin LLM)
        console.log(`⚙️ [${horaActual()}] Inicializando Stagehand...`);
        stagehand = new Stagehand({
            env: 'LOCAL',
            verbose: 2,
            enableCaching: false,
            localBrowserLaunchOptions: {
                headless: false,
            }
        });
        
        await stagehand.init();
        console.log(`✅ [${horaActual()}] Stagehand inicializado`);
        
        const page = stagehand.page;
        
        // 2. Ir a página de prospectos
        console.log(`🌐 [${horaActual()}] Navegando a prospectos...`);
        await page.goto(PROSPECTOS_URL);
        
        // 3. Esperar que cargue
        console.log(`⏳ [${horaActual()}] Esperando que cargue la página...`);
        await page.waitForTimeout(8000);
        
        // 4. Usar selectores CSS básicos para encontrar el primer lead
        console.log(`🔍 [${horaActual()}] Buscando primer lead con CSS selector...`);
        
        // Intentar varios selectores comunes para leads
        const selectoresPosibles = [
            'a[data-refid="recordId"]',
            'tr[data-row-key-value] a',
            '.slds-table tbody tr:first-child a',
            '[data-aura-class="forceOutputLookup"] a',
            'lightning-base-formatted-text a'
        ];
        
        let clickRealizado = false;
        
        for (const selector of selectoresPosibles) {
            try {
                console.log(`🎯 [${horaActual()}] Probando selector: ${selector}`);
                
                // Esperar a que aparezca el elemento
                await page.waitForSelector(selector, { timeout: 3000 });
                
                // Hacer click
                await page.click(selector);
                
                console.log(`✅ [${horaActual()}] ¡Click exitoso con selector: ${selector}`);
                clickRealizado = true;
                break;
                
            } catch (error) {
                console.log(`⚠️ [${horaActual()}] Selector ${selector} no funcionó`);
            }
        }
        
        if (!clickRealizado) {
            // Fallback: click en el primer enlace visible
            console.log(`🔄 [${horaActual()}] Intentando click en primer enlace visible...`);
            await page.click('a:visible');
            clickRealizado = true;
        }
        
        if (clickRealizado) {
            // 5. Confirmar resultado
            await page.waitForTimeout(3000);
            const tiempo = Date.now() - inicio;
            
            console.log(`🎉 [${horaActual()}] ¡COMPLETADO! Tiempo: ${tiempo}ms`);
            console.log(`📊 [${horaActual()}] URL actual: ${page.url()}`);
        } else {
            console.log(`❌ [${horaActual()}] No se pudo hacer click en ningún lead`);
        }
        
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`❌ [${horaActual()}] ERROR: ${msg}`);
        
    } finally {
        // MANTENER navegador abierto
        console.log(`🔓 [${horaActual()}] Manteniendo navegador abierto...`);
        // No cerrar para ver el resultado
    }
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    pruebaHibrida()
        .then(() => {
            console.log(`\n✅ [${horaActual()}] Prueba híbrida completada`);
        })
        .catch((error: Error) => {
            console.error(`\n❌ [${horaActual()}] Error: ${error.message}`);
            process.exit(1);
        });
}

export { pruebaHibrida };