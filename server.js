const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json()); 
app.use(express.static(__dirname));

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error("Error BD:", err.message);
    else console.log("✅ Conectado a SQLite correctamente.");
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE,
        password TEXT,
        rol TEXT,
        bloqueado INTEGER DEFAULT 0
    )`);

    db.get(`SELECT * FROM usuarios WHERE usuario = 'admin'`, (err, row) => {
        if (!row) {
            db.run(`INSERT INTO usuarios (usuario, password, rol) VALUES ('admin', '1234', 'admin')`);
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, telefono TEXT, direccion TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS stock (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT UNIQUE, llenas INTEGER, vacias INTEGER, precio REAL)`);
    
    db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('10kg', 0, 0, 0)");
    db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('15kg', 0, 0, 0)");
    db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('30kg', 0, 0, 0)");
    db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('45kg', 0, 0, 0)");
    
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        cliente_id INTEGER, 
        tipo TEXT, 
        cantidad INTEGER, 
        total REAL, 
        estado TEXT DEFAULT 'Pendiente', 
        forma_pago TEXT DEFAULT 'Efectivo', 
        fecha TEXT,
        FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    )`);

    db.run(`ALTER TABLE pedidos ADD COLUMN forma_pago TEXT DEFAULT 'Efectivo'`, (err) => {});
    db.run(`ALTER TABLE pedidos ADD COLUMN fecha TEXT`, (err) => {});
});

// --- RUTAS API DE USUARIOS Y AUTENTICACIÓN ---
app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    db.get(`SELECT * FROM usuarios WHERE usuario = ? AND password = ?`, [usuario, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        if (user.bloqueado === 1) return res.status(403).json({ error: "Este usuario se encuentra bloqueado." });
        res.json({ id: user.id, usuario: user.usuario, rol: user.rol });
    });
});

app.post('/api/usuarios', (req, res) => {
    const { usuario, password, rol } = req.body;
    db.run(`INSERT INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)`, [usuario, password, rol || 'repartidor'], function(err) {
        if (err) return res.status(500).json({ error: "El usuario ya existe o hubo un error" });
        res.json({ id: this.lastID, mensaje: "Usuario creado con éxito" });
    });
});

app.get('/api/usuarios', (req, res) => {
    db.all(`SELECT id, usuario, rol, bloqueado FROM usuarios`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.put('/api/usuarios/:id/bloquear', (req, res) => {
    const { bloqueado } = req.body;
    db.run(`UPDATE usuarios SET bloqueado = ? WHERE id = ?`, [bloqueado, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Estado de bloqueo actualizado" });
    });
});

app.delete('/api/usuarios/:id', (req, res) => {
    db.run(`DELETE FROM usuarios WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Usuario borrado con éxito" });
    });
});

// --- RUTAS API: CLIENTES ---
app.get('/api/clientes', (req, res) => {
    db.all("SELECT * FROM clientes", [], (err, rows) => {
        if (rows) rows.forEach(r => { if(r.telefono) r.telefono = r.telefono.split(',')[0]; });
        res.json(rows || []);
    });
});

