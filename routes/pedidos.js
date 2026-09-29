const express = require('express');
const router = express.Router();

module.exports = function(db, verificarAutenticacion) {
   
    // ==========================================
    // OBTENER TODOS LOS PEDIDOS
    // ==========================================
    router.get('/api/pedidos', (req, res) => {
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
            if (rows) rows.forEach(r => { if(r.cliente_telefono) r.cliente_telefono = r.cliente_telefono.split(',')[0]; });
            res.json(rows || []);
        });
    });

    // ==========================================
    // PEDIDOS DE HOY
    // ==========================================
    router.get('/api/pedidos/hoy', (req, res) => {
        const sql = `SELECT pedidos.*, 
                     COALESCE(pedidos.forma_pago, 'Efectivo') as forma_pago, 
                     clientes.nombre as cliente_nombre, 
                     clientes.telefono as cliente_telefono,
                     clientes.direccion as direccion
                     FROM pedidos 
                     JOIN clientes ON pedidos.cliente_id = clientes.id 
                     WHERE DATE(pedidos.fecha) = DATE('now', 'localtime') 
                     ORDER BY pedidos.id DESC`;
        db.all(sql, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            if (rows) rows.forEach(r => { if(r.cliente_telefono) r.cliente_telefono = r.cliente_telefono.split(',')[0]; });
            res.json(rows || []);
        });
    });

    // ==========================================
    // FILTRAR PEDIDOS POR FECHA
    // ==========================================
    router.get('/api/pedidos/filtrar', (req, res) => {
        const { desde, hasta } = req.query;
        const sql = `SELECT pedidos.*, 
                     COALESCE(pedidos.forma_pago, 'Efectivo') as forma_pago, 
                     clientes.nombre as cliente_nombre, 
                     clientes.telefono as cliente_telefono,
                     clientes.direccion as direccion
                     FROM pedidos 
                     JOIN clientes ON pedidos.cliente_id = clientes.id 
                     WHERE DATE(pedidos.fecha) BETWEEN ? AND ? 
                     ORDER BY pedidos.id DESC`;
        db.all(sql, [desde, hasta], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            if (rows) rows.forEach(r => { if(r.cliente_telefono) r.cliente_telefono = r.cliente_telefono.split(',')[0]; });
            res.json(rows || []);
        });
    });

    // ==========================================
    // CREAR NUEVO PEDIDO Y DESCONTAR STOCK
    // ==========================================
    router.post('/api/pedidos', (req, res) => {
        let { cliente_id, tipo, cantidad, forma_pago, tipo_venta } = req.body;
        cantidad = parseInt(req.body.cantidad) || 1; 

        db.get("SELECT precio, llenas, vacias FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
            if (!stock) return res.status(400).json({ error: "Stock no encontrado" });
            
            const llenasActuales = parseInt(stock.llenas) || 0;
            const vaciasActuales = parseInt(stock.vacias) || 0;
            const precio = parseFloat(stock.precio) || 0;

            if (llenasActuales < cantidad) {
                return res.status(400).json({ error: `No hay suficiente stock de garrafas llenas de \({tipo}. Disponibles:\){llenasActuales}` });
            }

            const total = precio * cantidad;
            const pagoFinal = forma_pago || 'Efectivo';
            const ventaFinal = tipo_venta || 'deposito';
            
            db.serialize(() => {
                db.run(`INSERT INTO pedidos (cliente_id, tipo, cantidad, total, estado, forma_pago, tipo_venta, fecha) 
                        VALUES (?, ?, ?, ?, 'Pendiente', ?, ?, DATETIME('now', 'localtime'))`, 
                        [cliente_id, tipo, cantidad, total, pagoFinal, ventaFinal], function(err) {
                        if (err) return res.status(500).json({ error: err.message });
                        const pedidoId = this.lastID;

                        const nuevasLlenas = llenasActuales - cantidad;
                        const nuevasVacias = vaciasActuales + cantidad;

                        db.run("UPDATE stock SET llenas = ?, vacias = ? WHERE tipo = ?", [nuevasLlenas, nuevasVacias, tipo], () => {
                            res.json({ id: pedidoId, mensaje: "Pedido creado y stock actualizado" });
                        });
                    });
            });
        });
    });

    // ==========================================
    // ACTUALIZAR / EDITAR PEDIDO
    // ==========================================
    router.put('/api/pedidos/:id', verificarAutenticacion, (req, res) => {
        const { tipo, cantidad } = req.body;
        db.get("SELECT precio FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
            if (!stock) return res.status(400).json({ error: "Tipo de stock no encontrado" });
            const total = stock.precio * cantidad;
            db.run("UPDATE pedidos SET tipo = ?, cantidad = ?, total = ? WHERE id = ?", [tipo, cantidad, total, req.params.id], () => res.json({ mensaje: "Editado" }));
        });
    });

    // ==========================================
    // ACTUALIZAR ESTADO (Pendiente / Completado)
    // ==========================================
    router.put('/api/pedidos/:id/estado', verificarAutenticacion, (req, res) => {
        db.run("UPDATE pedidos SET estado = ? WHERE id = ?", [req.body.estado, req.params.id], () => res.json({ mensaje: "Ok" }));
    });

    // ==========================================
    // ACTUALIZAR FORMA DE PAGO
    // ==========================================
    router.put('/api/pedidos/:id/pago', verificarAutenticacion, (req, res) => {
        const { forma_pago } = req.body;
        db.run("UPDATE pedidos SET forma_pago = ? WHERE id = ?", [forma_pago, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ mensaje: "Forma de pago actualizada con éxito" });
        });
    });

    // ==========================================
    // BORRAR PEDIDO
    // ==========================================
    router.delete('/api/pedidos/:id', verificarAutenticacion, (req, res) => {
        db.run("DELETE FROM pedidos WHERE id = ?", [req.params.id], () => res.json({ mensaje: "Borrado" }));
    });

    return router;
};