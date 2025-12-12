// 🧠 AUTOMATIZACIÓN CON IA DE STAGEHAND
// Usa las funcionalidades inteligentes de Stagehand (NO selectores manuales)

import { Stagehand } from '@browserbasehq/stagehand';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('🧠 Iniciando automatización con IA de Stagehand...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../config/config.json');

// Función para hora actual
const horaActual = () => new Date().toLocaleTimeString();

// Función para normalizar texto
function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Soluciones válidas
const SOLUCIONES_VALIDAS = [
    'Plan vive',
    'Salud familiar',
    'Salud evoluciona familiar',
    'Plan credito protegido'
];

const SOLUCIONES_VALIDAS_NORMALIZADAS = SOLUCIONES_VALIDAS.map(s => normalizarTexto(s));
console.log('✅ Soluciones válidas:', SOLUCIONES_VALIDAS_NORMALIZADAS);

// URL de leads
const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';

export async function automatizarConIA() {
    console.log(`🧠 [${horaActual()}] Iniciando automatización con IA de Stagehand...`);

    let stagehand;
    let leadsProcesados = 0;
    let prospectosCambiados = 0;

    try {
        // Leer configuración
        console.log(`📋 [${horaActual()}] Leyendo configuración...`);
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const { email, cantidad, contador = 0 } = config;

        console.log(`📊 [${horaActual()}] Email: ${email}, Cantidad: ${cantidad}, Contador: ${contador}`);

        if (!email || !cantidad) {
            throw new Error('Configuración incompleta en config.json');
        }

        // Inicializar Stagehand conectándose al navegador existente
        console.log(`🔧 [${horaActual()}] Conectando Stagehand al navegador existente...`);
        stagehand = new Stagehand({
            env: 'LOCAL',
            verbose: 2,
            enableCaching: false,
            // Configurar para conectarse al navegador existente en puerto 9222
            localBrowserOptions: {
                browserWSEndpoint: 'ws://localhost:9222'
            }
        });

        console.log(`⏳ [${horaActual()}] Iniciando Stagehand...`);
        await stagehand.init();
        console.log(`✅ [${horaActual()}] Stagehand con IA inicializado correctamente`);

        console.log(`🌐 [${horaActual()}] Navegando a lista de leads...`);
        await stagehand.page.goto(PROSPECTOS_URL);
        console.log(`✅ [${horaActual()}] Navegación completada`);

        prospectosCambiados = contador;

        // BUCLE PRINCIPAL con IA
        let intentos = 0;
        const maxIntentos = 50;

        while (prospectosCambiados < cantidad && intentos < maxIntentos) {
            intentos++;
            console.log(`\n🔄 [${horaActual()}] Intento ${intentos}: Recargando página...`);
            
            await stagehand.page.reload();
            await stagehand.page.waitForTimeout(5000);

            try {
                console.log(`🧠 [${horaActual()}] Usando IA para detectar leads...`);

                // Usar IA para verificar si hay leads
                const infoTabla = await stagehand.extract({
                    instruction: "Analiza la tabla de leads. ¿Hay leads visibles? ¿Cuántos hay?",
                    schema: {
                        type: "object",
                        properties: {
                            hayLeads: { type: "boolean", description: "Si hay leads visibles en la tabla" },
                            cantidad: { type: "number", description: "Número de leads visibles" },
                            primerLead: { type: "string", description: "Nombre del primer lead si existe" }
                        }
                    }
                });

                console.log(`📊 [${horaActual()}] IA detectó: ${JSON.stringify(infoTabla)}`);

                if (!infoTabla.hayLeads || infoTabla.cantidad === 0) {
                    console.log(`❌ [${horaActual()}] IA no detectó leads, reintentando...`);
                    continue;
                }

                console.log(`✅ [${horaActual()}] IA encontró ${infoTabla.cantidad} leads`);

                // Usar IA para hacer clic en el primer lead
                console.log(`🎯 [${horaActual()}] Usando IA para abrir el primer lead...`);
                await stagehand.act({
                    action: "click",
                    text: "Hacer clic en el primer lead de la tabla para abrirlo"
                });

                await stagehand.page.waitForTimeout(3000);

                // Verificar que estamos en la página del lead
                const urlActual = stagehand.page.url();
                if (!urlActual.includes('/lightning/r/Lead/')) {
                    console.log(`❌ [${horaActual()}] No se abrió el lead. URL: ${urlActual}`);
                    continue;
                }

                leadsProcesados++;
                console.log(`📄 [${horaActual()}] Lead ${leadsProcesados} abierto: ${urlActual}`);

                // Usar IA para extraer toda la información del lead
                console.log(`🧠 [${horaActual()}] Usando IA para extraer información del lead...`);
                const infoLead = await stagehand.extract({
                    instruction: "Extrae toda la información importante de este lead: nombre, teléfono, email, y especialmente la SOLUCIÓN del producto",
                    schema: {
                        type: "object",
                        properties: {
                            nombre: { type: "string", description: "Nombre completo del lead" },
                            telefono: { type: "string", description: "Número de teléfono" },
                            email: { type: "string", description: "Email del lead" },
                            solucion: { type: "string", description: "Solución del producto (muy importante)" },
                            empresa: { type: "string", description: "Empresa del lead" }
                        }
                    }
                });

                console.log(`👤 [${horaActual()}] Info del lead:`, infoLead);

                if (!infoLead.solucion) {
                    console.log(`⚠️ [${horaActual()}] IA no pudo extraer la solución, saltando...`);
                    await volverAListaConIA(stagehand);
                    continue;
                }

                const solucionNormalizada = normalizarTexto(infoLead.solucion);
                console.log(`🔍 [${horaActual()}] Solución normalizada: "${solucionNormalizada}"`);

                const esSolucionValida = SOLUCIONES_VALIDAS_NORMALIZADAS.includes(solucionNormalizada);
                console.log(`${esSolucionValida ? '✅' : '❌'} [${horaActual()}] Solución ${esSolucionValida ? 'VÁLIDA' : 'INVÁLIDA'}`);

                if (!esSolucionValida) {
                    console.log(`⏩ [${horaActual()}] Saltando lead con solución inválida`);
                    await volverAListaConIA(stagehand);
                    continue;
                }

                // Usar IA para cambiar el propietario
                console.log(`🔄 [${horaActual()}] Usando IA para cambiar propietario...`);
                
                try {
                    // Buscar y hacer clic en "Cambiar propietario" con IA
                    console.log(`🎯 [${horaActual()}] Buscando botón 'Cambiar propietario'...`);
                    await stagehand.act({
                        action: "click",
                        text: "Cambiar propietario"
                    });

                    await stagehand.page.waitForTimeout(2000);
                    console.log(`✅ [${horaActual()}] Modal abierto`);

                    // Buscar usuario con IA
                    console.log(`🔍 [${horaActual()}] Usando IA para buscar usuario...`);
                    await stagehand.act({
                        action: "type",
                        text: email,
                        instruction: "Escribir en el campo de búsqueda de usuarios"
                    });

                    await stagehand.page.waitForTimeout(1000);

                    // Seleccionar el usuario
                    console.log(`👆 [${horaActual()}] Seleccionando usuario...`);
                    await stagehand.act({
                        action: "click",
                        text: email,
                        instruction: "Hacer clic en el usuario encontrado en la lista"
                    });

                    // Guardar cambios
                    console.log(`💾 [${horaActual()}] Guardando cambios...`);
                    await stagehand.act({
                        action: "click",
                        text: "Guardar"
                    });

                    await stagehand.page.waitForTimeout(3000);

                    prospectosCambiados++;
                    console.log(`🎉 [${horaActual()}] ¡ÉXITO! Prospecto cambiado con IA. Total: ${prospectosCambiados}/${cantidad}`);

                    // Actualizar configuración
                    config.contador = prospectosCambiados;
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

                } catch (cambioError) {
                    console.log(`❌ [${horaActual()}] Error en cambio con IA: ${cambioError.message}`);
                }

                // Volver a la lista
                await volverAListaConIA(stagehand);
                await stagehand.page.waitForTimeout(3000);

            } catch (error) {
                console.error(`⚠️ [${horaActual()}] Error en procesamiento con IA: ${error.message}`);
                await volverAListaConIA(stagehand);
            }
        }

        console.log(`🎉 [${horaActual()}] ¡Automatización con IA completada! Total: ${prospectosCambiados}`);

    } catch (error) {
        console.error(`❌ [${horaActual()}] Error crítico: ${error.message}`);
        throw error;
    } finally {
        if (stagehand) {
            console.log(`🔴 [${horaActual()}] Cerrando Stagehand...`);
            await stagehand.close();
        }
    }

    return { leadsProcesados, prospectosCambiados };
}

// Función para volver a la lista con IA
async function volverAListaConIA(stagehand) {
    try {
        console.log(`🔄 [${horaActual()}] Volviendo a la lista...`);
        await stagehand.page.goto(PROSPECTOS_URL);
        await stagehand.page.waitForTimeout(2000);
    } catch (error) {
        console.log(`⚠️ [${horaActual()}] Error volviendo a lista: ${error.message}`);
    }
}

// Función para ejecutar
export async function ejecutar() {
    try {
        console.log('🎯 Ejecutando automatización con IA...');
        const resultado = await automatizarConIA();
        console.log('📊 Resultado final:', resultado);
        return resultado;
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

// Ejecutar directamente
console.log('🎯 Iniciando automatización con IA...');
ejecutar().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
});