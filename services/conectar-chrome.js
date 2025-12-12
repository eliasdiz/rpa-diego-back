// Script SIMPLE: Conectar a Chrome existente y hacer click en primer lead
import { chromium } from 'playwright';

async function conectarYHacerClick() {
    console.log('🔗 Conectando a Chrome existente...');
    
    try {
        // Conectar al Chrome que ya está abierto
        const browser = await chromium.connectOverCDP('http://localhost:9222');
        console.log('✅ Conectado a Chrome');
        
        // Usar el contexto existente (donde ya hiciste login)
        const context = browser.contexts()[0];
        console.log(`📑 Usando contexto con ${context.pages().length} pestañas`);
        
        // Crear nueva pestaña
        const page = await context.newPage();
        console.log('📄 Nueva pestaña creada');
        
        // Ir a la página de leads
        console.log('🌐 Navegando a leads...');
        await page.goto('https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead');
        
        // Esperar que cargue
        console.log('⏳ Esperando 10 segundos...');
        await page.waitForTimeout(10000);
        
        console.log(`📊 URL actual: ${page.url()}`);
        console.log(`📊 Título: ${await page.title()}`);
        
        // Buscar primer lead
        console.log('🔍 Buscando primer lead...');
        
        // Estrategia simple: buscar cualquier enlace que tenga "Lead/" en la URL
        const leads = await page.$$('a[href*="Lead/"]');
        
        if (leads.length > 0) {
            console.log(`✅ Encontrados ${leads.length} leads`);
            
            // Hacer click en el primero
            const primerLead = leads[0];
            const texto = await primerLead.textContent();
            console.log(`🎯 Haciendo click en: "${texto?.trim()}"`);
            
            await primerLead.click();
            console.log('🎉 ¡CLICK REALIZADO!');
            
            // Esperar a ver el resultado
            await page.waitForTimeout(3000);
            console.log(`📄 Nueva URL: ${page.url()}`);
            
        } else {
            console.log('❌ No se encontraron leads');
            
            // Tomar screenshot para ver qué hay
            await page.screenshot({ path: 'diagnostics/debug-leads.png' });
            console.log('📸 Screenshot guardado en diagnostics/debug-leads.png');
        }
        
        console.log('🔓 Manteniendo Chrome abierto...');
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.log('\n💡 SOLUCIÓN:');
        console.log('1. Abre Chrome con: chrome --remote-debugging-port=9222');
        console.log('2. Haz login en Salesforce en esa ventana');
        console.log('3. Ejecuta este script');
    }
}

console.log('🚀 Iniciando conexión...');
conectarYHacerClick();