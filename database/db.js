// database/db.js — Turso como ÚNICA base de datos (sin archivo local).
// Expone la misma API que usaba sqlite3 (db.get / db.all / db.run / db.exec / db.serialize / db.prepare)
// y también la de libsql (db.execute / db.batch / db.client), para que tus rutas actuales sigan funcionando.
require('dotenv').config();
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error('[db] Falta TURSO_DATABASE_URL en el .env');

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

// Interpreta (sql, ...params, callback) igual que sqlite3
function leerArgumentos(args) {
    let cb = null;
    if (typeof args[args.length - 1] === 'function') { cb = args[args.length - 1]; args = args.slice(0, -1); }
    const limpio = v => (v === undefined ? null : v);
    let params;
    if (args.length === 1 && Array.isArray(args[0])) params = args[0].map(limpio);
    else if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Buffer.isBuffer(args[0]))
        params = Object.fromEntries(Object.entries(args[0]).map(([k, v]) => [k.replace(/^[$:@]/, ''), limpio(v)]));
    else params = args.map(limpio);
    return { params, cb };
}

const filas = rs => rs.rows.map(row => {
    const o = {};
    rs.columns.forEach((c, i) => { o[c] = row[i]; });
    return o;
});

// Con callback → estilo sqlite3 (this.lastID / this.changes). Sin callback → devuelve una promesa.
function conCallback(trabajo, cb) {
    const p = trabajo();
    if (!cb) return p.then(r => r.valor);
    p.then(r => cb.call(r.ctx, null, r.valor), e => cb.call({}, e));
}

const db = {
    client,
    execute: a => client.execute(a),
    batch: (s, m) => client.batch(s, m),
    transaction: m => client.transaction(m),

    all(sql, ...resto) {
        const { params, cb } = leerArgumentos(resto);
        return conCallback(async () => ({ ctx: {}, valor: filas(await client.execute({ sql, args: params })) }), cb);
    },
    get(sql, ...resto) {
        const { params, cb } = leerArgumentos(resto);
        return conCallback(async () => ({ ctx: {}, valor: filas(await client.execute({ sql, args: params }))[0] }), cb);
    },
    run(sql, ...resto) {
        const { params, cb } = leerArgumentos(resto);
        return conCallback(async () => {
            const rs = await client.execute({ sql, args: params });
            return { ctx: { lastID: Number(rs.lastInsertRowid || 0), changes: rs.rowsAffected }, valor: undefined };
        }, cb);
    },
    each(sql, ...resto) {
        const fns = [];
        while (typeof resto[resto.length - 1] === 'function') fns.unshift(resto.pop());
        const { params } = leerArgumentos(resto);
        const [porFila, alTerminar] = fns;
        client.execute({ sql, args: params }).then(rs => {
            const lista = filas(rs);
            lista.forEach(f => porFila && porFila(null, f));
            alTerminar && alTerminar(null, lista.length);
        }, e => (alTerminar || porFila || (() => {}))(e));
    },
    exec(sql, cb) {
        const p = client.executeMultiple(sql);
        if (!cb) return p;
        p.then(() => cb(null), cb);
    },
    prepare(sql) {
        return {
            run: (...a) => db.run(sql, ...a),
            get: (...a) => db.get(sql, ...a),
            all: (...a) => db.all(sql, ...a),
            finalize: cb => { if (cb) cb(null); }
        };
    },
    serialize(fn) { if (fn) fn(); },
    parallelize(fn) { if (fn) fn(); },
    close(cb) { client.close(); if (cb) cb(null); }
};

// Crea las tablas que falten (no toca las que ya existen) y las 4 medidas de garrafa con stock en 0.
// El servidor espera a db.listo antes de empezar a atender pedidos.
db.listo = (async () => {
    await client.batch([
        `CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT UNIQUE,
            password TEXT,
            rol TEXT,
            bloqueado INTEGER DEFAULT 0,
            email TEXT
        )`,
        'CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, telefono TEXT, direccion TEXT)',
        'CREATE TABLE IF NOT EXISTS stock (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT UNIQUE, llenas INTEGER, vacias INTEGER, precio REAL)',
        `CREATE TABLE IF NOT EXISTS pedidos (
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
        )`,
        `CREATE TABLE IF NOT EXISTS trazabilidad (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            usuario TEXT,
            accion TEXT,
            detalles TEXT,
            fecha TEXT,
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
        )`,
        { sql: 'INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES (?, 0, 0, ?)', args: ['10kg', 8500] },
        { sql: 'INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES (?, 0, 0, ?)', args: ['15kg', 12000] },
        { sql: 'INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES (?, 0, 0, ?)', args: ['30kg', 35000] },
        { sql: 'INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES (?, 0, 0, ?)', args: ['45kg', 50000] }
    ], 'write');
    console.log('[db] Conectado a Turso:', url.replace(/^[a-z+]+:\/\//i, '').split(/[?#]/)[0], '(tablas verificadas)');
})();
db.listo.catch(e => console.error('[db] NO se pudo preparar la base en Turso:', e.message));

module.exports = db;