app.post('/api/clientes', (req, res) => {
    const { nombre, telefono, direccion } = req.body;
    db.run("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)", [nombre, telefono, direccion], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

app.put('/api/clientes/:id', (req, res) => {
    const { nombre, telefono, direccion } = req.body;
    db.get("SELECT telefono FROM clientes WHERE id = ?", [req.params.id], (err, row) => {
        let telefonoFinal = telefono;
        if (row && row.telefono && row.telefono.includes(',')) {
            const partes = row.telefono.split(',');
            partes[0] = telefono; 
            telefonoFinal = partes.join(',');
        }
        db.run("UPDATE clientes SET nombre = ?, telefono = ?, direccion = ? WHERE id = ?", 
            [nombre, telefonoFinal, direccion, req.params.id], () => res.json({ mensaje: "Actualizado" })
        );
    });
});

app.get('/api/clientes/:id/pedidos', (req, res) => {
    const clienteId = req.params.id;
    const sql = `SELECT pedidos.*, clientes.nombre as cliente_nombre FROM pedidos JOIN clientes ON pedidos.cliente_id = clientes.id WHERE clientes.id = ? ORDER BY pedidos.id DESC`;
    db.all(sql, [clienteId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.delete('/api/clientes/:id', (req, res) => db.run("DELETE FROM clientes WHERE id = ?", [req.params.id], () => res.json({ mensaje: "Borrado" })));

// --- RUTAS API: STOCK ---
app.get('/api/stock', (req, res) => db.all("SELECT * FROM stock", [], (err, rows) => res.json(rows || [])));
app.put('/api/stock/:tipo', (req, res) => {
    const { llenas, vacias, precio } = req.body;
    db.run("UPDATE stock SET llenas = ?, vacias = ?, precio = ? WHERE tipo = ?", [llenas, vacias, precio, req.params.tipo], () => res.json({ mensaje: "Actualizado" }));
});

// --- RUTAS API: PEDIDOS ---

app.get('/api/pedidos', (req, res) => {
    const sql = `SELECT pedidos.*, 
                 COALESCE(pedidos.forma_pago, 'Efectivo') as forma_pago, 
                 clientes.nombre as cliente_nombre, 
                 clientes.telefono as cliente_telefono,
                 clientes.direccion as direccion
                 FROM pedidos 
                 JOIN clientes ON pedidos.cliente_id = clientes.id 
                 ORDER BY pedidos.id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows) rows.forEach(r => { if(r.cliente_telefono) r.cliente_telefono = r.cliente_telefono.split(',')[0]; });
        res.json(rows || []);
    });
});

app.put('/api/pedidos/:id/pago', (req, res) => {
    const { forma_pago } = req.body;
    db.run("UPDATE pedidos SET forma_pago = ? WHERE id = ?", [forma_pago, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Forma de pago actualizada con éxito" });
    });
});

app.get('/api/pedidos/hoy', (req, res) => {
    const sql = `SELECT pedidos.*, 
                 COALESCE(pedidos.forma_pago, 'Efectivo') as forma_pago, 
                 clientes.nombre as cliente_nombre, 
                 clientes.telefono as cliente_telefono,
                 clientes.direccion as direccion
                 FROM pedidos 
                 JOIN clientes ON pedidos.cliente_id = clientes.id 
                 WHERE DATE(pedidos.fecha) = DATE('now', 'localtime') 
                 ORDER BY pedidos.id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows) rows.forEach(r => { if(r.cliente_telefono) r.cliente_telefono = r.cliente_telefono.split(',')[0]; });
        res.json(rows || []);
    });
});

app.get('/api/pedidos/filtrar', (req, res) => {
    const { desde, hasta } = req.query;
    const sql = `SELECT pedidos.*, 
                 COALESCE(pedidos.forma_pago, 'Efectivo') as forma_pago, 
                 clientes.nombre as cliente_nombre, 
                 clientes.telefono as cliente_telefono,
                 clientes.direccion as direccion
                 FROM pedidos 
                 JOIN clientes ON pedidos.cliente_id = clientes.id 
                 WHERE DATE(pedidos.fecha) BETWEEN ? AND ? 
                 ORDER BY pedidos.id DESC`;
    db.all(sql, [desde, hasta], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows) rows.forEach(r => { if(r.cliente_telefono) r.cliente_telefono = r.cliente_telefono.split(',')[0]; });
        res.json(rows || []);
    });
});

app.post('/api/pedidos', (req, res) => {
    const { cliente_id, tipo, forma_pago } = req.body;
    const cantidad = parseInt(req.body.cantidad) || 1; 

    db.get("SELECT precio, llenas, vacias FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
        if (!stock) return res.status(400).json({ error: "Stock no encontrado" });
        
        const llenasActuales = parseInt(stock.llenas) || 0;
        const vaciasActuales = parseInt(stock.vacias) || 0;
        const precio = parseFloat(stock.precio) || 0;

        if (llenasActuales < cantidad) {
            return res.status(400).json({ error: `No hay suficiente stock de garrafas llenas de ${tipo}. Disponibles: ${llenasActuales}` });
        }

        const total = precio * cantidad;
        const pagoFinal = forma_pago || 'Efectivo';
        
        db.serialize(() => {
            db.run(`INSERT INTO pedidos (cliente_id, tipo, cantidad, total, estado, forma_pago, fecha) 
                    VALUES (?, ?, ?, ?, 'Pendiente', ?, DATETIME('now', 'localtime'))`, 
                    [cliente_id, tipo, cantidad, total, pagoFinal], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                const pedidoId = this.lastID;

                const nuevasLlenas = llenasActuales - cantidad;
                const nuevasVacias = vaciasActuales + cantidad;

                db.run("UPDATE stock SET llenas = ?, vacias = ? WHERE tipo = ?", [nuevasLlenas, nuevasVacias, tipo], () => {
                    res.json({ id: pedidoId, mensaje: "Pedido creado y stock actualizado" });
                });
            });
        });
    });
});

