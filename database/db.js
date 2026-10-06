const { createClient } = require('@libsql/client');
const bcrypt = require('bcrypt');

const dbUrl = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

const client = createClient({
    url: dbUrl,
    authToken: authToken,
});

const db = {
    all: async (sql, params = [], callback) => {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        try {
            const result = await client.execute({ sql, args: params });
            if (callback) callback(null, result.rows);
        } catch (err) {
            if (callback) callback(err, null);
            else throw err;
        }
    },
    get: async (sql, params = [], callback) => {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        try {
            const result = await client.execute({ sql, args: params });
            if (callback) callback(null, result.rows[0] || null);
        } catch (err) {
            if (callback) callback(err, null);
            else throw err;
        }
    },
    run: async function(sql, params = [], callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        try {
            const result = await client.execute({ sql, args: params });
            const context = {
                lastID: Number(result.lastInsertRowid) || 0,
                changes: result.rowsAffected || 0
            };
            if (callback) callback.call(context, null);
        } catch (err) {
            if (callback) callback(err, null);
            else throw err;
        }
    },
    serialize: (fn) => {
        if (fn) fn();
    }
};

async function inicializarBD() {
    try {
        await db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT UNIQUE,
            password TEXT,
            rol TEXT,
            bloqueado INTEGER DEFAULT 0
        )`);

        await db.run(`CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, telefono TEXT, direccion TEXT)`);
        await db.run(`CREATE TABLE IF NOT EXISTS stock (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT UNIQUE, llenas INTEGER, vacias INTEGER, precio REAL)`);

        await db.run(`CREATE TABLE IF NOT EXISTS trazabilidad (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            usuario TEXT,
            accion TEXT,
            detalles TEXT,
            fecha TEXT
        )`);

        await db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('10kg', 0, 0, 0)");
        await db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('15kg', 0, 0, 0)");
        await db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('30kg', 0, 0, 0)");
        await db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('45kg', 0, 0, 0)");

        await db.run(`CREATE TABLE IF NOT EXISTS pedidos (
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

        const clienteCount = await client.execute("SELECT COUNT(*) as count FROM clientes");
        if (clienteCount.rows[0].count === 0) {
            console.log("🌱 Insertando datos de muestra en la base de datos...");
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
            
            for (const c of clientesPrueba) {
                await db.run(`INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)`, c);
            }

            await db.run(`UPDATE stock SET llenas = 20, vacias = 10, precio = 8500 WHERE tipo = '10kg'`);
            await db.run(`UPDATE stock SET llenas = 15, vacias = 5, precio = 12000 WHERE tipo = '15kg'`);
            await db.run(`UPDATE stock SET llenas = 8, vacias = 4, precio = 35000 WHERE tipo = '30kg'`);
            await db.run(`UPDATE stock SET llenas = 5, vacias = 2, precio = 50000 WHERE tipo = '45kg'`);
        }

        const adminRow = await client.execute({ sql: `SELECT * FROM usuarios WHERE usuario = ?`, args: ['admin'] });
        if (adminRow.rows.length === 0) {
            const hashedPassword = bcrypt.hashSync('1234', 10);
            await db.run(`INSERT INTO usuarios (usuario, password, rol) VALUES ('admin', ?, 'admin')`, ['admin', hashedPassword]);
        }

        console.log("✅ Base de datos inicializada correctamente.");
    } catch (err) {
        console.error("Error BD:", err.message);
    }
}

inicializarBD();

module.exports = db;
console.log("Conectado a la base de datos:", dbUrl);