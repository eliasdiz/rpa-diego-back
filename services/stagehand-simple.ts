// Prueba SÚPER SIMPLE de Stagehand
import { Stagehand, type ConstructorParams } from '@browserbasehq/stagehand';
import { format } from '@formkit/tempo';

// Función para hora actual
const horaActual = (): string => format(new Date(), { time: 'medium' });

// URL de prospectos 
const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';

// Configuración simple de Stagehand
const STAGEHAND_CONFIG: ConstructorParams = {
    env: 'LOCAL',           // Navegador local
    verbose: 2,             // Logging completo
    enableCaching: false,   // Sin caché
    // Usar modelo Gemini gratuito (requiere GEMINI_API_KEY en env)
    modelName: 'google/gemini-1.5-flash',
    localBrowserLaunchOptions: {
        headless: false,    // Ver navegador
    }
};

/**
 * Función SÚPER SIMPLE: Solo ir a prospectos y hacer click en primer lead
 */
async function pruebaSimple(): Promise<void> {
    console.log(`🚀 [${horaActual()}] === PRUEBA SÚPER SIMPLE STAGEHAND ===`);
    console.log(`🎯 [${horaActual()}] OBJETIVO: Ir a prospectos → Click primer lead`);
    
    let stagehand: Stagehand | undefined;
    const inicio = Date.now();
    
    try {
        // 1. Inicializar Stagehand
        console.log(`⚙️ [${horaActual()}] Inicializando Stagehand...`);
        stagehand = new Stagehand(STAGEHAND_CONFIG);
        await stagehand.init();
        console.log(`✅ [${horaActual()}] Stagehand listo`);
        
        const page = stagehand.page;
        
        // 2. Ir a página de prospectos (asume sesión ya iniciada)
        console.log(`🌐 [${horaActual()}] Navegando a prospectos...`);
        await page.goto(PROSPECTOS_URL);
        
        // 3. Esperar que cargue
        console.log(`⏳ [${horaActual()}] Esperando 8 segundos que carguen leads...`);
        await page.waitForTimeout(8000);
        
        // 4. Click en primer lead con lenguaje natural
        console.log(`🖱️ [${horaActual()}] Haciendo click en el nombre del primer lead...`);
        await page.act("click on the name of the first lead in the table");
        
        // 5. Confirmar
        await page.waitForTimeout(3000);
        const tiempo = Date.now() - inicio;
        
        console.log(`🎉 [${horaActual()}] ¡COMPLETADO! Tiempo total: ${tiempo}ms`);
        
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`❌ [${horaActual()}] ERROR: ${msg}`);
        console.error(error);
        
    } finally {
        // MANTENER navegador abierto para ver resultado
        console.log(`🔓 [${horaActual()}] Manteniendo navegador abierto...`);
        // No cerrar stagehand para mantener la sesión
    }
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    pruebaSimple()
        .then(() => {
            console.log(`\n✅ [${horaActual()}] Prueba completada`);
        })
        .catch((error: Error) => {
            console.error(`\n❌ [${horaActual()}] Error: ${error.message}`);
            process.exit(1);
        });
}

export { pruebaSimple };