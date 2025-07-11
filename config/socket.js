import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { automatizar } from '../services/automatizacion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, 'config.json');

export function createSocketServer(server) {
	const io = new Server(server, {
		cors: {
			origin: 'http://localhost:5173',
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

		socket.on('iniciar-automatizacion', () => {
			console.log('🚀 Iniciando automatización...');
			automatizar(socket);
		});
	});
}
