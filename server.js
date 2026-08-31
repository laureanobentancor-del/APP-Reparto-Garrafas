const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Permite recibir datos de formularios y mostrar los archivos HTML/CSS/JS
app.use(express.json()); 
app.use(express.static(__dirname));

// --- BASE DE DATOS ---
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error("Error BD:", err.message);
    else console.log("✅ Conectado a SQLite.");
});

// Inicializar Tablas (Solo Clientes y Stock)
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
    
    // Insertar garrafas por defecto si no existen
    db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('10kg', 0, 0, 0)");
    db.run("INSERT OR IGNORE INTO stock (tipo, llenas, vacias, precio) VALUES ('15kg', 0, 0, 0)");
});

// ==========================================
// RUTAS API (Backend)
// ==========================================

// --- CLIENTES ---
app.get('/api/clientes', (req, res) => {
    db.all("SELECT * FROM clientes", [], (err, rows) => res.json(rows));
});

app.post('/api/clientes', (req, res) => {
    const { nombre, telefono, direccion } = req.body;
    db.run("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)", 
        [nombre, telefono, direccion], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Cliente guardado" });
    });
});

app.delete('/api/clientes/:id', (req, res) => {
    db.run("DELETE FROM clientes WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Cliente eliminado" });
    });
});

// --- STOCK ---
app.get('/api/stock', (req, res) => {
    db.all("SELECT * FROM stock", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/stock/:tipo', (req, res) => {
    const { llenas, vacias, precio } = req.body;
    db.run("UPDATE stock SET llenas = ?, vacias = ?, precio = ? WHERE tipo = ?", 
        [llenas, vacias, precio, req.params.tipo], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Stock actualizado" });
    });
});

// --- REDIRECCIÓN PRINCIPAL ---
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor listo. Abre tu navegador y entra a: http://localhost:${PORT}`);
});