// Prueba básica para verificar que Stagehand funciona
console.log('🚀 Iniciando prueba básica de Stagehand...');

import { Stagehand } from '@browserbasehq/stagehand';

async function pruebaBasica() {
    try {
        console.log('⚙️ Creando instancia de Stagehand...');
        
        const stagehand = new Stagehand({
            env: 'LOCAL',
            verbose: 2,
            enableCaching: false,
        });
        
        console.log('✅ Stagehand creado correctamente');
        console.log('🎉 Prueba básica completada');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

pruebaBasica();