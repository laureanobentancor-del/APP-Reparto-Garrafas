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

    // 1. LOGOUT
    router.post('/api/logout', verificarAutenticacion, (req, res) => {
        req.session.destroy((err) => {
            if (err) return res.status(500).json({ error: "Error al cerrar la sesión" });
            res.clearCookie('connect.sid'); 
            res.json({ mensaje: "Sesión cerrada con éxito" });
        });
    });

    // 2. LOGIN
    router.post('/api/login', async (req, res) => {
        const { usuario, password } = req.body;
        try {
            // Turso utiliza db.execute con parámetros posicionales (?) o nombrados
            const r = await db.execute({
                sql: `SELECT * FROM usuarios WHERE usuario = ?`,
                args: [usuario]
            });
            
            const user = r.rows[0]; // Las filas devueltas están en el array rows

            if (!user) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
            if (user.bloqueado === 1) return res.status(403).json({ error: "Este usuario se encuentra bloqueado." });

            // Usamos la versión asíncrona basada en Promesas de bcrypt
            const esValida = await bcrypt.compare(password, user.password);
            if (!esValida) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

            req.session.userId = user.id;
            req.session.usuario = user.usuario;
            req.session.rol = user.rol;

            res.json({ id: user.id, usuario: user.usuario, rol: user.rol });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    // 3. OBTENER USUARIOS
    router.get('/api/usuarios', verificarAutenticacion, verificarAdminSesion, async (req, res) => {
        try {
            const r = await db.execute(`SELECT id, usuario, rol, bloqueado FROM usuarios`);
            res.json(r.rows || []);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    // 4. CREAR USUARIO
    router.post('/api/usuarios', verificarAutenticacion, verificarAdminSesion, async (req, res) => {
        const { usuario, password, rol } = req.body;
        if (!password) return res.status(400).json({ error: "La contraseña es obligatoria" });

        const regexPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}\$/;
        if (!regexPassword.test(password)) {
            return res.status(400).json({ error: "La contraseña no es segura. Debe tener al menos 8 caracteres, mayúsculas, minúsculas, números y un carácter especial." });
        }

        try {
            const hash = await bcrypt.hash(password, saltRounds);
            
            const r = await db.execute({
                sql: `INSERT INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)`,
                args: [usuario, hash, rol || 'repartidor']
            });

            // Turso expone el último ID insertado como un BigInt en lastInsertRowId
            const lastID = r.lastInsertRowId ? r.lastInsertRowId.toString() : null;

            res.json({ id: lastID, mensaje: "Usuario creado con éxito" });
        } catch (err) {
            // Manejo de errores por duplicados (ej: UNIQUE constraint failed)
            return res.status(500).json({ error: "El usuario ya existe o hubo un error en el servidor" });
        }
    });

    // 5. BLOQUEAR USUARIO
    router.put('/api/usuarios/:id/bloquear', verificarAutenticacion, verificarAdminSesion, async (req, res) => {
        const { bloqueado } = req.body;
        try {
            await db.execute({
                sql: `UPDATE usuarios SET bloqueado = ? WHERE id = ?`,
                args: [bloqueado, req.params.id]
            });
            res.json({ mensaje: "Estado de bloqueo actualizado" });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    // 6. ELIMINAR USUARIO
    router.delete('/api/usuarios/:id', verificarAutenticacion, verificarAdminSesion, async (req, res) => {
        try {
            await db.execute({
                sql: `DELETE FROM usuarios WHERE id = ?`,
                args: [req.params.id]
            });
            res.json({ mensaje: "Usuario borrado con éxito" });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    return {
        router,
        verificarAutenticacion,
        verificarAdminSesion
    };
};
