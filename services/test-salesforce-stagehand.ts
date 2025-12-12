/**
 * Script de prueba para validar la automatización Salesforce con Stagehand
 *
 * Este script ejecuta una prueba rápida con solo 1 lead para verificar
 * que todo está configurado correctamente.
 */

import { ejecutarAutomatizacion } from './automatizacion-salesforce-stagehand.js';

console.log('🧪 === MODO DE PRUEBA - SALESFORCE STAGEHAND ===\n');
console.log('📋 Configuración:');
console.log('   - Cantidad de leads: 1 (modo prueba)');
console.log('   - Objetivo: Validar configuración y flujo básico\n');
console.log('⚠️  Asegúrate de:');
console.log('   1. Tener GEMINI_API_KEY en .env');
console.log('   2. Estar conectado a Salesforce en el navegador');
console.log('   3. Tener leads disponibles en la vista filtrada\n');
console.log('⏱️  Tiempo estimado: 1-2 minutos\n');
console.log('─'.repeat(60));
console.log('');

// Ejecutar con solo 1 lead para prueba rápida
ejecutarAutomatizacion(1)
    .then((resultado) => {
        console.log('\n' + '─'.repeat(60));
        console.log('🧪 === RESULTADO DE PRUEBA ===\n');
        console.log(`✅ Exitoso: ${resultado.exitoso ? 'SÍ' : 'NO'}`);
        console.log(`📊 Leads procesados: ${resultado.leadsProcesados}`);
        console.log(`📊 Leads asignados: ${resultado.leadsAsignados}`);
        console.log(`⏱️  Tiempo total: ${Math.round(resultado.tiempoTotal / 1000)}s`);

        if (resultado.errores.length > 0) {
            console.log(`\n⚠️  Errores encontrados:`);
            resultado.errores.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        } else {
            console.log(`\n✅ Sin errores`);
        }

        console.log('\n' + '─'.repeat(60));

        if (resultado.exitoso && resultado.leadsAsignados > 0) {
            console.log('\n🎉 PRUEBA EXITOSA');
            console.log('✅ La automatización está funcionando correctamente');
            console.log('💡 Puedes ejecutar con más leads usando:');
            console.log('   npm run salesforce-stagehand 5');
            process.exit(0);
        } else {
            console.log('\n⚠️  PRUEBA COMPLETADA CON PROBLEMAS');
            console.log('📖 Revisa el README para troubleshooting');
            process.exit(1);
        }
    })
    .catch((error: Error) => {
        console.error('\n❌ ERROR FATAL EN PRUEBA:');
        console.error(error.message);
        console.error('\n📖 Revisa:');
        console.error('   1. Que GEMINI_API_KEY esté configurada');
        console.error('   2. Que estés conectado a Salesforce');
        console.error('   3. Los logs detallados arriba');
        process.exit(1);
    });
