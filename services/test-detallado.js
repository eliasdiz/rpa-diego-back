// Prueba de Stagehand paso a paso con logging detallado
console.log('🔥 INICIANDO PRUEBA DETALLADA DE STAGEHAND');

import { Stagehand } from '@browserbasehq/stagehand';

async function pruebaDetallada() {
    console.log('📋 Paso 1: Importación completada');
    
    try {
        console.log('📋 Paso 2: Creando configuración...');
        const config = {
            env: 'LOCAL',
            verbose: 2,
            enableCaching: false,
            localBrowserLaunchOptions: {
                headless: false,
            }
        };
        console.log('✅ Configuración creada:', JSON.stringify(config, null, 2));
        
        console.log('📋 Paso 3: Creando instancia de Stagehand...');
        const stagehand = new Stagehand(config);
        console.log('✅ Instancia creada');
        
        console.log('📋 Paso 4: Inicializando Stagehand...');
        const result = await stagehand.init();
        console.log('✅ Stagehand inicializado:', result);
        
        console.log('📋 Paso 5: Obteniendo página...');
        const page = stagehand.page;
        console.log('✅ Página obtenida');
        
        console.log('📋 Paso 6: Navegando a Salesforce...');
        const salesforceUrl = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';
        await page.goto(salesforceUrl);
        console.log('✅ Navegación a Salesforce completada');
        
        console.log('📋 Paso 7: Esperando 8 segundos que cargue...');
        await page.waitForTimeout(8000);
        console.log('✅ Espera completada');
        
        console.log('📋 Paso 8: Buscando primer enlace en la página...');
        try {
            // Buscar primer enlace que pueda ser un lead
            const primerEnlace = await page.$('a[href*="Lead/"]');
            if (primerEnlace) {
                console.log('✅ Encontró enlace de lead');
                console.log('📋 Paso 9: Haciendo click...');
                await primerEnlace.click();
                console.log('✅ Click realizado');
                
                await page.waitForTimeout(3000);
                console.log('📋 URL actual:', page.url());
            } else {
                console.log('⚠️ No se encontró enlace de lead específico');
                // Buscar cualquier enlace
                const cualquierEnlace = await page.$('a');
                if (cualquierEnlace) {
                    await cualquierEnlace.click();
                    console.log('✅ Click en primer enlace disponible');
                }
            }
        } catch (error) {
            console.log('⚠️ Error buscando enlaces:', error.message);
        }
        
        console.log('🎉 PRUEBA DETALLADA COMPLETADA EXITOSAMENTE');
        
        // Mantener navegador abierto
        console.log('🔓 Manteniendo navegador abierto...');
        
    } catch (error) {
        console.error('❌ ERROR EN PRUEBA DETALLADA:', error);
        console.error('Stack:', error.stack);
    }
}

console.log('🚀 Ejecutando prueba detallada...');
pruebaDetallada();