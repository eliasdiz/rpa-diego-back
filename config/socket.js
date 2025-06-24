import { Server } from 'socket.io';

export function createSocketServer(httpServer) {
	const io = new Server(httpServer, {
		cors: {
			origin: 'http://localhost:5173/', // Cambia por 'http://localhost:5173' o tu dominio real
			methods: ['GET', 'POST'],
		},
	});

	io.on('connection', (socket) => {
		console.log(`Client connected: ${socket.id}`);

		socket.on('disconnect', () => {
			console.log(`Client disconnected: ${socket.id}`);
		});

		// Puedes agregar más eventos aquí
	});

	return io;
}
