const express = require('express');
const router = express.Router();

module.exports = function(db, verificarAutenticacion) {

    // ==========================================
// OBTENER REGISTROS PARA EL LIBRO DIARIO
// ==========================================
router.get('/api/pedidos', verificarAutenticacion, (req, res) => {
    const { desde, hasta, canal } = req.query;
    
    let sql = `SELECT pedidos.*, 
                 COALESCE(pedidos.forma_pago, 'Efectivo') as forma_pago, 
                 clientes.nombre as cliente_nombre, 
                 clientes.telefono as cliente_telefono,
                 clientes.direccion as direccion
                 FROM pedidos 
                 JOIN clientes ON pedidos.cliente_id = clientes.id`;
    
    let params = [];
    let condiciones = [];

    // Filtrar por rango de fechas si se proveen
    if (desde && hasta) {
        condiciones.push(`DATE(pedidos.fecha) BETWEEN ? AND ?`);
        params.push(desde, hasta);
    }

    // Filtrar por canal de venta si es distinto de todos
    if (canal && canal !== 'todos') {
        condiciones.push(`TRIM(LOWER(pedidos.tipo_venta)) = ?`);
        params.push(canal.toLowerCase());
    }

    if (condiciones.length > 0) {
        sql += ` WHERE ` + condiciones.join(' AND ');
    }

    sql += ` ORDER BY pedidos.fecha DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows) {
            rows.forEach(r => { 
                if (r.cliente_telefono) r.cliente_telefono = r.cliente_telefono.split(',')[0]; 
            });
        }
        res.json(rows || []);
    });
});
return router;
};