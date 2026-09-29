const express = require('express');
const router = express.Router();

// Nota: Cuando integres este módulo con tu servidor principal, 
// puedes exportarlo pasando la base de datos 'db' como parámetro, 
// o bien requerir tu archivo 'db.js' centralizado.

module.exports = function(db, verificarAutenticacion, verificarAdminSesion) {

    // Obtener todo el stock
    router.get('/api/stock', (req, res) => {
        db.all("SELECT * FROM stock", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    });

    // Actualizar stock por tipo (Solo Administradores)
    router.put('/api/stock/:tipo', verificarAutenticacion, verificarAdminSesion, (req, res) => {
        const { llenas, vacias, precio } = req.body;
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