const test = require('node:test');
const assert = require('node:assert');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

test('Verificar conexión y existencia de tablas en la base de datos', async () => {
    // Abrimos una conexión temporal a tu base de datos SQLite existente
    const dbPath = path.join(__dirname, 'database.db');
    
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        assert.ifError(err); // Si hay error al conectar, la prueba falla
    });

    // Promesificamos una consulta para verificar que la tabla 'clientes' existe y responde
    const consultarClientes = () => {
        return new Promise((resolve, reject) => {
            db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='clientes';", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    const tables = await consultarClientes();
    
    // Cerramos la base de datos al terminar
    db.close();

    // Verificamos que la tabla 'clientes' efectivamente exista en tu base de datos
    assert.strictEqual(tables.length, 1, 'La tabla clientes debería existir en la base de datos');
    assert.strictEqual(tables[0].name, 'clientes');
});