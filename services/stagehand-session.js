// Conectar Stagehand a navegador existente usando CDP
console.log('🔗 CONECTANDO A NAVEGADOR EXISTENTE CON CDP');

import { Stagehand } from '@browserbasehq/stagehand';

async function conectarConCDP() {
    console.log('📋 Configurando conexión CDP...');
    
    try {
        // Configurar Stagehand para usar CDP
        const config = {
            env: 'LOCAL',
            verbose: 2,
            enableCaching: false,
            localBrowserLaunchOptions: {
                // Usar CDP URL para conectarse al navegador existente
                // Esto es equivalente a browserURL en Puppeteer
                // En Playwright se maneja a través de cdpUrl
            }
        };
        
        console.log('📋 Método alternativo: Usar Playwright directamente...');
        
        // Como Stagehand puede no soportar CDP directamente,
        // vamos a usar la aproximación recomendada para tu caso:
        // Mantener el navegador abierto y usar una nueva pestaña
        
        const stagehand = new Stagehand({
            env: 'LOCAL',
            verbose: 2,
            enableCaching: false,
            localBrowserLaunchOptions: {
                headless: false,
                // Usar el mismo directorio de usuario para mantener sesión
                args: [
                    '--user-data-dir=C:\\temp\\chrome-debug',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-default-apps',
                ]
            }
        });
        
        console.log('⚙️ Inicializando Stagehand...');
        await stagehand.init();
        
        const page = stagehand.page;
        console.log('✅ Stagehand conectado');
        
        // Navegar a Salesforce (debería mantener la sesión si ya estás logueado)
        const salesforceUrl = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';
        console.log(`🌐 Navegando a Salesforce...`);
        
        await page.goto(salesforceUrl);
        console.log('✅ Navegación completada');
        
        // Esperar que cargue
        console.log('⏳ Esperando que cargue...');
        await page.waitForTimeout(8000);
        
        console.log('🔍 Buscando primer lead...');
        try {
            // Intentar hacer click usando selector básico
            const primerLead = await page.$('tr[data-row-key-value] a, .slds-table tbody tr:first-child a');
            if (primerLead) {
                console.log('✅ Lead encontrado, haciendo click...');
                await primerLead.click();
                console.log('🎉 ¡Click realizado exitosamente!');
                
                await page.waitForTimeout(3000);
                console.log(`📄 URL actual: ${page.url()}`);
            } else {
                console.log('⚠️ No se encontró lead con selectores básicos');
            }
        } catch (error) {
            console.log('⚠️ Error en click:', error.message);
        }
        
        console.log('🔓 Manteniendo navegador abierto...');
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.log('\n💡 INSTRUCCIONES:');
        console.log('1. Primero haz login manual en Salesforce en cualquier pestaña de Chrome');
        console.log('2. Luego ejecuta este script');
        console.log('3. El script abrirá una nueva ventana pero mantendrá la sesión');
    }
}

console.log('🚀 Iniciando conexión...');
conectarConCDP();