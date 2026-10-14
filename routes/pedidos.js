const express = require('express');
const router = express.Router();

const { registrarTrazabilidad } = require('../models/trazabilidad');

module.exports = function(db, verificarAutenticacion) {

    const SELECT_BASE = `SELECT pedidos.*,
                     COALESCE(pedidos.forma_pago, 'Efectivo') as forma_pago,
                     clientes.nombre as cliente_nombre,
                     clientes.telefono as cliente_telefono,
                     clientes.direccion as direccion
                     FROM pedidos
                     JOIN clientes ON pedidos.cliente_id = clientes.id`;

    function responderLista(res) {
        return (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            if (rows) rows.forEach(r => { if (r.cliente_telefono) r.cliente_telefono = r.cliente_telefono.split(',')[0]; });
            res.json(rows || []);
        };
    }

    // OBTENER TODOS LOS PEDIDOS
    router.get('/api/pedidos', verificarAutenticacion, (req, res) => {
        db.all(`${SELECT_BASE} ORDER BY pedidos.id DESC`, [], responderLista(res));
    });

    // PEDIDOS DE HOY
    router.get('/api/pedidos/hoy', verificarAutenticacion, (req, res) => {
        db.all(`${SELECT_BASE} WHERE DATE(pedidos.fecha) = DATE('now', 'localtime') ORDER BY pedidos.id DESC`, [], responderLista(res));
    });

    // FILTRAR PEDIDOS POR FECHA
    router.get('/api/pedidos/filtrar', verificarAutenticacion, (req, res) => {
        const { desde, hasta } = req.query;
        db.all(`${SELECT_BASE} WHERE DATE(pedidos.fecha) BETWEEN ? AND ? ORDER BY pedidos.id DESC`, [desde, hasta], responderLista(res));
    });

    // CREAR NUEVO PEDIDO Y DESCONTAR STOCK
    router.post('/api/pedidos', verificarAutenticacion, (req, res) => {
        const { cliente_id, tipo, forma_pago, tipo_venta } = req.body;
        const cantidad = parseInt(req.body.cantidad) || 1;

        if (!cliente_id || !tipo) return res.status(400).json({ error: "Faltan datos del pedido" });
        if (cantidad < 1 || cantidad > 1000) return res.status(400).json({ error: "Cantidad inválida" });

        db.get("SELECT precio, llenas, vacias FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!stock) return res.status(400).json({ error: "Stock no encontrado" });

            const llenasActuales = parseInt(stock.llenas) || 0;
            const vaciasActuales = parseInt(stock.vacias) || 0;
            const precio = parseFloat(stock.precio) || 0;

            if (llenasActuales < cantidad) {
                return res.status(400).json({ error: `No hay suficiente stock de garrafas llenas de ${tipo}. Disponibles: ${llenasActuales}` });
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

                        db.run("UPDATE stock SET llenas = ?, vacias = ? WHERE tipo = ?", [nuevasLlenas, nuevasVacias, tipo], (err2) => {
                            if (err2) return res.status(500).json({ error: "El pedido se creó pero falló la actualización de stock: " + err2.message });
                            registrarTrazabilidad(db, req, 'CREAR_PEDIDO', `Se creó el pedido ID ${pedidoId} con estado: Pendiente`);
                            res.json({ id: pedidoId, mensaje: "Pedido creado y stock actualizado" });
                        });
                    });
            });
        });
    });

    // ACTUALIZAR / EDITAR PEDIDO
    router.put('/api/pedidos/:id', verificarAutenticacion, (req, res) => {
        const { tipo } = req.body;
        const cantidad = parseInt(req.body.cantidad);
        if (!tipo || !Number.isInteger(cantidad) || cantidad < 1) {
            return res.status(400).json({ error: "Datos inválidos" });
        }

        db.get("SELECT precio FROM stock WHERE tipo = ?", [tipo], (err, stock) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!stock) return res.status(400).json({ error: "Tipo de stock no encontrado" });
            const total = stock.precio * cantidad;
            db.run("UPDATE pedidos SET tipo = ?, cantidad = ?, total = ? WHERE id = ?", [tipo, cantidad, total, req.params.id], (err2) => {
                if (err2) return res.status(500).json({ error: err2.message });
                registrarTrazabilidad(db, req, 'EDITAR_PEDIDO', `Se editó el pedido ID ${req.params.id}`);
                res.json({ mensaje: "Editado" });
            });
        });
    });

    // ACTUALIZAR ESTADO (Pendiente / Completado)
    router.put('/api/pedidos/:id/estado', verificarAutenticacion, (req, res) => {
        const nuevoEstado = req.body.estado || req.body.nuevoEstado;
        const pedidoId = req.params.id;

        if (!['Pendiente', 'Completado'].includes(nuevoEstado)) {
            return res.status(400).json({ error: "Estado inválido" });
        }

        db.run("UPDATE pedidos SET estado = ? WHERE id = ?", [nuevoEstado, pedidoId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            registrarTrazabilidad(db, req, 'CAMBIAR_ESTADO', `Pedido ID ${pedidoId} cambiado a estado: ${nuevoEstado}`);
            res.json({ mensaje: "Ok" });
        });
    });

    // ACTUALIZAR FORMA DE PAGO
    router.put('/api/pedidos/:id/pago', verificarAutenticacion, (req, res) => {
        const { forma_pago } = req.body;
        if (!forma_pago) return res.status(400).json({ error: "Forma de pago requerida" });

        db.run("UPDATE pedidos SET forma_pago = ? WHERE id = ?", [forma_pago, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            registrarTrazabilidad(db, req, 'ACTUALIZAR_PAGO', `Pedido ID ${req.params.id} actualizado a forma de pago: ${forma_pago}`);
            res.json({ mensaje: "Forma de pago actualizada con éxito" });
        });
    });

    // BORRAR PEDIDO
    router.delete('/api/pedidos/:id', verificarAutenticacion, (req, res) => {
        const pedidoId = req.params.id;
        db.run("DELETE FROM pedidos WHERE id = ?", [pedidoId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            registrarTrazabilidad(db, req, 'BORRAR_PEDIDO', `Se eliminó el pedido ID ${pedidoId}`);
            res.json({ mensaje: "Borrado" });
        });
    });

    return router;
};