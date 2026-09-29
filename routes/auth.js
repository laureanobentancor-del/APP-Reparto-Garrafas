const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const saltRounds = 10;

// ==========================================
// MIDDLEWARES DE AUTENTICACIÓN
// ==========================================
function verificarAutenticacion(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({ error: "No autorizado. Inicie sesión nuevamente." });
}

function verificarAdminSesion(req, res, next) {
    if (req.session && req.session.rol === 'admin') {
        return next();
    }
    return res.status(403).json({ error: "Acceso denegado. Se requieren permisos de administrador." });
}

module.exports = function(db) {

    // Rutas de autenticación y usuarios...
    router.post('/api/logout', verificarAutenticacion, (req, res) => {
        req.session.destroy((err) => {
            if (err) return res.status(500).json({ error: "Error al cerrar la sesión" });
            res.clearCookie('connect.sid'); 
            res.json({ mensaje: "Sesión cerrada con éxito" });
        });
    });

    router.post('/api/login', (req, res) => {
        const { usuario, password } = req.body;
        db.get(`SELECT * FROM usuarios WHERE usuario = ?`, [usuario], (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
            if (user.bloqueado === 1) return res.status(403).json({ error: "Este usuario se encuentra bloqueado." });

            bcrypt.compare(password, user.password, (err, esValida) => {
                if (err) return res.status(500).json({ error: "Error al validar la contraseña" });
                if (!esValida) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

                req.session.userId = user.id;
                req.session.usuario = user.usuario;
                req.session.rol = user.rol;

                res.json({ id: user.id, usuario: user.usuario, rol: user.rol });
            });
        });
    });

    router.get('/api/usuarios', verificarAutenticacion, verificarAdminSesion, (req, res) => {
        db.all(`SELECT id, usuario, rol, bloqueado FROM usuarios`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    });

    router.post('/api/usuarios', verificarAutenticacion, verificarAdminSesion, (req, res) => {
        const { usuario, password, rol } = req.body;
        if (!password) return res.status(400).json({ error: "La contraseña es obligatoria" });

        const regexPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!regexPassword.test(password)) {
            return res.status(400).json({ error: "La contraseña no es segura. Debe tener al menos 8 caracteres, mayúsculas, minúsculas, números y un carácter especial." });
        }

        bcrypt.hash(password, saltRounds, (err, hash) => {
            if (err) return res.status(500).json({ error: "Error al encriptar la contraseña" });
            db.run(`INSERT INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)`, 
                [usuario, hash, rol || 'repartidor'], 
                function(err) {
                    if (err) return res.status(500).json({ error: "El usuario ya existe o hubo un error" });
                    res.json({ id: this.lastID, mensaje: "Usuario creado con éxito" });
                }
            );
        });
    });

    router.put('/api/usuarios/:id/bloquear', verificarAutenticacion, verificarAdminSesion, (req, res) => {
        const { bloqueado } = req.body;
        db.run(`UPDATE usuarios SET bloqueado = ? WHERE id = ?`, [bloqueado, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ mensaje: "Estado de bloqueo actualizado" });
        });
    });

    router.delete('/api/usuarios/:id', verificarAutenticacion, verificarAdminSesion, (req, res) => {
        db.run(`DELETE FROM usuarios WHERE id = ?`, [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ mensaje: "Usuario borrado con éxito" });
        });
    });

    // Exportamos el router y las funciones de middleware por separado
    return {
        router,
        verificarAutenticacion,
        verificarAdminSesion
    };
};