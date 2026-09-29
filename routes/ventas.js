const express = require('express');
const router = express.Router();

module.exports = function(db, verificarAutenticacion) {

    // ==========================================
    // OBTENER SOLO LAS VENTAS (PEDIDOS COMPLETADOS)
    // ==========================================
router.get('/api/ventas', verificarAutenticacion, (req, res) => {
    // Modificamos para que traiga los pedidos de ventas (puedes filtrar por estado o mostrar los pendientes de cobro)
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
        if (rows) {
            rows.forEach(r => { 
                if (r.cliente_telefono) r.cliente_telefono = r.cliente_telefono.split(',')[0]; 
            });
        }
        res.json(rows || []);
    });
});



router.put('/api/pedidos/:id/pago', verificarAutenticacion, (req, res) => {
    const { forma_pago } = req.body;
    const validas = ['Efectivo', 'Mercado Pago', 'Transferencia'];

    if (!validas.includes(forma_pago)) {
        return res.status(400).json({ error: 'Forma de pago no válida' });
    }

    db.run(
    "UPDATE pedidos SET forma_pago = ? WHERE id = ? AND (forma_pago IS NULL OR forma_pago NOT IN ('Efectivo', 'Mercado Pago', 'Transferencia'))",
    [forma_pago, req.params.id],
    function (err) {
            if (err) return res.status(500).json({ error: 'Error al actualizar' });
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Pedido no encontrado o ya estaba pagado' });
            }
            res.json({ mensaje: 'Ok' });
        }
    );
});


    return router;
};