app.put('/api/pedidos/:id', (req, res) => {
    const { tipo, cantidad } = req.body;
    db.get("SELECT precio FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
        const total = stock.precio * cantidad;
        db.run("UPDATE pedidos SET tipo = ?, cantidad = ?, total = ? WHERE id = ?", [tipo, cantidad, total, req.params.id], () => res.json({ mensaje: "Editado" }));
    });
});

app.put('/api/pedidos/:id/estado', (req, res) => {
    db.run("UPDATE pedidos SET estado = ? WHERE id = ?", [req.body.estado, req.params.id], () => res.json({ mensaje: "Ok" }));
});

app.delete('/api/pedidos/:id', (req, res) => {
    db.run("DELETE FROM pedidos WHERE id = ?", [req.params.id], () => res.json({ mensaje: "Borrado" }));
});

// --- WHATSAPP & QR ---
let qrCodeActual = "";
let estadoWhatsApp = "Desconectado";
let sockGlobal = null;
let chatsNuevos = {}; 

app.get('/api/whatsapp/qr', (req, res) => res.json({ estado: estadoWhatsApp, qr: qrCodeActual }));
app.post('/api/whatsapp/reiniciar', async (req, res) => {
    if (sockGlobal) { await sockGlobal.logout().catch(() => {}); sockGlobal.end(undefined); }
    const fs = require('fs');
    if (fs.existsSync('./auth_info_baileys')) fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
    estadoWhatsApp = "Desconectado"; qrCodeActual = ""; iniciarWhatsApp(); res.json({ mensaje: "Ok" });
});

async function iniciarWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });
        sockGlobal = sock;

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) { qrCodeActual = await QRCode.toDataURL(qr); estadoWhatsApp = "Esperando escaneo"; }
            if (connection === 'close' && lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) iniciarWhatsApp();
            else if (connection === 'open') { estadoWhatsApp = "Conectado"; qrCodeActual = ""; }
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
                        procesarPedidoCliente(cliente, texto, remoteJid);
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
                                    procesarPedidoCliente(clienteExistente, chatsNuevos[idLimpio].pedidoInicial, remoteJid);
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
                                procesarPedidoCliente(nuevoCliente, pedidoInicial, remoteJid);
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

function procesarPedidoCliente(cliente, texto, jid) {
    let tipo = "10kg"; 
    if (texto.includes("45")) {
        tipo = "45kg";
    } else if (texto.includes("30")) {
        tipo = "30kg";
    } else if (texto.includes("15")) {
        tipo = "15kg";
    }

    let cantidad = 1;
    const match = texto.match(/\d+/);
    if (match) {
        const numeroDetectado = parseInt(match[0]);
        if (numeroDetectado > 0 && numeroDetectado < 10) {
            cantidad = numeroDetectado;
        }
    }

    db.get("SELECT precio, llenas, vacias FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
        if (stock) {
            const llenasActuales = parseInt(stock.llenas) || 0;
            const vaciasActuales = parseInt(stock.vacias) || 0;
            
            if (llenasActuales < cantidad) {
                if (sockGlobal && jid) {
                    sockGlobal.sendMessage(jid, { text: `Hola ${cliente.nombre}, recibimos tu pedido pero lamentablemente no tenemos stock suficiente de garrafas de ${tipo} (Disponibles: ${llenasActuales}).` });
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
                                    text: `📝 *TICKET DE PEDIDO*\n\nTomamos tu pedido exitosamente:\n*${cantidad}x Garrafa(s) de ${tipo}*\n\n💰 Total a pagar: $${total}\n\n¡En breve sale el repartidor hacia tu domicilio! 🚚💨` 
                                });
                            }
                        });
                    }
                });
            });
        }
    });
}

iniciarWhatsApp();

app.get('/', (req, res) => res.redirect('/pedidos.html'));
app.listen(PORT, () => console.log(`🚀 Servidor activo en http://localhost:${PORT}`));