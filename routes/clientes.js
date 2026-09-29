const express = require('express');

module.exports = function(db, verificarAutenticacion, verificarAdminSesion) {
    const router = express.Router();

    // Obtener clientes (protegido con autenticación)
    router.get('/api/clientes', verificarAutenticacion, (req, res) => {
        db.all("SELECT * FROM clientes", [], (err, rows) => {
            if (rows) rows.forEach(r => { if(r.telefono) r.telefono = r.telefono.split(',')[0]; });
            res.json(rows || []);
        });
    });

    // Crear cliente (protegido)
    router.post('/api/clientes', verificarAutenticacion, (req, res) => {
        const { nombre, telefono, direccion } = req.body;
        db.run("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)", [nombre, telefono, direccion], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        });
    });

    // Actualizar cliente (protegido)
    router.put('/api/clientes/:id', verificarAutenticacion, (req, res) => {
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

    // Obtener pedidos de un cliente (protegido)
    router.get('/api/clientes/:id/pedidos', verificarAutenticacion, (req, res) => {
        const clienteId = req.params.id;
        const sql = `SELECT pedidos.*, clientes.nombre as cliente_nombre FROM pedidos JOIN clientes ON pedidos.cliente_id = clientes.id WHERE clientes.id = ? ORDER BY pedidos.id DESC`;
        db.all(sql, [clienteId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    });

    // Borrar cliente (Solo administradores, por ejemplo)
    router.delete('/api/clientes/:id', verificarAutenticacion, verificarAdminSesion, (req, res) => {
        db.run("DELETE FROM clientes WHERE id = ?", [req.params.id], () => res.json({ mensaje: "Borrado" }));
    });

    return router;
};

