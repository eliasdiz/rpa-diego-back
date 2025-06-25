import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../config/config.json');

export async function automatizar(socket) {
	try {
		const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
		const { email, passwordHash } = config;

		if (!email || !passwordHash) {
			throw new Error('Email o contraseña no están configurados');
		}

		const browser = await puppeteer.launch({ headless: false });
		const page = await browser.newPage();
		const timeout = 5000;
		page.setDefaultTimeout(timeout);

		await page.setViewport({ width: 761, height: 599 });

		await page.goto('https://sura.my.salesforce.com/?ec=302&startURL=%2F00QRO00000K1XUg');

		await page.waitForSelector('#username', { timeout });
		await page.type('#username', email);

		await page.waitForSelector('#password', { timeout });
		await page.type('#password', passwordHash);

		await Promise.all([
			page.waitForNavigation(),
			page.click('#Login')
		]);

		console.log("🔐 Esperando verificación en dos pasos...");
		await new Promise(resolve => setTimeout(resolve, 32000));

		// Verificar si sigue en pantalla de verificación 2FA
		const estaEnVerificacion = await page.$('input[value="Verificar"][title="Verificar"]');
		const estaEnHome = await page.$('div.oneAppNavContainer');

		if (estaEnVerificacion) {
			console.log('❌ Falló la autenticación en dos pasos');
			socket.emit('login-fallido', 'Autenticación en dos pasos no completada');
			await browser.close();
			return;
		}

		if (!estaEnHome) {
			console.log('❌ No se detectó acceso al home, login posiblemente fallido');
			socket.emit('login-fallido', 'No se detectó acceso al home');
			await browser.close();
			return;
		}

		socket.emit('login-exitoso');
		console.log('✅ Login exitoso');

	} catch (error) {
		console.error('❌ Error en automatización (login):', error.message);
		socket.emit('login-fallido', error.message);
	}
}
