const express = require('express');
const router = express.Router();

module.exports = function(db, verificarAutenticacion) {

    // ==========================================
    // OBTENER SOLO LAS VENTAS (PEDIDOS COMPLETADOS)
    // ==========================================
    router.get('/api/ventas', verificarAutenticacion, (req, res) => {
        const sql = `SELECT pedidos.*, 
                     COALESCE(pedidos.forma_pago, 'Efectivo') as forma_pago, 
                     clientes.nombre as cliente_nombre, 
                     clientes.telefono as cliente_telefono,
                     clientes.direccion as direccion
                     FROM pedidos 
                     JOIN clientes ON pedidos.cliente_id = clientes.id 
                     WHERE pedidos.estado = 'Completado'
                     ORDER BY pedidos.id DESC`;
        
        db.all(sql, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            if (rows) {
                rows.forEach(r => { 
                    if (r.cliente_telefono) r.cliente_telefono = r.cliente_telefono.split(',')[0]; 
                });
            }
            res.json(rows || []);
        });
    });

    // ==========================================
    // ACTUALIZAR FORMA DE PAGO DE UNA VENTA
    // ==========================================
    router.put('/api/ventas/:id/pago', verificarAutenticacion, (req, res) => {
        const { forma_pago } = req.body;
        db.run("UPDATE pedidos SET forma_pago = ? WHERE id = ?", [forma_pago, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ mensaje: "Forma de pago de la venta actualizada con éxito" });
        });
    });

    return router;
};