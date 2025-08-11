// // import puppeteer from 'puppeteer';
// import puppeteer from 'puppeteer-core';
// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const configPath = path.join(__dirname, '../config/config.json');

// // Constantes
// const SOLUCIONES_VALIDAS = [
//     'Plan vive',
//     'Salud familiar',
//     'Salud evoluciona familiar',
//     'Plan crédito protegido'
// ];
// const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';

// export async function automatizar(socket, setBrowser) {
//     let browser;
//     try {
//         // Leer configuración
//         const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
//         const { email, passwordHash, cantidad, contador = 0 } = config;

//         // Validaciones iniciales
//         if (!email || !passwordHash) {
//             throw new Error('Credenciales no configuradas en config.json');
//         }

//         if (!cantidad || cantidad <= 0) {
//             throw new Error('Cantidad de prospectos no válida en config.json');
//         }

//         // 1. Iniciar navegador

//         // browser = await puppeteer.connect({
//         //     // headless: false,
//         //     // headless: true,
//         //     // args: ['--no-sandbox', '--disable-setuid-sandbox'],
//         //     // headless: false,
//         //     // userDataDir: 'C:/Users/Usuario/AppData/Local/Google/Chrome/User Data',
//         //     // args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
//         //     browserURL: 'http://localhost:9222/json',
//         // });

//         browser = await puppeteer.connect({
//             browserURL: 'http://localhost:9222',
//             defaultViewport: null,
//         });
//         setBrowser(browser);
//         // const pages = await browser.pages();
//         const page = await browser.newPage();

//         // setBrowser(browser);
//         // const page = await browser.newPage();
//         // await page.setViewport({ width: 1440, height: 900 });
//         // page.setDefaultTimeout(15000);

//         // 2. Login
//         // await page.goto('https://sura.my.salesforce.com/?ec=302&startURL=%2F00QRO00000K1XUg');
//         // await page.type('#username', email);
//         // await page.type('#password', passwordHash);
//         // await Promise.all([page.waitForNavigation(), page.click('#Login')]);

//         // if (await page.$('#error')) {
//         //     throw { message: 'Error en credenciales', etapa: 'login' };
//         // }

//         // console.log("🔐 Esperando verificación en dos pasos...");
//         // await new Promise(resolve => setTimeout(resolve, 32000));

//         // // 3. Verificar 2FA
//         // if (await page.$('input[value="Verificar"][title="Verificar"]') || !(await page.$('div.oneAppNavContainer'))) {
//         //     throw { message: 'Falló autenticación en dos pasos', etapa: 'login' };
//         // }

//         // socket.emit('login-exitoso');
//         // console.log('✅ Login exitoso');

//         // 4. Navegar a prospectos
//         await page.goto(PROSPECTOS_URL, { waitUntil: 'networkidle0' });
//         let prospectosCambiados = contador;

//         // 5. Bucle principal
//         while (prospectosCambiados < cantidad) {
//             console.log(`🔄 Buscando leads (${prospectosCambiados}/${cantidad})...`);
//             await page.reload({ waitUntil: 'networkidle0' });

//             const tablaLeads = await page.$('table[aria-label="Antioquia - PYF"]');
//             if (!tablaLeads) {
//                 console.log('❌ No hay leads disponibles. Esperando...');
//                 await new Promise(resolve => setTimeout(resolve, 5000));
//                 continue;
//             }

//             const leads = await page.$$('table tbody tr');
//             for (const lead of leads) {
//                 try {
//                     // 5.1 Validar estado
//                     const estado = await lead.$eval(
//                         'td[data-label="Estado de prospecto"] span',
//                         el => el.textContent.trim()
//                     ).catch(() => '');

//                     if (estado === 'Abierto') {
//                         console.log('⏩ Lead ya abierto. Saltando...');
//                         continue;
//                     }

//                     // 5.2 Abrir lead
//                     const nombreLead = await lead.$('a.slds-truncate[href^="/lightning/r/"]');
//                     if (!nombreLead) continue;

//                     await Promise.all([
//                         nombreLead.click(),
//                         page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {})
//                     ]);

//                     // 5.3 Validar botón cambio propietario
//                     const buttonChange = await page.waitForSelector('button[name="ChangeOwnerOne"]', { timeout: 5000 })
//                         .catch(() => { throw { message: 'Botón no encontrado', etapa: 'validacion-boton' } });

