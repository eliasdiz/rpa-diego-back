// Servicio de prueba con Stagehand para comparar con Puppeteer
import { Stagehand, type ConstructorParams, type ObserveResult } from '@browserbasehq/stagehand';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { format } from '@formkit/tempo';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../config/config.json');

// Tipos específicos para el proyecto
interface ConfiguracionLogin {
    email: string;
    passwordHash: string;
    cantidad: number;
    contador: number;
    hora: string;
    modo: string;
}

interface ResultadoPrueba {
    indice: number;
    selector?: string;
    descripcion?: string;
    informacionExtraida?: any;
    error?: string;
    timestamp: string;
}

interface ResumenPrueba {
    exitoso: boolean;
    tiempoTotal: number;
    resultados?: ResultadoPrueba[];
    error?: string;
}

interface ResultadosCompletos {
    timestamp: string;
    tiempoTotal: number;
    configuracion: ConstructorParams;
    resultados: ResultadoPrueba[];
    resumen: {
        totalLeads: number;
        leadsProcessed: number;
        exitosos: number;
        errores: number;
    };
}

// Función para hora actual (formato HH:MM:SS)
const horaActual = (): string => format(new Date(), { time: 'medium' });

// URL de la lista de prospectos (misma que el código original)
const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';

// Constantes para soluciones válidas (mismas que el código original)
const SOLUCIONES_VALIDAS: string[] = [
    'Plan vive',
    'Salud familiar',
    'Salud evoluciona familiar',
    'Plan credito protegido'
];

// Configuración básica de Stagehand 
const STAGEHAND_CONFIG: ConstructorParams = {
    env: 'LOCAL',           // Usar navegador local
    verbose: 2,             // Logging detallado (0=errors, 1=info, 2=debug)
    enableCaching: false,   // Sin caché para pruebas
    // Configurar para usar navegador existente si es posible
    localBrowserLaunchOptions: {
        headless: false,    // No usar headless para ver qué pasa
    }
};

// Configuración para tiempos y pruebas
const CONFIG_TEST = {
    maxLeadsParaPrueba: 3,      // Solo procesar los primeros 3 leads para prueba
    tiempoEsperaLogin: 5000,    // Tiempo de espera después del login
    tiempoEsperaTabla: 10000,   // Tiempo para que cargue la tabla
};

// Schema de Zod para validar la información extraída de leads
const LeadInfoSchema = z.object({
    nombre: z.string().optional(),
    solucion: z.string().optional(),
    telefono: z.string().optional(),
    email: z.string().optional(),
    estado: z.string().optional(),
}).passthrough(); // Permite campos adicionales

/**
 * Función principal de prueba con Stagehand - SIMPLIFICADA
 * Solo va a la página de prospectos y hace click en el primer lead
 */
