const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
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
    db.run(`CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, telefono TEXT, direccion TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS stock (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT UNIQUE, llenas INTEGER, vacias INTEGER, precio REAL)`);
    db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('10kg', 0, 0, 0)");
    db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('15kg', 0, 0, 0)");
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER, tipo TEXT, cantidad INTEGER, total REAL, estado TEXT DEFAULT 'Pendiente', FOREIGN KEY(cliente_id) REFERENCES clientes(id))`);
});

// APIs Clientes y Stock
app.get('/api/clientes', (req, res) => db.all("SELECT * FROM clientes", [], (err, rows) => res.json(rows || [])));
app.post('/api/clientes', (req, res) => {
    const { nombre, telefono, direccion } = req.body;
    db.run("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)", [nombre, telefono, direccion], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

app.put('/api/clientes/:id', (req, res) => {
    const { nombre, telefono, direccion } = req.body;
    db.run("UPDATE clientes SET nombre = ?, telefono = ?, direccion = ? WHERE id = ?", 
        [nombre, telefono, direccion, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Cliente actualizado" });
    });
});

app.delete('/api/clientes/:id', (req, res) => db.run("DELETE FROM clientes WHERE id = ?", [req.params.id], () => res.json({ mensaje: "Borrado" })));

app.get('/api/stock', (req, res) => db.all("SELECT * FROM stock", [], (err, rows) => res.json(rows || [])));
app.put('/api/stock/:tipo', (req, res) => {
    const { llenas, vacias, precio } = req.body;
    db.run("UPDATE stock SET llenas = ?, vacias = ?, precio = ? WHERE tipo = ?", [llenas, vacias, precio, req.params.tipo], () => res.json({ mensaje: "Actualizado" }));
});

// APIs Pedidos
app.get('/api/pedidos', (req, res) => {
    const sql = `SELECT pedidos.*, clientes.nombre as cliente_nombre, clientes.telefono as cliente_telefono FROM pedidos JOIN clientes ON pedidos.cliente_id = clientes.id ORDER BY pedidos.id DESC`;
    db.all(sql, [], (err, rows) => res.json(rows || []));
});
app.post('/api/pedidos', (req, res) => {
    const { cliente_id, tipo, cantidad } = req.body;
    db.get("SELECT precio FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
        if (!stock) return res.status(400).json({ error: "Stock no encontrado" });
        const total = stock.precio * cantidad;
        db.run("INSERT INTO pedidos (cliente_id, tipo, cantidad, total, estado) VALUES (?, ?, ?, ?, 'Pendiente')", [cliente_id, tipo, cantidad, total], function(err) {
            res.json({ id: this.lastID });
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
app.put('/api/pedidos/:id/estado', (req, res) => db.run("UPDATE pedidos SET estado = ? WHERE id = ?", [req.body.estado, req.params.id], () => res.json({ mensaje: "Ok" })));
app.delete('/api/pedidos/:id', (req, res) => db.run("DELETE FROM pedidos WHERE id = ?", [req.params.id], () => res.json({ mensaje: "Borrado" })));

// --- WHATSAPP & QR ---
let qrCodeActual = "";
let estadoWhatsApp = "Desconectado";
let sockGlobal = null;

app.get('/api/whatsapp/qr', (req, res) => res.json({ estado: estadoWhatsApp, qr: qrCodeActual }));

// Botón para reiniciar/desvincular WhatsApp
app.post('/api/whatsapp/reiniciar', async (req, res) => {
    try {
        if (sockGlobal) {
            await sockGlobal.logout().catch(() => {});
            sockGlobal.end(undefined);
        }
        if (fs.existsSync('./auth_info_baileys')) {
            fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
        }
        estadoWhatsApp = "Desconectado";
        qrCodeActual = "";
        iniciarWhatsApp();
        res.json({ mensaje: "WhatsApp reiniciado" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

async function iniciarWhatsApp() {
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
            if (connection === 'close') {
                estadoWhatsApp = "Desconectado";
                qrCodeActual = "";
                const code = lastDisconnect.error?.output?.statusCode;
                if (code !== DisconnectReason.loggedOut) {
                    iniciarWhatsApp();
                }
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
            const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase();

            console.log(`📩 Mensaje recibido -> ID/Tel: [${idLimpio}] | Texto: "${texto}"`);

            // Buscamos si el número existe en la base de datos (comparando los últimos 8 u 10 dígitos para evitar problemas de características o prefijos como el 9)
            const query = `SELECT id, nombre, telefono FROM clientes WHERE telefono LIKE ? OR ? LIKE '%' || telefono || '%'`;
            
            db.get(query, [`%${idLimpio}%`, idLimpio], (err, cliente) => {
                if (cliente) {
                    console.log(`✅ ¡Cliente reconocido! Asociado a: ${cliente.nombre}`);
                    
                    // Opcional: Si el teléfono guardado era corto y ahora entró el LID completo, 
                    // podemos actualizar el registro para que guarde este ID definitivo y nunca más falle.
                    if (cliente.telefono.length < idLimpio.length) {
                        db.run("UPDATE clientes SET telefono = ? WHERE id = ?", [idLimpio, cliente.id]);
                    }

                    procesarPedidoCliente(cliente, texto);
                } else {
                    console.log(`⚠️ El número [${idLimpio}] no coincide con ningún cliente registrado manualmente.`);
                    console.log(`💡 Sugerencia: Registra este número (${idLimpio}) en la sección Clientes de tu web.`);
                }
            });
        });

        function procesarPedidoCliente(cliente, texto) {
            let tipo = texto.includes("15") ? "15kg" : "10kg";
            let cantidad = 1;
            const match = texto.match(/\d+/);
            if (match && parseInt(match[0]) < 10) cantidad = parseInt(match[0]);

            db.get("SELECT precio FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
                if (stock) {
                    const total = stock.precio * cantidad;
                    db.run("INSERT INTO pedidos (cliente_id, tipo, cantidad, total, estado) VALUES (?, ?, ?, ?, 'Pendiente')", [cliente.id, tipo, cantidad, total], function(err) {
                        if (!err) console.log(`🚀 ¡Pedido #${this.lastID} creado automáticamente para ${cliente.nombre}!`);
                    });
                }
            });
        }

        // Función auxiliar para procesar y guardar el pedido
        function procesarPedidoCliente(cliente, texto) {
            console.log(`✅ Cliente asociado: ${cliente.nombre}`);
            let tipo = texto.includes("15") ? "15kg" : "10kg";
            let cantidad = 1;
            const match = texto.match(/\d+/);
            if (match && parseInt(match[0]) < 10) cantidad = parseInt(match[0]);

            db.get("SELECT precio FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
                if (stock) {
                    const total = stock.precio * cantidad;
                    db.run("INSERT INTO pedidos (cliente_id, tipo, cantidad, total, estado) VALUES (?, ?, ?, ?, 'Pendiente')", [cliente.id, tipo, cantidad, total], function(err) {
                        if (!err) console.log(`🚀 ¡Pedido #${this.lastID} creado automáticamente para ${cliente.nombre} (${tipo} x${cantidad})!`);
                    });
                } else {
                    console.log(`❌ No se encontró precio para el tipo de garrafa: ${tipo}`);
                }
            });
        }
       
    } catch (e) {
        console.error("Error WhatsApp:", e);
    }
}
iniciarWhatsApp();

app.get('/', (req, res) => res.redirect('/pedidos.html'));
app.listen(PORT, () => console.log(`🚀 Servidor activo en http://localhost:${PORT}`));