// import puppeteer from 'puppeteer';
// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const configPath = path.join(__dirname, '../config/config.json');

// export async function automatizar(socket) {
// 	try {
// 		const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
// 		const { email, passwordHash } = config;

// 		if (!email || !passwordHash) {
// 			throw new Error('Email o contraseña no están configurados');
// 		}

// 		const browser = await puppeteer.launch({ headless: false });
// 		const page = await browser.newPage();
// 		const timeout = 5000;
// 		page.setDefaultTimeout(timeout);

// 		await page.setViewport({ width: 761, height: 599 });

// 		await page.goto('https://sura.my.salesforce.com/?ec=302&startURL=%2F00QRO00000K1XUg');

// 		await page.waitForSelector('#username', { timeout });
// 		await page.type('#username', email);

// 		await page.waitForSelector('#password', { timeout });
// 		await page.type('#password', passwordHash);

// 		await Promise.all([
// 			page.waitForNavigation(),
// 			page.click('#Login')
// 		]);

// 		console.log("🔐 Esperando verificación en dos pasos...");
// 		await new Promise(resolve => setTimeout(resolve, 32000));

// 		// Verificar si sigue en pantalla de verificación 2FA
// 		const estaEnVerificacion = await page.$('input[value="Verificar"][title="Verificar"]');
// 		const estaEnHome = await page.$('div.oneAppNavContainer');

// 		if (estaEnVerificacion) {
// 			console.log('❌ Falló la autenticación en dos pasos');
// 			socket.emit('login-fallido', 'Autenticación en dos pasos no completada');
// 			await browser.close();
// 			return;
// 		}

// 		if (!estaEnHome) {
// 			console.log('❌ No se detectó acceso al home, login posiblemente fallido');
// 			socket.emit('login-fallido', 'No se detectó acceso al home');
// 			await browser.close();
// 			return;
// 		}

// 		socket.emit('login-exitoso');
// 		console.log('✅ Login exitoso');

// 	} catch (error) {
// 		console.error('❌ Error en automatización (login):', error.message);
// 		socket.emit('login-fallido', error.message);
// 	}
// }


import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../config/config.json');

export async function automatizar(socket) {
    try {
        // Leer configuración
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        let { email, passwordHash, cantidad, contador } = config;

        if (!email || !passwordHash) {
            console.log("❌ Credenciales no configuradas correctamente");
            socket.emit('login-fallido', 'Credenciales incorrectas');
            return; // Detener la automatización
        }

        // Verificar que la cantidad de prospectos sea válida
        if (!cantidad || cantidad <= 0) {
            console.log("❌ Cantidad de prospectos no configurada correctamente");
            socket.emit('login-fallido', 'Cantidad de prospectos no válida');
            return; // Detener la automatización
        }

        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();
        const timeout = 10000;  // Aumentamos el timeout a 10 segundos
        page.setDefaultTimeout(timeout);

        // Configuramos el tamaño del viewport
        await page.setViewport({ width: 1440, height: 900 });

        // Ir al login de Salesforce
        await page.goto('https://sura.my.salesforce.com/?ec=302&startURL=%2F00QRO00000K1XUg');

        await page.waitForSelector('#username', { timeout });
        await page.type('#username', email);

        await page.waitForSelector('#password', { timeout });
        await page.type('#password', passwordHash);

        await Promise.all([
            page.waitForNavigation(),
            page.click('#Login')
        ]);

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
                    // Verificar si el botón de "Cambiar propietario" está presente
                    const buttonChange = await lead.$('button[name="ChangeOwnerOne"]');
                    if (buttonChange) {
                        console.log('✅ Cambio de propietario disponible. Cambiando propietario...');

                        // Hacer clic en el botón de cambio de propietario
                        await buttonChange.click();

                        // Esperar el modal
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
                    } else {
                        console.log('❌ No hay botón de cambio de propietario para este lead.');
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
