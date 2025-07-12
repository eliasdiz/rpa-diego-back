import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../config/config.json');

export async function automatizar(socket, setBrowser) {
	try {
		// Leer configuración
		const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
		let { email, passwordHash, cantidad, contador } = config;

		// Verificar credenciales
		if (!email || !passwordHash) {
			console.log("❌ Credenciales no configuradas correctamente");
			socket.emit('login-fallido', 'Credenciales incorrectas');
			return; // Detener la automatización
		}

		// Verificar cantidad de prospectos
		if (!cantidad || cantidad <= 0) {
			console.log("❌ Cantidad de prospectos no configurada correctamente");
			socket.emit('login-fallido', 'Cantidad de prospectos no válida');
			return; // Detener la automatización
		}

		// Lanzar navegador
		const browser = await puppeteer.launch({
			headless: true,  // Ejecutar en modo headless (sin UI)
			args: ['--no-sandbox', '--disable-setuid-sandbox'], // Requerido en algunos servidores
		});
		setBrowser(browser);  // Pasamos la instancia de navegador al servidor para poder detenerlo luego
		const page = await browser.newPage();
		const timeout = 10000;  // Timeout de 10 segundos
		page.setDefaultTimeout(timeout);

		// Configuramos el tamaño del viewport
		await page.setViewport({ width: 1440, height: 900 });

		// Ir al login de Salesforce
		await page.goto('https://sura.my.salesforce.com/?ec=302&startURL=%2F00QRO00000K1XUg');

		await page.waitForSelector('#username', { timeout });
		await page.type('#username', email);

		await page.waitForSelector('#password', { timeout });
		await page.type('#password', passwordHash);

		await Promise.all([page.waitForNavigation(), page.click('#Login')]);

		// Verificar si hay un mensaje de error de login
		const errorMessage = await page.$('#error');
		if (errorMessage) {
			console.log('❌ Error en las credenciales: Email o contraseña incorrectos');
			socket.emit('login-fallido', 'Error en las credenciales: Email o contraseña incorrectos');
			await browser.close();
			return;  // Detener la automatización
		}

		console.log("🔐 Esperando verificación en dos pasos...");
		await new Promise(resolve => setTimeout(resolve, 32000));  // Esperar 32 segundos

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

		// Ir a la pestaña de prospectos y aplicar el filtro "Antioquia PYF"
		await page.goto('https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead', { waitUntil: 'networkidle2' });

		let prospectosContados = 0; // Inicializar en 0

		// Comenzar a buscar leads cada 5 segundos
		while (prospectosContados < cantidad) {
			console.log(`🔄 Buscando nuevos leads... (Prospectos encontrados: ${prospectosContados}/${cantidad})`);

			// Recargar la página para obtener los últimos leads
			await page.reload({ waitUntil: 'networkidle2' });

			// Verificar si hay leads en la tabla
			const leads = await page.$$('table tbody tr');
			if (leads.length > 0) {
				for (const lead of leads) {
					// Hacer clic en el nombre del lead para acceder a la página de detalle
					const leadName = await lead.$('th > span span');
					if (leadName) {
						await leadName.click();

						// Verificar si la solución es válida
						const solucion = await page.$('div[data-label="Solución"]');  // Modificar este selector según lo que encuentres en la página

						// Obtener el texto de la solución
						const solucionTexto = await page.evaluate(el => el ? el.textContent.trim() : '', solucion);

						// Validar si la solución está en la lista de soluciones válidas
						const solucionesValidas = [
							'Plan vive',
							'Salud familiar',
							'Salud evoluciona familiar',
							'Plan crédito protegido'
						];

						if (solucionesValidas.includes(solucionTexto)) {
							// Si la solución es válida, buscar el botón de cambio de propietario
							const buttonChange = await page.waitForSelector('button[name="ChangeOwnerOne"]', { timeout: 3000 }).catch(() => null);
							if (buttonChange) {
								console.log('✅ Cambio de propietario disponible. Cambiando propietario...');

								// Hacer clic en el botón de cambio de propietario
								await buttonChange.click();

								// Esperar el modal de cambio de propietario
								const modal = await page.waitForSelector('div[role="dialog"]');
								if (modal) {
									const inputChange = await page.waitForSelector('input[title="Buscar Usuarios"]');
									await inputChange?.click();

									const diego = await page.waitForSelector('div[title="Diego Ignacio Alvarez Franco"]');
									await diego?.click();

									const enviar = await page.waitForSelector('button[title="Enviar"]');
									await enviar?.click();

									// Verificar si hubo un error
									const modalError = await page.$('div[class="modalError"]') !== null;
									if (modalError) {
										const errorMessageElement = await page.$('.changeOwnerErrorMessage');
										const errorMessage = await page.evaluate(el => el?.textContent, errorMessageElement);
										console.log(`❌ Error en el cambio de propietario: ${errorMessage}`);
									} else {
										prospectosContados += 1;
										console.log(`✅ Cambio de propietario realizado correctamente. Prospectos: ${prospectosContados}`);
										socket.emit('update-leads', { count: prospectosContados });
									}
								}
							}
						} else {
							console.log(`❌ Lead con solución ${solucionTexto} no cumple con la validación. Regresando a prospectos...`);
						}

						// Volver a la página de prospectos
						await page.goto('https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead', { waitUntil: 'networkidle2' });
					}
				}
			} else {
				console.log('❌ No se encontraron leads nuevos.');
			}

			// Si ya se alcanzó la cantidad de prospectos, detener la automatización
			if (prospectosContados >= cantidad) {
				console.log('✅ Se alcanzó la cantidad deseada de cambios de propietario. Deteniendo la automatización.');
				socket.emit('automatizacion-detenida');
				break;
			}

			// Esperar 5 segundos antes de la siguiente recarga
			await new Promise(resolve => setTimeout(resolve, 5000));
		}

		await browser.close();

	} catch (error) {
		console.error('❌ Error en automatización:', error.message);
		socket.emit('login-fallido', error.message);
	}
}
