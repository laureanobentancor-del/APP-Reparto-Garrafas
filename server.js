const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const bcrypt = require('bcrypt'); // 👈 1. IMPORTAMOS BCRYPT ARRIBA DEL TODO

const app = express();
const PORT = 3000;
const saltRounds = 10;

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

    // ==========================================
    // DATOS DE PRUEBA (SEED) SI LA DB ESTÁ VACÍA
    // ==========================================
    db.get("SELECT COUNT(*) as count FROM clientes", (err, row) => {
        if (row && row.count === 0) {
            console.log("🌱 Insertando datos de muestra en la base de datos...");
            
            // 1. Insertar 10 clientes de prueba (sin la columna tipo)
            const clientesPrueba = [
                ['Juan Pérez', '3435112233', 'San Martín 234'],
                ['María Gómez', '3435998877', 'Belgrano 1230'],
                ['Carlos Alberto Ruiz', '3435445566', 'San Martin 238'],
                ['Laura Fernández', '3435332211', 'San Martín 340'],
                ['Pedro Ocampo', '3435411111', 'Concordia 1345'],
                ['Angie Bentancor', '3435528916', 'Nuevo barrio AGMER casa 11'],
                ['Esteban Quito', '3435778899', 'Av. pre Perón 235'],
                ['Griselda Villanueva', '3435408622', 'Nuevo barrio AGMER Casa 11'],
                ['Regino Bentancor', '3435415752', 'Diamante 141'],
                ['Federico Gonzales', '3435554476', 'San Martin 1390']
            ];
            
            clientesPrueba.forEach(c => {
                db.run(`INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)`, c);
            });

            // 2. Configurar stock inicial con precios y cantidades
            db.run(`UPDATE stock SET llenas = 20, vacias = 10, precio = 8500 WHERE tipo = '10kg'`);
            db.run(`UPDATE stock SET llenas = 15, vacias = 5, precio = 12000 WHERE tipo = '15kg'`);
            db.run(`UPDATE stock SET llenas = 8, vacias = 4, precio = 35000 WHERE tipo = '30kg'`);
            db.run(`UPDATE stock SET llenas = 5, vacias = 2, precio = 50000 WHERE tipo = '45kg'`);

            // 3. Insertar 10 pedidos con diferentes fechas, estados y canales
            const pedidosPrueba = [
                [1, '10kg', 1, 8500, 'Completado', 'Efectivo', 'deposito', '2026-09-10 10:33:23'],
                [2, '15kg', 1, 12000, 'Completado', 'Transferencia', 'deposito', '2026-09-11 18:48:41'],
                [3, '45kg', 1, 50000, 'Completado', 'Mercado Pago', 'comercios', '2026-09-14 09:13:28'],
                [4, '10kg', 2, 17000, 'Completado', 'Efectivo', 'deposito', '2026-09-15 11:15:00'],
                [5, '30kg', 1, 35000, 'Completado', 'Efectivo', 'reparto', '2026-09-16 14:20:00'],
                [6, '15kg', 3, 36000, 'Completado', 'Efectivo', 'deposito', '2026-09-17 10:12:34'],
                [7, '10kg', 3, 25500, 'Completado', 'Transferencia', 'comercios', '2026-09-18 16:30:00'],
                [8, '30kg', 2, 70000, 'Pendiente', 'Pendiente', 'reparto', '2026-09-20 12:00:00'],
                [9, '15kg', 2, 24000, 'Completado', 'Mercado Pago', 'reparto', '2026-09-21 11:50:44'],
                [10, '10kg', 2, 17000, 'Completado', 'Mercado Pago', 'deposito', '2026-09-22 08:08:30']
            ];

            pedidosPrueba.forEach(p => {
                db.run(`INSERT INTO pedidos (cliente_id, tipo, cantidad, total, estado, forma_pago, tipo_venta, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, p);
            });
            
            console.log("✅ ¡Datos de prueba insertados con éxito!");
        }
    });

    // Forzar la actualización o creación del admin con un hash seguro y válido
    const hashedPassword = bcrypt.hashSync('1234', 10);
    
    db.get(`SELECT * FROM usuarios WHERE usuario = 'admin'`, (err, row) => {
        if (!row) {
            // Si no existe, lo insertamos con su hash
            db.run(`INSERT INTO usuarios (usuario, password, rol) VALUES ('admin', ?, 'admin')`, [hashedPassword]);
        } else {
            // Si ya existe (aunque tuviera la clave vieja en texto plano), la actualizamos con el hash correcto
            db.run(`UPDATE usuarios SET password = ? WHERE usuario = 'admin'`, [hashedPassword]);
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
        tipo_venta TEXT DEFAULT 'deposito',
        fecha TEXT,
        FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    )`);
});
// ==========================================
// RUTAS API DE USUARIOS Y AUTENTICACIÓN
// ==========================================


app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    
    console.log("🔍 Intentando login - Usuario recibido:", usuario);
    console.log("🔍 Contraseña plana recibida:", password);

    db.get(`SELECT * FROM usuarios WHERE usuario = ?`, [usuario], (err, user) => {
        if (err) {
            console.log("❌ Error en BD:", err.message);
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            console.log("❌ Usuario no encontrado en la base de datos.");
            return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }
        if (user.bloqueado === 1) {
            console.log("❌ Usuario bloqueado.");
            return res.status(403).json({ error: "Este usuario se encuentra bloqueado." });
        }

        console.log("🔑 Hash guardado en la BD:", user.password);

        bcrypt.compare(password, user.password, (err, esValida) => {
            if (err) {
                console.log("❌ Error en bcrypt.compare:", err);
                return res.status(500).json({ error: "Error al validar la contraseña" });
            }
            if (!esValida) {
                console.log("❌ La contraseña NO coincide con el hash.");
                return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
            }

            console.log("✅ ¡Login exitoso!");
            res.json({ id: user.id, usuario: user.usuario, rol: user.rol });
        });
    });
});


/*app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    
    db.get(`SELECT * FROM usuarios WHERE usuario = ?`, [usuario], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        if (user.bloqueado === 1) return res.status(403).json({ error: "Este usuario se encuentra bloqueado." });

        bcrypt.compare(password, user.password, (err, esValida) => {
            if (err) return res.status(500).json({ error: "Error al validar la contraseña" });
            if (!esValida) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

            res.json({ id: user.id, usuario: user.usuario, rol: user.rol });
        });
    });
});
*/

app.post('/api/usuarios', (req, res) => {
    const { usuario, password, rol } = req.body;
    
    if (!password) {
        return res.status(400).json({ error: "La contraseña es obligatoria" });
    }

    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) return res.status(500).json({ error: "Error al encriptar la contraseña" });

        db.run(`INSERT INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)`, 
            [usuario, hash, rol || 'repartidor'], 
            function(err) {
                if (err) return res.status(500).json({ error: "El usuario ya existe o hubo un error" });
                res.json({ id: this.lastID, mensaje: "Usuario creado con éxito" });
            }
        );
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
    let { cliente_id, tipo, cantidad, forma_pago, tipo_venta } = req.body;
    cantidad = parseInt(req.body.cantidad) || 1; 

    db.get("SELECT precio, llenas, vacias FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
        if (!stock) return res.status(400).json({ error: "Stock no encontrado" });
        
        const llenasActuales = parseInt(stock.llenas) || 0;
        const vaciasActuales = parseInt(stock.vacias) || 0;
        const precio = parseFloat(stock.precio) || 0;

        if (llenasActuales < cantidad) {
            return res.status(400).json({ error: `No hay suficiente stock de garrafas llenas de \({tipo}. Disponibles:\){llenasActuales}` });
        }

        const total = precio * cantidad;
        const pagoFinal = forma_pago || 'Efectivo';
        const ventaFinal = tipo_venta || 'deposito';
        
        db.serialize(() => {
            db.run(`INSERT INTO pedidos (cliente_id, tipo, cantidad, total, estado, forma_pago, tipo_venta, fecha) 
                    VALUES (?, ?, ?, ?, 'Pendiente', ?, ?, DATETIME('now', 'localtime'))`, 
                    [cliente_id, tipo, cantidad, total, pagoFinal, ventaFinal], function(err) {
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

app.get('/', (req, res) => res.redirect('/pedidos.html'));
app.listen(PORT, () => console.log(`🚀 Servidor activo en http://localhost:${PORT}`));