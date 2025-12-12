// Versión final: Stagehand con persistent context + debugging
console.log('🎯 VERSIÓN FINAL: PERSISTENT CONTEXT + DEBUGGING');

import { Stagehand } from '@browserbasehq/stagehand';

async function versionFinal() {
    try {
        console.log('⚙️ Inicializando Stagehand con persistent context...');
        const stagehand = new Stagehand({
            env: 'LOCAL',
            verbose: 2,
            enableCaching: false,
            localBrowserLaunchOptions: {
                headless: false,
                userDataDir: 'C:\\temp\\chrome-debug',
                args: ['--no-first-run', '--no-default-browser-check']
            }
        });
        
        await stagehand.init();
        const page = stagehand.page;
        console.log('✅ Stagehand listo con sesión persistente');
        
        // Navegar a leads
        console.log('🌐 Navegando a leads...');
        await page.goto('https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead');
        await page.waitForTimeout(8000);
        
        console.log('📊 Información de la página:');
        console.log(`   URL: ${page.url()}`);
        console.log(`   Título: ${await page.title()}`);
        
        // Tomar screenshot para debugging
        console.log('📸 Tomando screenshot para debugging...');
        await page.screenshot({ path: 'diagnostics/salesforce-leads.png', fullPage: true });
        console.log('✅ Screenshot guardado en diagnostics/salesforce-leads.png');
        
        // Buscar TODOS los enlaces en la página
        console.log('🔍 Analizando enlaces disponibles...');
        const enlaces = await page.$$eval('a', links => 
            links.slice(0, 10).map(link => ({
                text: link.textContent?.trim() || '',
                href: link.href || '',
                className: link.className || '',
                id: link.id || ''
            }))
        );
        
        console.log('📋 Primeros 10 enlaces encontrados:');
        enlaces.forEach((enlace, i) => {
            if (enlace.text) {
                console.log(`   ${i + 1}. "${enlace.text}" (${enlace.className})`);
            }
        });
        
        // Intentar click en el primer enlace que parezca un lead
        console.log('🎯 Buscando enlace de lead...');
        try {
            // Buscar enlace que contenga texto y no sea navegación
            const enlaceLead = await page.$eval('a', link => {
                const text = link.textContent?.trim() || '';
                const href = link.href || '';
                
                // Buscar enlaces que parezcan nombres de personas o empresas
                if (text.length > 3 && 
                    !text.includes('Home') && 
                    !text.includes('Setup') && 
                    !text.includes('App') &&
                    (href.includes('Lead/') || text.match(/^[A-Z][a-z]+ [A-Z]/))) {
                    return { text, href };
                }
                return null;
            });
            
            if (enlaceLead) {
                console.log(`✅ Encontrado lead: "${enlaceLead.text}"`);
                // Click usando texto del enlace
                await page.click(`text="${enlaceLead.text}"`);
                console.log('🎉 ¡CLICK REALIZADO EXITOSAMENTE!');
                
                await page.waitForTimeout(3000);
                console.log(`📄 URL después del click: ${page.url()}`);
            } else {
                console.log('⚠️ No se encontró enlace de lead específico');
                // Fallback: click en primer enlace visible que tenga texto
                const primerEnlace = await page.$('a:has-text("")');
                if (primerEnlace) {
                    await primerEnlace.click();
                    console.log('✅ Click en primer enlace disponible');
                }
            }
            
        } catch (error) {
            console.log('⚠️ Error en click:', error.message);
        }
        
        console.log('🔓 Manteniendo navegador abierto...');
        console.log('💡 Revisa el screenshot en diagnostics/ para ver la estructura de la página');
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
    }
}

console.log('🚀 Ejecutando versión final...');
versionFinal();