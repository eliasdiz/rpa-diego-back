import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { automatizar } from '../services/automatizacion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, 'config.json');

let browser = null;  // Para almacenar la instancia del navegador

export function createSocketServer(server) {
	const io = new Server(server, {
		cors: {
			origin: 'https://aut-diego.netlify.app',
			// origin: 'http://localhost:5173',
			methods: ['GET', 'POST'],
		},
	});

	io.on('connection', (socket) => {
		console.log('🟢 Cliente conectado:', socket.id);

		socket.on('guardar-config', (data) => {
			console.log('📥 Evento recibido: guardar-config', data);
			try {
				const configActual = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
				const nuevaConfig = {
					...configActual,
					...data,
				};
				fs.writeFileSync(configPath, JSON.stringify(nuevaConfig, null, 2));
				socket.emit('config-guardada', nuevaConfig);
				console.log('📤 Evento enviado: config-guardada');
			} catch (error) {
				socket.emit('error-config', 'No se pudo guardar la configuración');
			}
		});

		// Iniciar la automatización
		socket.on('iniciar-automatizacion', () => {
			console.log('🚀 Iniciando automatización...');
			automatizar(socket, (newBrowser) => {
				// Guardamos el navegador para poder cerrarlo luego
				browser = newBrowser;
			});
		});

		// Detener la automatización
		socket.on('detener-automatizacion', () => {
			console.log('🚫 Deteniendo automatización...');
			if (browser) {
				browser.close();  // Cerrar el navegador si está abierto
				browser = null;  // Limpiar la instancia del navegador
			}
			socket.emit('automatizacion-detenida');
		});
	});
}
