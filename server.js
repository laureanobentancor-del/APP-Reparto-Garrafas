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

// --- BASE DE DATOS SQLITE ---
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error("Error BD:", err.message);
    else console.log("✅ Conectado a SQLite correctamente.");
});

// Inicializar Tablas (Clientes, Stock y Pedidos)
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        nombre TEXT, 
        telefono TEXT, 
        direccion TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        tipo TEXT UNIQUE, 
        llenas INTEGER, 
        vacias INTEGER, 
        precio REAL
    )`);
    
    db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('10kg', 0, 0, 0)");
    db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('15kg', 0, 0, 0)");

    db.run(`CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        cliente_id INTEGER, 
        tipo TEXT, 
        cantidad INTEGER, 
        total REAL, 
        estado TEXT DEFAULT 'Pendiente',
        FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    )`);
});

// --- RUTAS API: CLIENTES ---
app.get('/api/clientes', (req, res) => {
    db.all("SELECT * FROM clientes", [], (err, rows) => res.json(rows || []));
});
app.post('/api/clientes', (req, res) => {
    const { nombre, telefono, direccion } = req.body;
    db.run("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)", [nombre, telefono, direccion], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, mensaje: "Cliente guardado" });
    });
});
app.delete('/api/clientes/:id', (req, res) => {
    db.run("DELETE FROM clientes WHERE id = ?", [req.params.id], () => res.json({ mensaje: "Borrado" }));
});

// --- RUTAS API: STOCK ---
app.get('/api/stock', (req, res) => {
    db.all("SELECT * FROM stock", [], (err, rows) => res.json(rows || []));
});
app.put('/api/stock/:tipo', (req, res) => {
    const { llenas, vacias, precio } = req.body;
    db.run("UPDATE stock SET llenas = ?, vacias = ?, precio = ? WHERE tipo = ?", [llenas, vacias, precio, req.params.tipo], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Stock actualizado" });
    });
});

// --- RUTAS API: PEDIDOS ---
app.get('/api/pedidos', (req, res) => {
    const sql = `SELECT pedidos.*, clientes.nombre as cliente_nombre, clientes.telefono as cliente_telefono 
                 FROM pedidos JOIN clientes ON pedidos.cliente_id = clientes.id ORDER BY pedidos.id DESC`;
    db.all(sql, [], (err, rows) => res.json(rows || []));
});

app.post('/api/pedidos', (req, res) => {
    const { cliente_id, tipo, cantidad } = req.body;
    db.get("SELECT precio FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
        if (!stock) return res.status(400).json({ error: "Stock no encontrado" });
        const total = stock.precio * cantidad;
        db.run("INSERT INTO pedidos (cliente_id, tipo, cantidad, total, estado) VALUES (?, ?, ?, ?, 'Pendiente')", [cliente_id, tipo, cantidad, total], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, mensaje: "Pedido creado" });
        });
    });
});

app.put('/api/pedidos/:id', (req, res) => {
    const { tipo, cantidad } = req.body;
    db.get("SELECT precio FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
        if (!stock) return res.status(400).json({ error: "Stock no encontrado" });
        const total = stock.precio * cantidad;
        db.run("UPDATE pedidos SET tipo = ?, cantidad = ?, total = ? WHERE id = ?", [tipo, cantidad, total, req.params.id], () => res.json({ mensaje: "Editado" }));
    });
});

app.put('/api/pedidos/:id/estado', (req, res) => {
    db.run("UPDATE pedidos SET estado = ? WHERE id = ?", [req.body.estado, req.params.id], () => res.json({ mensaje: "Estado actualizado" }));
});

app.delete('/api/pedidos/:id', (req, res) => {
    db.run("DELETE FROM pedidos WHERE id = ?", [req.params.id], () => res.json({ mensaje: "Borrado" }));
});

// --- WHATSAPP Y QR ---
let qrCodeActual = "";
let estadoWhatsApp = "Desconectado";

app.get('/api/whatsapp/qr', (req, res) => {
    res.json({ estado: estadoWhatsApp, qr: qrCodeActual });
});

async function iniciarWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });

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
                if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) iniciarWhatsApp();
            } else if (connection === 'open') {
                estadoWhatsApp = "Conectado";
                qrCodeActual = "";
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const telefono = msg.key.remoteJid.replace('@s.whatsapp.net', '');
            const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase();

            db.get("SELECT id FROM clientes WHERE telefono LIKE ?", [`%${telefono}%`], (err, cliente) => {
                if (cliente) {
                    let tipo = texto.includes("15") ? "15kg" : "10kg";
                    let cantidad = 1;
                    const match = texto.match(/\d+/);
                    if (match && parseInt(match[0]) < 10) cantidad = parseInt(match[0]);

                    db.get("SELECT precio FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
                        if (stock) {
                            const total = stock.precio * cantidad;
                            db.run("INSERT INTO pedidos (cliente_id, tipo, cantidad, total, estado) VALUES (?, ?, ?, ?, 'Pendiente')", [cliente.id, tipo, cantidad, total]);
                        }
                    });
                }
            });
        });
    } catch (e) {
        console.error("Error WhatsApp:", e);
    }
}
iniciarWhatsApp();

app.get('/', (req, res) => res.redirect('/pedidos.html'));

app.listen(PORT, () => console.log(`🚀 Servidor activo en http://localhost:${PORT}`));