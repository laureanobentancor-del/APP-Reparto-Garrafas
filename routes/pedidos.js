const express = require('express');
const router = express.Router();

const { registrarTrazabilidad } = require('../models/trazabilidad');

module.exports = function (db, verificarAutenticacion) {

    const dbGet = (sql, p = []) => new Promise((ok, no) => db.get(sql, p, (e, r) => e ? no(e) : ok(r)));
    const dbRun = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));

    // Error "de negocio" (dato inválido, sin stock, no existe...). Se responde 400/404.
    // Cualquier otro error (fallo de base de datos) se responde 500.
    class ErrorNegocio extends Error {
        constructor(mensaje, status = 400) { super(mensaje); this.status = status; }
    }
    const responderError = (res, err) =>
        res.status(err instanceof ErrorNegocio ? err.status : 500).json({ error: err.message });

    // ---------- Concurrencia: cola + compensación ----------
    // Todo lo que toca stock se ejecuta de a uno (cola) y cada descuento es un UPDATE atómico.
    // No se usan BEGIN/COMMIT porque la conexión se comparte con el resto del sistema:
    // si algo falla a mitad de camino, se deshacen a mano los pasos ya hechos.
    let cola = Promise.resolve();
    function exclusivo(fn) {
        const corrida = cola.then(fn);
        cola = corrida.catch(() => { });
        return corrida;
    }
    async function conCompensacion(fn) {
        const deshacer = [];
        try {
            return await fn(deshacer);
        } catch (err) {
            for (const paso of deshacer.reverse()) {
                try { await paso(); } catch (e) { console.error('No se pudo deshacer un paso:', e.message); }
            }
            throw err;
        }
    }

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
            throw new ErrorNegocio("Faltan garrafas en el pedido");
        }
        const stocks = {};
        const items = [];
        for (const it of rawItems) {
            const cantidad = parseInt(it.cantidad);
            if (!it.tipo || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 1000) {
                throw new ErrorNegocio("Cantidad o tipo inválido");
            }
            if (!stocks[it.tipo]) {
                const s = await dbGet("SELECT precio FROM stock WHERE tipo = ?", [it.tipo]);
                if (!s) throw new ErrorNegocio("Stock no encontrado para " + it.tipo);
                stocks[it.tipo] = s;
            }
            const p = parseFloat(it.precio);
            const precio = Number.isFinite(p) && p >= 0 ? p : (parseFloat(stocks[it.tipo].precio) || 0);
            items.push({ tipo: it.tipo, cantidad, precio });
        }
        return { items };
    }

    function resumirItems(items) {
        return {
            tipo: items.map((i) => i.cantidad + ' x ' + i.tipo).join(', '),
            cantidad: items.reduce((a, i) => a + i.cantidad, 0),
            total: Math.round(items.reduce((a, i) => a + i.cantidad * i.precio, 0) * 100) / 100
        };
    }

    // { '10kg': 3, '15kg': 1 }
    function agruparPorTipo(items) {
        const porTipo = {};
        items.forEach((i) => { porTipo[i.tipo] = (porTipo[i.tipo] || 0) + i.cantidad; });
        return porTipo;
    }

    // Recupera las garrafas de un pedido ya guardado.
    // Soporta pedidos nuevos (columna items en JSON) y viejos / de WhatsApp (solo tipo + cantidad).
    function itemsDePedido(pedido) {
        try {
            const parsed = JSON.parse(pedido.items);
            if (Array.isArray(parsed) && parsed.length) {
                return parsed.map((i) => ({ tipo: i.tipo, cantidad: parseInt(i.cantidad) || 0 }));
            }
        } catch (e) { /* sin items: se reconstruye abajo */ }

        const texto = String(pedido.tipo || '');
        const partes = texto.split(',').map((s) => s.trim()).filter(Boolean);
        const reconstruidos = partes.map((p) => p.match(/^(\d+)\s*x\s*(.+)$/i))
            .filter(Boolean)
            .map((m) => ({ tipo: m[2].trim(), cantidad: parseInt(m[1]) }));
        if (reconstruidos.length === partes.length && reconstruidos.length) return reconstruidos;

        return texto ? [{ tipo: texto, cantidad: parseInt(pedido.cantidad) || 0 }] : [];
    }

    // ---------- Movimientos de stock (atómicos, a nivel SQL) ----------
    // Descuenta llenas y suma vacías SOLO si alcanzan las llenas (la condición va en el propio UPDATE).
    async function descontarStock(porTipo, deshacer) {
        for (const tipo of Object.keys(porTipo)) {
            const n = porTipo[tipo];
            if (n <= 0) continue;
            const r = await dbRun(
                "UPDATE stock SET llenas = llenas - ?, vacias = vacias + ? WHERE tipo = ? AND llenas >= ?",
                [n, n, tipo, n]
            );
            if (r.changes === 0) {
                const s = await dbGet("SELECT llenas FROM stock WHERE tipo = ?", [tipo]);
                if (!s) throw new ErrorNegocio("Stock no encontrado para " + tipo);
                throw new ErrorNegocio(`No hay suficiente stock de ${tipo}. Disponibles: ${parseInt(s.llenas) || 0}`);
            }
            deshacer.push(() => dbRun(
                "UPDATE stock SET llenas = llenas + ?, vacias = MAX(vacias - ?, 0) WHERE tipo = ?", [n, n, tipo]));
        }
    }

    // Operación inversa: devuelve llenas y quita vacías (sin bajar de 0).
    async function reponerStock(porTipo, deshacer) {
        for (const tipo of Object.keys(porTipo)) {
            const n = porTipo[tipo];
            if (n <= 0) continue;
            await dbRun(
                "UPDATE stock SET llenas = llenas + ?, vacias = MAX(vacias - ?, 0) WHERE tipo = ?",
                [n, n, tipo]
            );
            deshacer.push(() => dbRun(
                "UPDATE stock SET llenas = llenas - ?, vacias = vacias + ? WHERE tipo = ?", [n, n, tipo]));
        }
    }

    // ---------- Helper de pagos (simples o mixtos) ----------
    const METODOS_VALIDOS = ['Efectivo', 'Mercado Pago', 'Transferencia', 'Pendiente'];

    function prepararPagos(rawPagos, total, formaLegacy) {
        total = Math.round(total * 100) / 100;
        let pagos;

        if (Array.isArray(rawPagos) && rawPagos.length) {
            if (rawPagos.length > 6) throw new ErrorNegocio("Demasiados métodos de pago");
            pagos = rawPagos.map((p) => ({
                metodo: String(p.metodo),
                monto: Math.round((parseFloat(p.monto) || 0) * 100) / 100
            }));
            if (pagos.some((p) => !METODOS_VALIDOS.includes(p.metodo))) {
                throw new ErrorNegocio("Método de pago inválido");
            }
            if (pagos.length === 1) {
                pagos[0].monto = total;
            } else {
                if (pagos.some((p) => p.monto <= 0)) throw new ErrorNegocio("Cada pago debe tener un monto mayor a 0");
                const suma = Math.round(pagos.reduce((a, p) => a + p.monto, 0) * 100) / 100;
                if (Math.abs(suma - total) > 0.01) {
                    throw new ErrorNegocio(`Los pagos suman $${suma} y el total del pedido es $${total}`);
                }
            }
        } else {
            const forma = formaLegacy || 'Efectivo';
            if (!METODOS_VALIDOS.includes(forma)) throw new ErrorNegocio("Método de pago inválido");
            pagos = [{ metodo: forma, monto: total }];
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
        db.all(`${SELECT_BASE} WHERE DATE(pedidos.fecha) = DATE('now', '-3 hours') ORDER BY pedidos.id DESC`, [], responderLista(res));
    });

    // FILTRAR PEDIDOS POR FECHA (las fechas se guardan ya con el offset de -3 horas, por eso se comparan directo)
    router.get('/api/pedidos/filtrar', verificarAutenticacion, (req, res) => {
        const { desde, hasta } = req.query;
        const formatoFecha = /^\d{4}-\d{2}-\d{2}$/;
        if (!formatoFecha.test(desde || '') || !formatoFecha.test(hasta || '')) {
            return res.status(400).json({ error: "Indicá las fechas 'desde' y 'hasta' (formato AAAA-MM-DD)" });
        }
        if (desde > hasta) {
            return res.status(400).json({ error: "La fecha 'desde' no puede ser posterior a 'hasta'" });
        }
        db.all(`${SELECT_BASE} WHERE DATE(pedidos.fecha) BETWEEN ? AND ? ORDER BY pedidos.id DESC`, [desde, hasta], responderLista(res));
    });

    // CREAR UN PEDIDO CON VARIOS TIPOS DE GARRAFA Y PAGO SIMPLE O MIXTO
    router.post('/api/pedidos', verificarAutenticacion, async (req, res) => {
        try {
            const { cliente_id, forma_pago, tipo_venta } = req.body;
            if (!cliente_id) throw new ErrorNegocio("Faltan datos del pedido");
            const observacion = String(req.body.observacion || '').trim().slice(0, 500);

            const { items } = await prepararItems(
                req.body.items || [{ tipo: req.body.tipo, cantidad: req.body.cantidad, precio: req.body.precio }]
            );
            const r = resumirItems(items);
            const pg = prepararPagos(req.body.pagos, r.total, forma_pago);
            const porTipo = agruparPorTipo(items);

            // Descuento de stock + insert: si algo falla, se devuelve el stock descontado
            const nuevoId = await exclusivo(() => conCompensacion(async (deshacer) => {
                await descontarStock(porTipo, deshacer);
                const ins = await dbRun(
                    `INSERT INTO pedidos (cliente_id, tipo, cantidad, total, estado, forma_pago, pagos, tipo_venta, observacion, items, fecha)
                     VALUES (?, ?, ?, ?, 'Pendiente', ?, ?, ?, ?, ?, DATETIME('now', '-3 hours'))`,
                    [cliente_id, r.tipo, r.cantidad, r.total, pg.forma_pago, JSON.stringify(pg.pagos), tipo_venta || 'deposito', observacion, JSON.stringify(items)]
                );
                return ins.lastID;
            }));

            registrarTrazabilidad(db, req, 'CREAR_PEDIDO', `Se creó el pedido ID ${nuevoId} (${r.tipo}) con estado: Pendiente`);
            res.json({ id: nuevoId, mensaje: "Pedido creado y stock actualizado" });
        } catch (err) {
            responderError(res, err);
        }
    });

    // EDITAR PEDIDO (varias garrafas, precios y pagos editables) + reajuste de stock por la diferencia
    router.put('/api/pedidos/:id', verificarAutenticacion, async (req, res) => {
        try {
            const { tipo_venta } = req.body;
            const { items } = await prepararItems(
                req.body.items || [{ tipo: req.body.tipo, cantidad: req.body.cantidad, precio: req.body.precio }]
            );
            const r = resumirItems(items);
            const pg = (Array.isArray(req.body.pagos) && req.body.pagos.length)
                ? prepararPagos(req.body.pagos, r.total, null)
                : null;
            const nuevoPorTipo = agruparPorTipo(items);

            await exclusivo(() => conCompensacion(async (deshacer) => {
                const pedido = await dbGet("SELECT id, tipo, cantidad, items FROM pedidos WHERE id = ?", [req.params.id]);
                if (!pedido) throw new ErrorNegocio("Pedido no encontrado", 404);

                // Diferencia entre lo que se había descontado y lo que ahora tiene el pedido
                const viejoPorTipo = agruparPorTipo(itemsDePedido(pedido));
                const aDescontar = {};
                const aReponer = {};
                new Set([...Object.keys(viejoPorTipo), ...Object.keys(nuevoPorTipo)]).forEach((tipo) => {
                    const delta = (nuevoPorTipo[tipo] || 0) - (viejoPorTipo[tipo] || 0);
                    if (delta > 0) aDescontar[tipo] = delta;
                    else if (delta < 0) aReponer[tipo] = -delta;
                });
                await reponerStock(aReponer, deshacer);
                await descontarStock(aDescontar, deshacer);

                if (pg) {
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
            }));

            registrarTrazabilidad(db, req, 'EDITAR_PEDIDO', `Se editó el pedido ID ${req.params.id}`);
            res.json({ mensaje: "Editado y stock reajustado" });
        } catch (err) {
            responderError(res, err);
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
        if (!METODOS_VALIDOS.includes(forma_pago)) {
            return res.status(400).json({ error: "Método de pago inválido" });
        }

        db.run("UPDATE pedidos SET forma_pago = ?, pagos = NULL WHERE id = ?", [forma_pago, req.params.id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: "Pedido no encontrado" });
            registrarTrazabilidad(db, req, 'ACTUALIZAR_PAGO', `Pedido ID ${req.params.id} actualizado a forma de pago: ${forma_pago}`);
            res.json({ mensaje: "Forma de pago actualizada con éxito" });
        });
    });

    // BORRAR PEDIDO (devuelve las garrafas al stock)
    router.delete('/api/pedidos/:id', verificarAutenticacion, async (req, res) => {
        const pedidoId = req.params.id;
        try {
            await exclusivo(() => conCompensacion(async (deshacer) => {
                const pedido = await dbGet("SELECT id, tipo, cantidad, items FROM pedidos WHERE id = ?", [pedidoId]);
                if (!pedido) throw new ErrorNegocio("Pedido no encontrado", 404);

                await reponerStock(agruparPorTipo(itemsDePedido(pedido)), deshacer);
                await dbRun("DELETE FROM pedidos WHERE id = ?", [pedidoId]);
            }));

            registrarTrazabilidad(db, req, 'BORRAR_PEDIDO', `Se eliminó el pedido ID ${pedidoId} y se devolvió el stock`);
            res.json({ mensaje: "Borrado y stock devuelto" });
        } catch (err) {
            responderError(res, err);
        }
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