async function probarStagehand(): Promise<ResumenPrueba> {
    console.log(`🚀 [${horaActual()}] Iniciando prueba SIMPLE con Stagehand...`);
    console.log(`🎯 [${horaActual()}] Objetivo: Ir a prospectos y hacer click en el primer lead`);
    
    let stagehand: Stagehand | undefined;
    const tiempoInicio = Date.now();
    
    try {
        // 1. Inicializar Stagehand (se conectará a pestaña existente)
        console.log(`⚙️ [${horaActual()}] Inicializando Stagehand...`);
        stagehand = new Stagehand(STAGEHAND_CONFIG);
        await stagehand.init();
        
        const page = stagehand.page;
        console.log(`✅ [${horaActual()}] Stagehand inicializado - usando pestaña existente`);
        
        // 2. Ir directamente a la página de prospectos
        console.log(`🌐 [${horaActual()}] Navegando a página de prospectos...`);
        await page.goto(PROSPECTOS_URL);
        
        console.log(`⏳ [${horaActual()}] Esperando que aparezcan los leads...`);
        await page.waitForTimeout(5000); // Dar tiempo para que cargue
        
        // 3. Buscar y hacer click en el primer lead
        console.log(`� [${horaActual()}] Buscando el primer lead para hacer click...`);
        
        // Usar Stagehand para encontrar y hacer click en el primer lead
        await page.act("click on the name of the first lead in the table");
        
        console.log(`✅ [${horaActual()}] Click realizado en el primer lead`);
        
        // 4. Esperar un poco para ver el resultado
        await page.waitForTimeout(3000);
        console.log(`� [${horaActual()}] Prueba simple completada`);
        
        const tiempoTotal = Date.now() - tiempoInicio;
        
        // Guardar resultado simple
        const resultado: ResultadoPrueba = {
            indice: 1,
            descripcion: "Click en primer lead realizado exitosamente",
            timestamp: horaActual()
        };
        
        // Guardar resultados básicos
        const archivoResultados = path.join(__dirname, `../diagnostics/stagehand-simple-${Date.now()}.json`);
        const resultadosCompletos = {
            timestamp: horaActual(),
            tiempoTotal: tiempoTotal,
            accion: "Click en primer lead",
            resultado: "Exitoso",
            url: PROSPECTOS_URL
        };
        
        fs.writeFileSync(archivoResultados, JSON.stringify(resultadosCompletos, null, 2));
        console.log(`💾 [${horaActual()}] Resultados guardados en: ${archivoResultados}`);
        
        return {
            exitoso: true,
            tiempoTotal,
            resultados: [resultado]
        };
        
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`💥 [${horaActual()}] Error en prueba simple: ${errorMsg}`);
        if (error instanceof Error) {
            console.error(error.stack);
        }
        
        return {
            exitoso: false,
            error: errorMsg,
            tiempoTotal: Date.now() - tiempoInicio
        };
        
    } finally {
        // NO cerrar Stagehand para mantener la pestaña abierta
        console.log(`🔒 [${horaActual()}] Manteniendo pestaña abierta...`);
        // if (stagehand) {
        //     await stagehand.close();
        // }
    }
}

/**
 * Función para comparar tiempos y eficiencia
 */
async function compararConPuppeteer(): Promise<ResumenPrueba> {
    console.log(`\n🔄 [${horaActual()}] === COMPARACIÓN STAGEHAND vs PUPPETEER ===`);
    
    // Ejecutar prueba con Stagehand
    console.log(`\n1️⃣ Ejecutando prueba con Stagehand...`);
    const resultadoStagehand = await probarStagehand();
    
    console.log(`\n📊 [${horaActual()}] RESULTADOS COMPARATIVOS:`);
    console.log(`🤖 Stagehand: ${resultadoStagehand.exitoso ? 'ÉXITO' : 'FALLO'} - ${resultadoStagehand.tiempoTotal}ms`);
    
    if (resultadoStagehand.exitoso && resultadoStagehand.resultados) {
        console.log(`   └─ Leads procesados: ${resultadoStagehand.resultados.length}`);
        console.log(`   └─ Éxito: ${resultadoStagehand.resultados.filter(r => !r.error).length}`);
        console.log(`   └─ Errores: ${resultadoStagehand.resultados.filter(r => r.error).length}`);
    }
    
    console.log(`\n💡 [${horaActual()}] Para comparar con Puppeteer, ejecute su código original en paralelo.`);
    
    return resultadoStagehand;
}

// Exportar funciones para uso en otros módulos
export {
    probarStagehand,
    compararConPuppeteer,
    STAGEHAND_CONFIG,
    CONFIG_TEST,
    type ConfiguracionLogin,
    type ResultadoPrueba,
    type ResumenPrueba
};

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    compararConPuppeteer()
        .then(() => {
            console.log(`\n✅ [${horaActual()}] Prueba completada. Revise los logs para análisis.`);
        })
        .catch((error: Error) => {
            console.error(`\n❌ [${horaActual()}] Error en ejecución: ${error.message}`);
            process.exit(1);
        });
}