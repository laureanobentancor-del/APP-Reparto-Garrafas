const express = require('express');

module.exports = function(db, verificarAutenticacion, verificarAdminSesion) {
    const router = express.Router();

    function validarCliente(body) {
        const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
        const telefono = body.telefono == null ? '' : String(body.telefono).trim();
        const direccion = body.direccion == null ? '' : String(body.direccion).trim();

        if (!nombre || nombre.length > 100) return { error: "El nombre es obligatorio (máximo 100 caracteres)." };
        if (telefono.length > 50) return { error: "Teléfono demasiado largo." };
        if (direccion.length > 200) return { error: "Dirección demasiado larga." };
        return { nombre, telefono, direccion };
    }

    // Obtener clientes
    router.get('/api/clientes', verificarAutenticacion, (req, res) => {
        db.all("SELECT * FROM clientes", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            if (rows) rows.forEach(r => { if (r.telefono) r.telefono = r.telefono.split(',')[0]; });
            res.json(rows || []);
        });
    });

    // Crear cliente
    router.post('/api/clientes', verificarAutenticacion, (req, res) => {
        // LOG TEMPORAL para rastrear quién crea clientes (borrar cuando se resuelva)
        console.log(`[CLIENTES POST] ${new Date().toISOString()} IP=${req.ip} userId=${req.session.userId} usuario=${req.session.usuario} body=${JSON.stringify(req.body)}`);

        const v = validarCliente(req.body || {});
        if (v.error) return res.status(400).json({ error: v.error });

        db.run("INSERT INTO clientes (nombre, telefono, direccion) VALUES (?, ?, ?)", [v.nombre, v.telefono, v.direccion], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        });
    });

    // Actualizar cliente
    router.put('/api/clientes/:id', verificarAutenticacion, (req, res) => {
        console.log(`[CLIENTES PUT] ${new Date().toISOString()} IP=${req.ip} userId=${req.session.userId} usuario=${req.session.usuario} id=${req.params.id}`);

        const v = validarCliente(req.body || {});
        if (v.error) return res.status(400).json({ error: v.error });

        db.get("SELECT telefono FROM clientes WHERE id = ?", [req.params.id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: "Cliente no encontrado" });

            let telefonoFinal = v.telefono;
            if (row.telefono && row.telefono.includes(',')) {
                const partes = row.telefono.split(',');
                partes[0] = v.telefono;
                telefonoFinal = partes.join(',');
            }
            db.run("UPDATE clientes SET nombre = ?, telefono = ?, direccion = ? WHERE id = ?",
                [v.nombre, telefonoFinal, v.direccion, req.params.id], (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.json({ mensaje: "Actualizado" });
                }
            );
        });
    });

    // Obtener pedidos de un cliente
    router.get('/api/clientes/:id/pedidos', verificarAutenticacion, (req, res) => {
        const sql = `SELECT pedidos.*, clientes.nombre as cliente_nombre FROM pedidos JOIN clientes ON pedidos.cliente_id = clientes.id WHERE clientes.id = ? ORDER BY pedidos.id DESC`;
        db.all(sql, [req.params.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    });

    // Borrar cliente (solo administradores)
    router.delete('/api/clientes/:id', verificarAutenticacion, verificarAdminSesion, (req, res) => {
        console.log(`[CLIENTES DELETE] ${new Date().toISOString()} IP=${req.ip} userId=${req.session.userId} usuario=${req.session.usuario} id=${req.params.id}`);

        db.run("DELETE FROM clientes WHERE id = ?", [req.params.id], (err) => {
            if (err) {
                const msg = String(err.message || '');
                if (/constraint|foreign/i.test(msg)) {
                    return res.status(409).json({ error: "No se puede borrar: el cliente tiene pedidos asociados." });
                }
                return res.status(500).json({ error: msg });
            }
            res.json({ mensaje: "Borrado" });
        });
    });

    return router;
};