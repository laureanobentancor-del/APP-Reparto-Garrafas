const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');

let qrCodeActual = "";
let estadoWhatsApp = "Desconectado";
let sockGlobal = null;
let chatsNuevos = {}; 

// Función para inicializar WhatsApp recibiendo la base de datos como dependencia
function iniciarWhatsApp(db) {
    async function conectar() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
            const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });
            sockGlobal = sock;

            sock.ev.on('creds.update', saveCreds);
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) { 
                    qrCodeActual = await QRCode.toDataURL(qr); 
                    estadoWhatsApp = "Esperando escaneo"; 
                }
                if (connection === 'close' && lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                    conectar();
                } else if (connection === 'open') { 
                    estadoWhatsApp = "Conectado"; 
                    qrCodeActual = ""; 
                }
            });

            sock.ev.on('messages.upsert', async (m) => {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) return;

                let remoteJid = msg.key.remoteJid;
                if (remoteJid.includes('@g.us')) return; 
                
                let idLimpio = remoteJid.split('@')[0].replace(/\D/g, '');
                const textoOriginal = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                const texto = textoOriginal.toLowerCase();

                db.get("SELECT id, nombre, telefono FROM clientes WHERE telefono LIKE ?", [`%${idLimpio}%`], async (err, cliente) => {
                    if (cliente) {
                        const esPedido = /(garrafa|10|15|30|45|kilo|kg|pedido)/i.test(texto);
                        if (esPedido) {
                            const especifica10 = texto.includes("10");
                            const especifica15 = texto.includes("15");
                            const especifica30 = texto.includes("30");
                            const especifica45 = texto.includes("45");

                            if (!especifica10 && !especifica15 && !especifica30 && !especifica45) {
                                await sockGlobal.sendMessage(remoteJid, { 
                                    text: `¡Hola ${cliente.nombre}! 👋 Para avanzar con tu pedido, indícanos por favor qué tipo de garrafa necesitas:\n\n1️⃣ *Garrafa de 10kg*\n2️⃣ *Garrafa de 15kg*\n3️⃣ *Garrafa de 30kg*\n4️⃣ *Garrafa de 45kg*\n\n(Responde con el tamaño deseado).` 
                                });
                                return;
                            }
                            procesarPedidoCliente(db, cliente, texto, remoteJid);
                        }
                    } else {
                        if (!chatsNuevos[idLimpio]) {
                            chatsNuevos[idLimpio] = { paso: 1, pedidoInicial: texto, celular: "" };
                            await sockGlobal.sendMessage(remoteJid, { text: "¡Hola! 👋 Veo que es la primera vez que nos escribes desde este número.\n\nPara tomar tu pedido, ¿me podrías decir tu *número de celular* (con código de área)?" });
                        } 
                        else if (chatsNuevos[idLimpio].paso === 1) {
                            const celularIngresado = textoOriginal.replace(/\D/g, '');
                            if (celularIngresado.length < 6) return await sockGlobal.sendMessage(remoteJid, { text: "Por favor, ingresa solo números." });
                            
                            chatsNuevos[idLimpio].celular = celularIngresado;
                            const ultimosDigitos = celularIngresado.slice(-7);
                            
                            db.get("SELECT * FROM clientes WHERE telefono LIKE ?", [`%${ultimosDigitos}%`], async (err, clienteExistente) => {
                                if (clienteExistente) {
                                    const nuevoTelefono = clienteExistente.telefono + "," + idLimpio;
                                    db.run("UPDATE clientes SET telefono = ? WHERE id = ?", [nuevoTelefono, clienteExistente.id], () => {
                                        sockGlobal.sendMessage(remoteJid, { text: `¡Hola de nuevo ${clienteExistente.nombre}! Encontramos tus datos. ✅` });
                                        procesarPedidoCliente(db, clienteExistente, chatsNuevos[idLimpio].pedidoInicial, remoteJid);
                                        delete chatsNuevos[idLimpio];
                                    });
                                } else {
                                    chatsNuevos[idLimpio].paso = 2;
                                    await sockGlobal.sendMessage(remoteJid, { text: "¡Gracias! 😊 Ahora dime tu *Nombre y Apellido*:" });
                                }
                            });
                        }
                        else if (chatsNuevos[idLimpio].paso === 2) {
                            chatsNuevos[idLimpio].nombre = textoOriginal;
                            chatsNuevos[idLimpio].paso = 3;
                            await sockGlobal.sendMessage(remoteJid, { text: `Perfecto ${textoOriginal}. Por último, dime tu *Dirección exacta* (calle, número, barrio):` });
                        } 
                        else if (chatsNuevos[idLimpio].paso === 3) {
                            const { nombre, celular, pedidoInicial } = chatsNuevos[idLimpio];
                            const direccion = textoOriginal;
                            const telefonoGuardado = celular + "," + idLimpio; 
                            
                            db.run("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)", [nombre, telefonoGuardado, direccion], function(err) {
                                if (!err) {
                                    const nuevoCliente = { id: this.lastID, nombre: nombre, telefono: telefonoGuardado };
                                    sockGlobal.sendMessage(remoteJid, { text: "¡Listo! Ya registré tus datos en el sistema. ✅" });
                                    procesarPedidoCliente(db, nuevoCliente, pedidoInicial, remoteJid);
                                    delete chatsNuevos[idLimpio];
                                }
                            });
                        }
                    }
                });
            });
        } catch (e) {
            console.error("Error WhatsApp:", e);
        }
    }

    conectar();
}

