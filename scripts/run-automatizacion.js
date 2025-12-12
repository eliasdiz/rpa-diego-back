#!/usr/bin/env node
import { automatizar } from '../services/automatizacion-refactorizada-v2.js';

// Mock del socket para ejecutar standalone
const mockSocket = {
    emit: (event, data) => {
        console.log(`📡 Socket Event: ${event}`, data ? JSON.stringify(data, null, 2) : '');
    }
};

// Mock del setBrowser
const mockSetBrowser = (browser) => {
    console.log('🌐 Browser conectado');
};

// Ejecutar la automatización
console.log('🚀 Iniciando automatización desde script standalone...\n');

automatizar(mockSocket, mockSetBrowser)
    .then(() => {
        console.log('\n✅ Script finalizado exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error en el script:', error.message);
        process.exit(1);
    });