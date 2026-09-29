const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error("Error BD:", err.message);
    else console.log("✅ Conectado a SQLite correctamente.");
});

// Inicialización de tablas y datos de prueba (Seed)
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE,
        password TEXT,
        rol TEXT,
        bloqueado INTEGER DEFAULT 0
    )`);

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

    // Datos de prueba si la tabla clientes está vacía
    db.get("SELECT COUNT(*) as count FROM clientes", (err, row) => {
        if (row && row.count === 0) {
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
            clientesPrueba.forEach(c => {
                db.run(`INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)`, c);
            });

            db.run(`UPDATE stock SET llenas = 20, vacias = 10, precio = 8500 WHERE tipo = '10kg'`);
            db.run(`UPDATE stock SET llenas = 15, vacias = 5, precio = 12000 WHERE tipo = '15kg'`);
            db.run(`UPDATE stock SET llenas = 8, vacias = 4, precio = 35000 WHERE tipo = '30kg'`);
            db.run(`UPDATE stock SET llenas = 5, vacias = 2, precio = 50000 WHERE tipo = '45kg'`);
        }
    });

    const hashedPassword = bcrypt.hashSync('1234', 10);
    db.get(`SELECT * FROM usuarios WHERE usuario = 'admin'`, (err, row) => {
        if (!row) {
            db.run(`INSERT INTO usuarios (usuario, password, rol) VALUES ('admin', ?, 'admin')`, [hashedPassword]);
        }
    });
});

module.exports = db;