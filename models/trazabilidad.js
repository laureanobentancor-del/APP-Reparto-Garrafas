function registrarTrazabilidad(db, req, accion, detalles) {
    const usuarioId = req.session && req.session.userId ? req.session.userId : null;
    const usuarioNombre = req.session && req.session.usuario ? req.session.usuario : 'Sistema';
    
    const sql = `INSERT INTO trazabilidad (usuario_id, usuario, accion, detalles, fecha) 
                 VALUES (?, ?, ?, ?, DATETIME('now', 'localtime'))`;
                 
    db.run(sql, [usuarioId, usuarioNombre, accion, detalles], (err) => {
        if (err) {
            console.error("Error al registrar trazabilidad:", err.message);
        }
    });
}

module.exports = {
    registrarTrazabilidad
};