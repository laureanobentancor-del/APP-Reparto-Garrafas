const express = require('express');
const router = express.Router();

module.exports = function(db, verificarAutenticacion, verificarAdminSesion) {

    // Obtener todo el stock (requiere sesión)
    router.get('/api/stock', verificarAutenticacion, (req, res) => {
        db.all("SELECT * FROM stock", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    });

    // Actualizar stock por tipo (Solo Administradores)
    router.put('/api/stock/:tipo', verificarAutenticacion, verificarAdminSesion, (req, res) => {
        const llenas = Number(req.body.llenas);
        const vacias = Number(req.body.vacias);
        const precio = Number(req.body.precio);

        if (!Number.isInteger(llenas) || llenas < 0 ||
            !Number.isInteger(vacias) || vacias < 0 ||
            !Number.isFinite(precio) || precio < 0) {
            return res.status(400).json({ error: "Valores inválidos: llenas y vacías deben ser enteros >= 0 y el precio un número >= 0." });
        }

        db.run(
            "UPDATE stock SET llenas = ?, vacias = ?, precio = ? WHERE tipo = ?",
            [llenas, vacias, precio, req.params.tipo],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ mensaje: "Stock actualizado con éxito" });
            }
        );
    });

    return router;
};