function procesarPedidoCliente(db, cliente, texto, jid) {
    let tipo = "10kg"; 
    if (texto.includes("45")) tipo = "45kg";
    else if (texto.includes("30")) tipo = "30kg";
    else if (texto.includes("15")) tipo = "15kg";

    let cantidad = 1;
    const match = texto.match(/\d+/);
    if (match) {
        const numeroDetectado = parseInt(match[0]);
        if (numeroDetectado > 0 && numeroDetectado < 10) cantidad = numeroDetectado;
    }

    db.get("SELECT precio, llenas, vacias FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
        if (stock) {
            const llenasActuales = parseInt(stock.llenas) || 0;
            const vaciasActuales = parseInt(stock.vacias) || 0;
            
            if (llenasActuales < cantidad) {
                if (sockGlobal && jid) {
                    sockGlobal.sendMessage(jid, { text: `Hola \({cliente.nombre}, recibimos tu pedido pero lamentablemente no tenemos stock suficiente de garrafas de\){tipo} (Disponibles: ${llenasActuales}).` });
                }
                return;
            }

            const total = (parseFloat(stock.precio) || 0) * cantidad;
            db.serialize(() => {
                db.run(`INSERT INTO pedidos (cliente_id, tipo, cantidad, total, estado, forma_pago, fecha) 
                        VALUES (?, ?, ?, ?, 'Pendiente', 'Efectivo', DATETIME('now', 'localtime'))`, 
                        [cliente.id, tipo, cantidad, total], function(err) {
                    if (!err) {
                        const nuevasLlenas = llenasActuales - cantidad;
                        const nuevasVacias = vaciasActuales + cantidad;
                        db.run("UPDATE stock SET llenas = ?, vacias = ? WHERE tipo = ?", [nuevasLlenas, nuevasVacias, tipo], () => {
                            if (sockGlobal && jid) {
                                sockGlobal.sendMessage(jid, { 
                                    text: `📝 *TICKET DE PEDIDO*\n\nTomamos tu pedido exitosamente:\n*\({cantidad}x Garrafa(s) de\){tipo}*\n\n💰 Total a pagar: $${total}\n\n¡En breve sale el repartidor hacia tu domicilio! 🚚💨` 
                                });
                            }
                        });
                    }
                });
            });
        }
    });
}

// Funciones expuestas para usar en el servidor web (obtener QR, reiniciar sesión)
function getEstadoWhatsApp() { return estadoWhatsApp; }
function getQrCodeActual() { return qrCodeActual; }
async function reiniciarWhatsApp(dbInstance) {
    if (sockGlobal) { 
        await sockGlobal.logout().catch(() => {}); 
        sockGlobal.end(undefined); 
    }
    if (fs.existsSync('./auth_info_baileys')) {
        fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
    }
    estadoWhatsApp = "Desconectado"; 
    qrCodeActual = ""; 
    iniciarWhatsApp(dbInstance);
}

module.exports = {
    iniciarWhatsApp,
    getEstadoWhatsApp,
    getQrCodeActual,
    reiniciarWhatsApp
};