//                     // 5.4 Validar solución
//                     const solucionTexto = await page.$eval(
//                         'records-highlights-details-item p[title="Solución"] + p force-lookup a span',
//                         el => el.textContent.trim()
//                     ).catch(() => '');

//                     if (!SOLUCIONES_VALIDAS.includes(solucionTexto)) {
//                         throw { message: `Solución no válida: ${solucionTexto}`, etapa: 'validacion-solucion' };
//                     }

//                     // 5.5 Cambiar propietario
//                     console.log('✅ Iniciando cambio de propietario...');
//                     await buttonChange.click();

//                     const modal = await page.waitForSelector('div[role="dialog"]', { timeout: 5000 })
//                         .catch(() => { throw { message: 'Modal no apareció', etapa: 'cambio-propietario' } });

//                     await page.type('input[title="Buscar Usuarios"]', 'Diego Ignacio Alvarez Franco', { delay: 100 });
//                     await page.click('div[title="Diego Ignacio Alvarez Franco"]');
//                     await page.click('button[title="Enviar"]');

//                     // 5.6 Verificar éxito
//                     await page.waitForTimeout(2000);
//                     if (await page.$('div[role="dialog"]')) {
//                         throw { message: 'Error en cambio de propietario', etapa: 'cambio-propietario' };
//                     }

//                     prospectosCambiados++;
//                     console.log(`✅ Cambio exitoso! Total: ${prospectosCambiados}`);
//                     socket.emit('update-leads', { count: prospectosCambiados });

//                 } catch (error) {
//                     console.error(`⚠️ Error: ${error.message}`);
//                     socket.emit('error-automatizacion', error);
//                 } finally {
//                     // Siempre volver a la lista
//                     await page.goto(PROSPECTOS_URL, { waitUntil: 'networkidle0' });
//                 }

//                 if (prospectosCambiados >= cantidad) break;
//             }

//             await new Promise(resolve => setTimeout(resolve, 5000));
//         }

//         // Actualización final
//         config.contador = prospectosCambiados;
//         fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

//         console.log('✅ Automatización completada!');
//         socket.emit('automatizacion-detenida');

//     } catch (error) {
//         console.error('❌ Error crítico:', error.message);
//         socket.emit('error-automatizacion', {
//             message: error.message,
//             etapa: error.etapa || 'general'
//         });
//     } finally {
//         if (browser) await browser.close();
//     }
// }





import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { format } from '@formkit/tempo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../config/config.json');

// Constantes
const SOLUCIONES_VALIDAS = [
	'Plan vive',
	'Salud familiar',
	'Salud evoluciona familiar',
	'Plan crédito protegido'
];

// Función para hora actual (formato HH:MM:SS)
const horaActual = () => format(new Date(),{ time: 'short'})

const PROSPECTOS_URL = 'https://sura.lightning.force.com/lightning/o/Lead/list?filterName=Antioquia_PYF_Lead';

