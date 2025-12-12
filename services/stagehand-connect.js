// Stagehand conectándose a navegador existente (como Puppeteer)
console.log('🔗 CONECTANDO STAGEHAND A NAVEGADOR EXISTENTE');

import { Stagehand } from '@browserbasehq/stagehand';

async function conectarANavegadorExistente() {
    console.log('📋 Paso 1: Verificando navegador en puerto 9222...');
    
    try {
        // Verificar que Chrome está corriendo con debugging
        const response = await fetch('http://localhost:9222/json');
        const targets = await response.json();
        console.log(`✅ Encontrados ${targets.length} targets en el navegador`);
        
        // Mostrar las pestañas disponibles
        targets.forEach((target, index) => {
            if (target.type === 'page') {
                console.log(`📄 Pestaña ${index + 1}: ${target.title}`);
                console.log(`   URL: ${target.url}`);
            }
        });
        
        console.log('📋 Paso 2: Configurando Stagehand para conexión...');
        
        // Configurar Stagehand para conectarse al navegador existente
        const config = {
            env: 'LOCAL',
            verbose: 2,
            enableCaching: false,
            localBrowserLaunchOptions: {
                // Conectar al navegador existente en lugar de abrir uno nuevo
                executablePath: undefined, // No especificar executable
                args: [], // Sin argumentos adicionales
                // Usar cdpUrl para conectarse al navegador existente
                // Stagehand internamente usa Playwright que puede conectarse via CDP
            }
        };
        
        console.log('📋 Paso 3: Intentando conectar con Stagehand...');
        
        // Por ahora, Stagehand no tiene soporte directo para conectarse a navegador existente
        // Pero podemos intentar una aproximación alternativa
        
        const stagehand = new Stagehand(config);
        await stagehand.init();
        
        console.log('📋 Paso 4: Conexión establecida, probando navegación...');
        const page = stagehand.page;
        
        // Navegar a la página de prospectos
        const salesforceUrl = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';
        console.log(`🌐 Navegando a: ${salesforceUrl}`);
        
        await page.goto(salesforceUrl);
        console.log('✅ Navegación completada');
        
        // Esperar que cargue
        console.log('⏳ Esperando 8 segundos...');
        await page.waitForTimeout(8000);
        
        console.log('🎉 CONEXIÓN Y NAVEGACIÓN EXITOSA');
        console.log('🔓 Manteniendo navegador abierto...');
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.log('\n💡 SOLUCIONES:');
        console.log('1. Asegúrate de que Chrome esté abierto con: ');
        console.log('   chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\\temp\\chrome-debug"');
        console.log('2. Ve a http://localhost:9222 en otra pestaña para verificar');
        console.log('3. Haz login manual en Salesforce en esa ventana de Chrome');
    }
}

console.log('🚀 Iniciando conexión a navegador existente...');
conectarANavegadorExistente();