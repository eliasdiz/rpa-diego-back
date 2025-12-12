// 🧪 PRUEBA SIMPLE DE STAGEHAND
// Script mínimo para probar que Stagehand funciona

import { Stagehand } from '@browserbasehq/stagehand';

console.log('🚀 Iniciando prueba simple de Stagehand...');

async function pruebaSimple() {
    console.log('🔧 Creando instancia de Stagehand...');
    
    const stagehand = new Stagehand({
        env: 'LOCAL',
        verbose: 1,
        enableCaching: false,
        localBrowserLaunchOptions: {
            headless: false,
            args: ['--no-first-run']
        }
    });

    try {
        console.log('⏳ Inicializando Stagehand...');
        await stagehand.init();
        console.log('✅ Stagehand inicializado correctamente!');

        console.log('🌐 Navegando a Google...');
        await stagehand.page.goto('https://www.google.com');
        console.log('✅ Navegación completada!');

        console.log('⏳ Esperando 3 segundos...');
        await stagehand.page.waitForTimeout(3000);

        console.log('🔍 Obteniendo título de la página...');
        const title = await stagehand.page.title();
        console.log(`📄 Título: ${title}`);

        console.log('🔴 Cerrando Stagehand...');
        await stagehand.close();
        console.log('✅ Prueba completada exitosamente!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

pruebaSimple();