export async function automatizar(socket, setBrowser) {
	let browser;
	try {
		// Leer configuración
		const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
		const { email, passwordHash, cantidad, contador = 0 } = config;

		// Validaciones iniciales
		if (!email || !passwordHash) {
			throw new Error('Credenciales no configuradas en config.json');
		}

		if (!cantidad || cantidad <= 0) {
			throw new Error('Cantidad de prospectos no válida en config.json');
		}

		// 1. Iniciar navegador
		browser = await puppeteer.connect({
			browserURL: 'http://localhost:9222',
			defaultViewport: null,
		});
		setBrowser(browser);
		const page = await browser.newPage();



		// 2. Navegar a prospectos
		await page.goto(PROSPECTOS_URL, { waitUntil: 'networkidle0' });
		let prospectosCambiados = contador;

		console.log(`🚀 Iniciando automatización para ${cantidad} prospectos...`,horaActual());

		// 3. Bucle principal
		while (prospectosCambiados < cantidad) {
			// Recarga silenciosa
			await page.reload({ waitUntil: 'networkidle0' });

			const tablaLeads = await page.$('table[aria-label="Antioquia - PYF"]');
			if (!tablaLeads) {
				await new Promise(resolve => setTimeout(resolve, 5000));
				continue;
			}

			const leads = await page.$$('table tbody tr');
			let procesandoLead = false;

			for (const lead of leads) {
				try {
					// 3.1 Validar estado (silencioso)
					const estado = await lead.$eval(
						'td[data-label="Estado de prospecto"] span',
						el => el.textContent.trim()
					).catch(() => '');

					if (estado === 'Abierto') continue;

					// 3.2 Procesar nuevo lead (aquí activamos los logs)
					procesandoLead = true;
					console.log(`\n🔍 [${horaActual()}] Analizando nuevo lead (${prospectosCambiados + 1}/${cantidad})...`);

					// Abrir lead
					const nombreLead = await lead.$('a.slds-truncate[href^="/lightning/r/"]');
					if (!nombreLead) continue;

					await Promise.all([
						nombreLead.click(),
						page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => { })
					]);

					// 3.3 Validar botón cambio propietario (versión robusta)
					const buttonChange = await page.waitForSelector('button[name="ChangeOwnerOne"]', { timeout: 3000 }).catch(() => null);

					if (!buttonChange) {
						console.log(`⚠️ [${horatual}] Botón no encontrado. Saltando lead...`);
						socket.emit('error-automatizacion', {
							message: 'Botón no encontrado',
							etapa: 'validacion-boton'
						});
						continue;
					}

					// 3.4 Validar solución
					const solucionTexto = await page.$eval(
						'records-highlights-details-item p[title="Solución"] + p force-lookup a span',
						el => el.textContent.trim()
					).catch(() => '');

					if (!SOLUCIONES_VALIDAS.includes(solucionTexto)) {
						console.log(`❌ [${horaActual()}] Solución no válida: ${solucionTexto}`);
						socket.emit('error-automatizacion', {
							message: `Solución no válida: ${solucionTexto}`,
							etapa: 'validacion-solucion'
						});
						continue;
					}

					// 3.5 Cambio de propietario (versión robusta)
					console.log(`🔄 [${horaActual()}] Cambiando propietario...`);
					await buttonChange.click().catch(() => null);

					const modal = await page.waitForSelector('div[role="dialog"]', { timeout: 5000 }).catch(() => null);
					if (modal) {
						// Paso 1: Buscar usuario
						const inputChange = await page.waitForSelector('input[title="Buscar Usuarios"]').catch(() => null);
						await inputChange?.click();
						await inputChange?.type('Diego Ignacio Alvarez Franco', { delay: 100 });

						// Paso 2: Seleccionar usuario
						const diego = await page.waitForSelector('div[title="Diego Ignacio Alvarez Franco"]').catch(() => null);
						await diego?.click();

						// Paso 3: Confirmar
						const enviar = await page.waitForSelector('button[title="Enviar"]').catch(() => null);
						await enviar?.click();

						// Verificación de errores
						await page.waitForTimeout(2000);
						const modalError = await page.$('div[class="modalError"]');

						if (modalError) {
							const errorMsg = await page.$eval('.changeOwnerErrorMessage', el => el.textContent?.trim()).catch(() => 'Error desconocido');
							console.log(`❌ [${horaActual()}] Error en cambio: ${errorMsg}`);
							socket.emit('error-automatizacion', {
								message: errorMsg,
								etapa: 'cambio-propietario'
							});
						} else {
							// Éxito
							prospectosCambiados++;
							console.log(`✅ [${horaActual()}] Cambio exitoso! Total: ${prospectosCambiados}`);
							socket.emit('update-leads', { count: prospectosCambiados });
						}
					} else {
						console.log(`⚠️ [${horaActual()}] Modal no apareció`);
						socket.emit('error-automatizacion', {
							message: 'Modal no apareció',
							etapa: 'cambio-propietario'
						});
					}

				} catch (error) {
					console.error(`⚠️ [${horaActual()}] Error: ${error.message}`);
					socket.emit('error-automatizacion', error);
				} finally {
					await page.goto(PROSPECTOS_URL, { waitUntil: 'networkidle0' });
				}

				if (prospectosCambiados >= cantidad) break;
			}

			// Espera silenciosa si no se procesaron leads
			if (!procesandoLead) {
				await new Promise(resolve => setTimeout(resolve, 5000));
			}
		}

		// Actualización final
		config.contador = prospectosCambiados;
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

		console.log(`\n🎉 [${horaActual()}] Automatización completada! Total prospectos: ${prospectosCambiados}`);
		socket.emit('automatizacion-detenida');

	} catch (error) {
		console.error(`\n❌ [${horaActual()}] Error crítico:`, error.message);
		socket.emit('error-automatizacion', {
			message: error.message,
			etapa: error.etapa || 'general'
		});
	} finally {
		if (browser) await browser.close();
	}
}