const express = require('express');
const router = express.Router();

const { registrarTrazabilidad } = require('../models/trazabilidad');

module.exports = function (db, verificarAutenticacion) {

    const dbGet = (sql, p = []) => new Promise((ok, no) => db.get(sql, p, (e, r) => e ? no(e) : ok(r)));
    const dbRun = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));

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

    // ---------- Helpers de items ----------
    async function prepararItems(rawItems) {
        if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 20) {
            throw new Error("Faltan garrafas en el pedido");
        }
        const stocks = {};
        const items = [];
        for (const it of rawItems) {
            const cantidad = parseInt(it.cantidad);
            if (!it.tipo || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 1000) {
                throw new Error("Cantidad o tipo inválido");
            }
            if (!stocks[it.tipo]) {
                const s = await dbGet("SELECT precio, llenas, vacias FROM stock WHERE tipo = ?", [it.tipo]);
                if (!s) throw new Error("Stock no encontrado para " + it.tipo);
                stocks[it.tipo] = s;
            }
            const p = parseFloat(it.precio);
            const precio = Number.isFinite(p) && p >= 0 ? p : (parseFloat(stocks[it.tipo].precio) || 0);
            items.push({ tipo: it.tipo, cantidad, precio });
        }
        return { items, stocks };
    }

    function resumirItems(items) {
        return {
            tipo: items.map((i) => i.cantidad + ' x ' + i.tipo).join(', '),
            cantidad: items.reduce((a, i) => a + i.cantidad, 0),
            total: Math.round(items.reduce((a, i) => a + i.cantidad * i.precio, 0) * 100) / 100
        };
    }

    // ---------- Helper de pagos (simples o mixtos) ----------
    const METODOS_VALIDOS = ['Efectivo', 'Mercado Pago', 'Transferencia', 'Pendiente'];

    function prepararPagos(rawPagos, total, formaLegacy) {
        total = Math.round(total * 100) / 100;
        let pagos;

        if (Array.isArray(rawPagos) && rawPagos.length) {
            if (rawPagos.length > 6) throw new Error("Demasiados métodos de pago");
            pagos = rawPagos.map((p) => ({
                metodo: String(p.metodo),
                monto: Math.round((parseFloat(p.monto) || 0) * 100) / 100
            }));
            if (pagos.some((p) => !METODOS_VALIDOS.includes(p.metodo))) {
                throw new Error("Método de pago inválido");
            }
            if (pagos.length === 1) {
                pagos[0].monto = total;
            } else {
                if (pagos.some((p) => p.monto <= 0)) throw new Error("Cada pago debe tener un monto mayor a 0");
                const suma = Math.round(pagos.reduce((a, p) => a + p.monto, 0) * 100) / 100;
                if (Math.abs(suma - total) > 0.01) {
                    throw new Error(`Los pagos suman $${suma} y el total del pedido es $${total}`);
                }
            }
        } else {
            pagos = [{ metodo: formaLegacy || 'Efectivo', monto: total }];
        }

        const metodos = [...new Set(pagos.map((p) => p.metodo))];
        return { pagos, forma_pago: metodos.length === 1 ? metodos[0] : 'Mixto' };
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

    // CREAR UN PEDIDO CON VARIOS TIPOS DE GARRAFA Y PAGO SIMPLE O MIXTO
    router.post('/api/pedidos', verificarAutenticacion, async (req, res) => {
        try {
            const { cliente_id, forma_pago, tipo_venta } = req.body;
            if (!cliente_id) return res.status(400).json({ error: "Faltan datos del pedido" });
            const observacion = String(req.body.observacion || '').trim().slice(0, 500);

            const { items, stocks } = await prepararItems(
                req.body.items || [{ tipo: req.body.tipo, cantidad: req.body.cantidad, precio: req.body.precio }]
            );

            // Verificar stock por tipo antes de guardar
            const porTipo = {};
            items.forEach((i) => { porTipo[i.tipo] = (porTipo[i.tipo] || 0) + i.cantidad; });
            for (const tipo of Object.keys(porTipo)) {
                const llenas = parseInt(stocks[tipo].llenas) || 0;
                if (llenas < porTipo[tipo]) {
                    return res.status(400).json({ error: `No hay suficiente stock de ${tipo}. Disponibles: ${llenas}` });
                }
            }

            const r = resumirItems(items);
            const pg = prepararPagos(req.body.pagos, r.total, forma_pago);

            const ins = await dbRun(
                `INSERT INTO pedidos (cliente_id, tipo, cantidad, total, estado, forma_pago, pagos, tipo_venta, observacion, items, fecha)
                 VALUES (?, ?, ?, ?, 'Pendiente', ?, ?, ?, ?, ?, DATETIME('now', 'localtime'))`,
                [cliente_id, r.tipo, r.cantidad, r.total, pg.forma_pago, JSON.stringify(pg.pagos), tipo_venta || 'deposito', observacion, JSON.stringify(items)]
            );

            for (const tipo of Object.keys(porTipo)) {
                await dbRun("UPDATE stock SET llenas = ?, vacias = ? WHERE tipo = ?", [
                    (parseInt(stocks[tipo].llenas) || 0) - porTipo[tipo],
                    (parseInt(stocks[tipo].vacias) || 0) + porTipo[tipo],
                    tipo
                ]);
            }

            registrarTrazabilidad(db, req, 'CREAR_PEDIDO', `Se creó el pedido ID ${ins.lastID} (${r.tipo}) con estado: Pendiente`);
            res.json({ id: ins.lastID, mensaje: "Pedido creado y stock actualizado" });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // EDITAR PEDIDO (varias garrafas, precios y pagos editables)
    router.put('/api/pedidos/:id', verificarAutenticacion, async (req, res) => {
        try {
            const { tipo_venta } = req.body;
            const { items } = await prepararItems(
                req.body.items || [{ tipo: req.body.tipo, cantidad: req.body.cantidad, precio: req.body.precio }]
            );
            const r = resumirItems(items);

            if (Array.isArray(req.body.pagos) && req.body.pagos.length) {
                const pg = prepararPagos(req.body.pagos, r.total, null);
                await dbRun(
                    "UPDATE pedidos SET tipo = ?, cantidad = ?, total = ?, items = ?, forma_pago = ?, pagos = ?, tipo_venta = COALESCE(?, tipo_venta) WHERE id = ?",
                    [r.tipo, r.cantidad, r.total, JSON.stringify(items), pg.forma_pago, JSON.stringify(pg.pagos), tipo_venta || null, req.params.id]
                );
            } else {
                await dbRun(
                    "UPDATE pedidos SET tipo = ?, cantidad = ?, total = ?, items = ?, tipo_venta = COALESCE(?, tipo_venta) WHERE id = ?",
                    [r.tipo, r.cantidad, r.total, JSON.stringify(items), tipo_venta || null, req.params.id]
                );
            }
            registrarTrazabilidad(db, req, 'EDITAR_PEDIDO', `Se editó el pedido ID ${req.params.id}`);
            res.json({ mensaje: "Editado" });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
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

    // ACTUALIZAR FORMA DE PAGO (simple)
    router.put('/api/pedidos/:id/pago', verificarAutenticacion, (req, res) => {
        const { forma_pago } = req.body;
        if (!forma_pago) return res.status(400).json({ error: "Forma de pago requerida" });

        db.run("UPDATE pedidos SET forma_pago = ?, pagos = NULL WHERE id = ?", [forma_pago, req.params.id], function (err) {
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

    // EDITAR OBSERVACIÓN (siempre permitido, esté o no completado)
    router.put('/api/pedidos/:id/observacion', verificarAutenticacion, (req, res) => {
        const observacion = String(req.body.observacion || '').trim().slice(0, 500);
        db.run("UPDATE pedidos SET observacion = ? WHERE id = ?", [observacion, req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            registrarTrazabilidad(db, req, 'EDITAR_OBSERVACION', `Se editó la observación del pedido ID ${req.params.id}`);
            res.json({ mensaje: "Observación actualizada" });
        });
    });

    return router;
};