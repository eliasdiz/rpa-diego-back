// Conectar Stagehand usando Persistent Context (como sesión existente)
console.log('🔗 USANDO PERSISTENT CONTEXT PARA MANTENER SESIÓN');

import { Stagehand } from '@browserbasehq/stagehand';

async function usarPersistentContext() {
    console.log('📋 Configurando Persistent Context...');
    
    try {
        // Configurar Stagehand para usar persistent context
        // Esto es equivalente a mantener la sesión del navegador
        const config = {
            env: 'LOCAL',
            verbose: 2,
            enableCaching: false,
            localBrowserLaunchOptions: {
                headless: false,
                // Usar persistent context con el directorio de usuario
                // Esto mantiene cookies, sesiones, etc.
                userDataDir: 'C:\\temp\\chrome-debug',
                args: [
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-default-apps',
                    '--disable-extensions-except',
                    '--disable-plugins-discovery',
                ]
            }
        };
        
        console.log('⚙️ Inicializando con persistent context...');
        const stagehand = new Stagehand(config);
        await stagehand.init();
        
        const page = stagehand.page;
        console.log('✅ Stagehand inicializado con persistent context');
        
        // Primero verificar si ya estamos logueados
        console.log('🔍 Verificando si hay sesión activa...');
        await page.goto('https://sura.lightning.force.com');
        await page.waitForTimeout(3000);
        
        const currentUrl = page.url();
        console.log(`📄 URL actual: ${currentUrl}`);
        
        if (currentUrl.includes('login') || currentUrl.includes('auth')) {
            console.log('⚠️ No hay sesión activa, necesitas hacer login manual');
            console.log('💡 Haz login en esta ventana y luego presiona Enter...');
            
            // Esperar input del usuario
            const readline = await import('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            await new Promise(resolve => {
                rl.question('Presiona Enter después de hacer login... ', (answer) => {
                    rl.close();
                    resolve();
                });
            });
        }
        
        // Navegar a la página de leads
        console.log('🌐 Navegando a página de leads...');
        const leadsUrl = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';
        await page.goto(leadsUrl);
        
        console.log('⏳ Esperando que carguen los leads...');
        await page.waitForTimeout(8000);
        
        console.log('🔍 Buscando primer lead para hacer click...');
        try {
            // Usar selectores más específicos para Salesforce
            const selectores = [
                'tr[data-row-key-value] a[title]', // Enlace con título en fila
                '.slds-table tbody tr:first-child a', // Primer enlace en tabla
                'a[data-refid="recordId"]', // Enlace de registro
                'lightning-base-formatted-text a', // Texto formateado con enlace
            ];
            
            let clickExitoso = false;
            
            for (const selector of selectores) {
                try {
                    console.log(`🎯 Probando selector: ${selector}`);
                    await page.waitForSelector(selector, { timeout: 3000 });
                    
                    const elemento = await page.$(selector);
                    if (elemento) {
                        console.log('✅ Elemento encontrado, haciendo click...');
                        await elemento.click();
                        clickExitoso = true;
                        break;
                    }
                } catch (e) {
                    console.log(`⚠️ Selector ${selector} no funcionó`);
                }
            }
            
            if (clickExitoso) {
                await page.waitForTimeout(3000);
                console.log('🎉 ¡CLICK EXITOSO!');
                console.log(`📄 URL final: ${page.url()}`);
            } else {
                console.log('❌ No se pudo hacer click en ningún lead');
            }
            
        } catch (error) {
            console.log('⚠️ Error buscando leads:', error.message);
        }
        
        console.log('🔓 Navegador se mantiene abierto con sesión activa...');
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
    }
}

console.log('🚀 Iniciando con persistent context...');
usarPersistentContext();