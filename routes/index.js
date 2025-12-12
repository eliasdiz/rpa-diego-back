import express from 'express'

const router = express.Router()

router.get('/', (req,res) => {return res.json({ message: 'server online'})} )

// Ruta SIMPLE para probar Stagehand
router.post('/stagehand-simple', async (req, res) => {
    try {
        console.log('🧪 Iniciando prueba SIMPLE de Stagehand...');
        
        const { spawn } = await import('child_process');
        
        const proceso = spawn('npx', ['tsx', 'services/stagehand-simple.ts'], {
            cwd: process.cwd(),
            stdio: 'pipe'
        });
        
        let salida = '';
        let error = '';
        
        proceso.stdout.on('data', (data) => {
            const mensaje = data.toString();
            salida += mensaje;
            console.log(mensaje.trim());
        });
        
        proceso.stderr.on('data', (data) => {
            const mensaje = data.toString();
            error += mensaje;
            console.error(mensaje.trim());
        });
        
        proceso.on('close', (codigo) => {
            if (codigo === 0) {
                res.status(200).json({
                    success: true,
                    message: 'Prueba SIMPLE de Stagehand completada',
                    output: salida,
                    timestamp: new Date().toISOString()
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Error en prueba SIMPLE',
                    error: error,
                    output: salida,
                    exitCode: codigo,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Timeout de 2 minutos
        setTimeout(() => {
            if (!proceso.killed) {
                proceso.kill('SIGTERM');
                res.status(408).json({
                    success: false,
                    message: 'Timeout: Prueba tardó más de 2 minutos',
                    timeout: true
                });
            }
        }, 120000);
        
    } catch (error) {
        console.error('Error ejecutando prueba simple:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno',
            error: error.message
        });
    }
});

// Ruta para probar Stagehand
router.post('/test-stagehand', async (req, res) => {
    try {
        console.log('🧪 Iniciando prueba de Stagehand desde endpoint...');
        
        // Importar dinámicamente el módulo TypeScript usando tsx
        const { spawn } = await import('child_process');
        
        // Ejecutar el archivo TypeScript usando tsx
        const proceso = spawn('npx', ['tsx', 'services/stagehand-test.ts'], {
            cwd: process.cwd(),
            stdio: 'pipe'
        });
        
        let salida = '';
        let error = '';
        
        proceso.stdout.on('data', (data) => {
            const mensaje = data.toString();
            salida += mensaje;
            console.log(mensaje.trim());
        });
        
        proceso.stderr.on('data', (data) => {
            const mensaje = data.toString();
            error += mensaje;
            console.error(mensaje.trim());
        });
        
        proceso.on('close', (codigo) => {
            if (codigo === 0) {
                res.status(200).json({
                    success: true,
                    message: 'Prueba de Stagehand completada exitosamente',
                    output: salida,
                    timestamp: new Date().toISOString()
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Error en la prueba de Stagehand',
                    error: error,
                    output: salida,
                    exitCode: codigo,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Timeout de 5 minutos para la prueba
        setTimeout(() => {
            if (!proceso.killed) {
                proceso.kill('SIGTERM');
                res.status(408).json({
                    success: false,
                    message: 'Timeout: La prueba de Stagehand tardó más de 5 minutos',
                    timeout: true,
                    timestamp: new Date().toISOString()
                });
            }
        }, 300000); // 5 minutos
        
    } catch (error) {
        console.error('Error ejecutando prueba de Stagehand:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno ejecutando prueba de Stagehand',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Ruta para obtener los resultados de la última prueba
router.get('/test-stagehand/results', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const diagnosticsDir = path.join(process.cwd(), 'diagnostics');
        
        if (!fs.existsSync(diagnosticsDir)) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron resultados de pruebas'
            });
        }
        
        // Buscar el archivo más reciente de resultados de Stagehand
        const archivos = fs.readdirSync(diagnosticsDir)
            .filter(archivo => archivo.startsWith('stagehand-test-') && archivo.endsWith('.json'))
            .map(archivo => ({
                nombre: archivo,
                tiempo: fs.statSync(path.join(diagnosticsDir, archivo)).mtime
            }))
            .sort((a, b) => b.tiempo - a.tiempo);
        
        if (archivos.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron resultados de pruebas de Stagehand'
            });
        }
        
        const archivoMasReciente = archivos[0].nombre;
        const rutaArchivo = path.join(diagnosticsDir, archivoMasReciente);
        const contenido = fs.readFileSync(rutaArchivo, 'utf8');
        const resultados = JSON.parse(contenido);
        
        res.status(200).json({
            success: true,
            archivo: archivoMasReciente,
            resultados: resultados,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error obteniendo resultados:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo resultados de pruebas',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 🤖 AUTOMATIZACIÓN CON STAGEHAND

// Ejecutar automatización con Stagehand (versión antigua)
router.post('/automatizacion-stagehand', async (req, res) => {
    try {
        console.log('🤖 Ejecutando automatización con Stagehand...');

        const { ejecutar } = await import('../services/automatizacion-stagehand.js');

        const resultado = await ejecutar();

        res.json({
            success: true,
            message: 'Automatización con Stagehand completada',
            datos: {
                leadsProcesados: resultado.leadsProcesados,
                prospectosCambiados: resultado.prospectosCambiados
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error en automatización Stagehand:', error);
        res.status(500).json({
            success: false,
            message: 'Error ejecutando automatización con Stagehand',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 🚀 AUTOMATIZACIÓN SALESFORCE CON STAGEHAND COMO AGENTE IA
router.post('/automatizacion-salesforce-stagehand', async (req, res) => {
    try {
        console.log('🤖 Ejecutando automatización Salesforce con Stagehand (Agente IA)...');

        const { spawn } = await import('child_process');
        const { cantidad } = req.body;

        // Ejecutar el archivo TypeScript usando tsx
        const args = ['tsx', 'services/automatizacion-salesforce-stagehand.ts'];

        // Agregar cantidad si se proporciona
        if (cantidad) {
            args.push(String(cantidad));
        }

        const proceso = spawn('npx', args, {
            cwd: process.cwd(),
            stdio: 'pipe'
        });

        let salida = '';
        let error = '';

        proceso.stdout.on('data', (data) => {
            const mensaje = data.toString();
            salida += mensaje;
            console.log(mensaje.trim());
        });

        proceso.stderr.on('data', (data) => {
            const mensaje = data.toString();
            error += mensaje;
            console.error(mensaje.trim());
        });

        proceso.on('close', (codigo) => {
            if (codigo === 0) {
                res.status(200).json({
                    success: true,
                    message: 'Automatización Salesforce completada exitosamente',
                    output: salida,
                    timestamp: new Date().toISOString()
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Error en automatización Salesforce',
                    error: error,
                    output: salida,
                    exitCode: codigo,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Timeout de 15 minutos
        setTimeout(() => {
            if (!proceso.killed) {
                proceso.kill('SIGTERM');
                res.status(408).json({
                    success: false,
                    message: 'Timeout: La automatización tardó más de 15 minutos',
                    timeout: true,
                    timestamp: new Date().toISOString()
                });
            }
        }, 900000); // 15 minutos

    } catch (error) {
        console.error('Error ejecutando automatización Salesforce:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno ejecutando automatización Salesforce',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

export default router