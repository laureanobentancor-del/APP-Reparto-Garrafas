// routes/password.js
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const SALT_ROUNDS = 12;
const MINUTOS_VALIDEZ_TOKEN = 30;
const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sha256 = t => crypto.createHash('sha256').update(t).digest('hex');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

const limiteCambio = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados intentos. Probá de nuevo en 15 minutos.' } });
const limiteOlvide = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiadas solicitudes. Probá más tarde.' } });


// Adaptador: usa el MISMO db que el resto de la app (server.js lo pasa),
// sea @libsql/client (db.execute) o sqlite3 (db.all / db.run).
function crearAdaptador(db) {
    if (db && typeof db.execute === 'function') {
        return {
            tipo: 'libsql',
            all: async (sql, args = []) => (await db.execute({ sql, args })).rows,
            run: async (sql, args = []) => ({ changes: (await db.execute({ sql, args })).rowsAffected })
        };
    }
    if (db && typeof db.all === 'function' && typeof db.run === 'function') {
        return {
            tipo: 'sqlite3',
            all: (sql, args = []) => new Promise((ok, no) => {
                const r = db.all(sql, args, (e, rows) => e ? no(e) : ok(rows));
                if (r && typeof r.then === 'function') r.then(ok, no);
            }),
            run: (sql, args = []) => new Promise((ok, no) => {
                const r = db.run(sql, args, function (e) { e ? no(e) : ok({ changes: this.changes }); });
                if (r && typeof r.then === 'function') r.then(v => ok({ changes: (v && (v.changes ?? v.rowsAffected)) || 0 }), no);
            })
        };
    }
    const metodos = db ? Object.getOwnPropertyNames(Object.getPrototypeOf(db)).concat(Object.keys(db)) : [];
    throw new Error('[password] No reconozco la API de database/db.js. Métodos que veo: ' + metodos.join(', '));
}

let dbx; // se asigna al montar el router
async function usuarioDeSesion(req) {
    const s = req.session || {};
    const id = [s.userId, s.usuarioId, s.user_id, s.id, s.usuario && s.usuario.id, s.user && s.user.id]
        .find(v => v !== undefined && v !== null && typeof v !== 'object');
    if (id !== undefined) {
        const rows = await dbx.all('SELECT id, usuario, password FROM usuarios WHERE id = ?', [Number(id)]);
        if (rows[0]) return rows[0];
    }
    const nombre = [typeof s.usuario === 'string' ? s.usuario : null, s.username, s.usuario && s.usuario.usuario, s.user && s.user.usuario]
        .find(v => typeof v === 'string');
    if (nombre) {
        const rows = await dbx.all('SELECT id, usuario, password FROM usuarios WHERE usuario = ?', [nombre]);
        if (rows[0]) return rows[0];
    }
    return null;
}

module.exports = function (db, verificarAutenticacion, verificarAdminSesion) {
    dbx = crearAdaptador(db);
    console.log('[password] Usando la base de datos de la app (' + dbx.tipo + ')');

    // Asegura email + password_resets EN LA MISMA BASE que usa el login (idempotente)
    const listo = (async () => {
        const cols = await dbx.all('PRAGMA table_info(usuarios)');
        if (!cols.some(c => c.name === 'email')) await dbx.run('ALTER TABLE usuarios ADD COLUMN email TEXT');
        await dbx.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email) WHERE email IS NOT NULL');
        await dbx.run(`CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL,
            expira_en TEXT NOT NULL
        )`);
        await dbx.run('CREATE INDEX IF NOT EXISTS idx_resets_token ON password_resets(token_hash)');
    })();
    listo.catch(e => console.error('[password] Error preparando la base:', e));

    const router = express.Router();

    router.put('/api/password/cambiar', verificarAutenticacion, limiteCambio, async (req, res) => {
        try {
            const { actual, nueva } = req.body || {};
            if (typeof actual !== 'string' || typeof nueva !== 'string')
                return res.status(400).json({ error: 'Datos incompletos.' });
            if (!REGEX_PASSWORD.test(nueva))
                return res.status(400).json({ error: 'La nueva contraseña debe tener 8+ caracteres, mayúscula, minúscula y número.' });

            const u = await usuarioDeSesion(req);
            if (!u) return res.status(401).json({ error: 'Sesión no válida.' });

            if (!(await bcrypt.compare(actual, u.password)))
                return res.status(403).json({ error: 'La contraseña actual es incorrecta.' });
            if (await bcrypt.compare(nueva, u.password))
                return res.status(400).json({ error: 'La nueva contraseña debe ser distinta a la actual.' });

            const nuevoHash = await bcrypt.hash(nueva, SALT_ROUNDS);
            const r = await dbx.run('UPDATE usuarios SET password = ? WHERE id = ?', [nuevoHash, u.id]);
            console.log('[cambiar] usuario_id=%s filas modificadas=%s', u.id, r.changes);
            if (r.changes !== 1) throw new Error('El UPDATE no modificó ninguna fila (id=' + u.id + ')');
            const check = await dbx.all('SELECT password FROM usuarios WHERE id = ?', [u.id]);
            if (!check[0] || check[0].password !== nuevoHash)
                throw new Error('Tras el UPDATE, la base devuelve un hash distinto al nuevo (id=' + u.id + ')');
            console.log('[cambiar] OK: contraseña nueva verificada en la base');
            req.session.destroy(() => res.json({ mensaje: 'Contraseña actualizada.' }));
        } catch (err) {
            console.error('Error al cambiar contraseña:', err);
            res.status(500).json({ error: 'Error interno.' });
        }
    });

    router.post('/api/password/olvide', limiteOlvide, async (req, res) => {
        const generica = { mensaje: 'Si el correo está registrado, recibirás un enlace.' };
        try {
            await listo;
            const email = String((req.body || {}).email || '').trim().toLowerCase();
            if (!REGEX_EMAIL.test(email)) return res.json(generica);

            const rows = await dbx.all('SELECT id, usuario, email, bloqueado FROM usuarios WHERE email = ?', [email]);
            const u = rows[0];
            if (u && Number(u.bloqueado) !== 1) {
                const token = crypto.randomBytes(32).toString('hex');
                const expira = new Date(Date.now() + MINUTOS_VALIDEZ_TOKEN * 60000).toISOString();
                await dbx.run('DELETE FROM password_resets WHERE usuario_id = ?', [u.id]);
                await dbx.run('INSERT INTO password_resets (usuario_id, token_hash, expira_en) VALUES (?, ?, ?)', [u.id, sha256(token), expira]);

                await transporter.sendMail({
                    from: process.env.MAIL_FROM || process.env.SMTP_USER,
                    to: u.email,
                    subject: 'Restablecer contraseña - Garrafas App',
                    text: `Hola ${u.usuario},\n\nPara crear una nueva contraseña entrá a este enlace (vence en ${MINUTOS_VALIDEZ_TOKEN} minutos):\n${process.env.APP_URL}/restablecer.html?token=${token}\n\nSi no lo pediste vos, ignorá este correo: tu contraseña no cambiará.`
                });
            }
            res.json(generica);
        } catch (err) {
            console.error('Error en /olvide:', err);
            res.json(generica);
        }
    });

    router.post('/api/password/restablecer', limiteCambio, async (req, res) => {
        try {
            await listo;
            const { token, nueva } = req.body || {};
            if (typeof token !== 'string' || typeof nueva !== 'string')
                return res.status(400).json({ error: 'Datos incompletos.' });
            if (!REGEX_PASSWORD.test(nueva))
                return res.status(400).json({ error: 'La nueva contraseña debe tener 8+ caracteres, mayúscula, minúscula y número.' });

            const rows = await dbx.all('SELECT usuario_id, expira_en FROM password_resets WHERE token_hash = ?', [sha256(token)]);
            const reg = rows[0];
            if (!reg) {
                console.warn('[restablecer] token NO encontrado en password_resets (enlace ya usado, incorrecto o de otra base)');
                return res.status(400).json({ error: 'El enlace es inválido o ya venció. Solicitá uno nuevo.' });
            }
            if (new Date(reg.expira_en) < new Date()) {
                console.warn('[restablecer] token vencido:', reg.expira_en);
                return res.status(400).json({ error: 'El enlace es inválido o ya venció. Solicitá uno nuevo.' });
            }

            const nuevoHash = await bcrypt.hash(nueva, SALT_ROUNDS);
            const r = await dbx.run('UPDATE usuarios SET password = ? WHERE id = ?', [nuevoHash, reg.usuario_id]);
            console.log('[restablecer] usuario_id=%s filas modificadas=%s', reg.usuario_id, r.changes);
            if (r.changes !== 1) throw new Error('El UPDATE no modificó ninguna fila (usuario_id=' + reg.usuario_id + ')');

            // Verificación: leer de nuevo y comprobar que el hash guardado es el nuevo
            const check = await dbx.all('SELECT password FROM usuarios WHERE id = ?', [reg.usuario_id]);
            if (!check[0] || check[0].password !== nuevoHash)
                throw new Error('Tras el UPDATE, la base devuelve un hash distinto al nuevo (usuario_id=' + reg.usuario_id + ')');
            console.log('[restablecer] OK: contraseña nueva verificada en la base');

            await dbx.run('DELETE FROM password_resets WHERE usuario_id = ?', [reg.usuario_id]);
            res.json({ mensaje: 'Contraseña restablecida. Ya podés iniciar sesión.' });
        } catch (err) {
            console.error('Error en /restablecer:', err);
            res.status(500).json({ error: 'No se pudo restablecer la contraseña. Intentá de nuevo.' });
        }
    });

    router.get('/api/password/emails', verificarAutenticacion, verificarAdminSesion, async (req, res) => {
        try {
            await listo;
            const rows = await dbx.all('SELECT id, email FROM usuarios');
            res.json(rows.map(x => ({ id: x.id, email: x.email })));
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Error interno.' });
        }
    });

    router.put('/api/password/email', verificarAutenticacion, verificarAdminSesion, async (req, res) => {
        try {
            await listo;
            const { usuario, email } = req.body || {};
            const limpio = String(email || '').trim().toLowerCase();
            if (typeof usuario !== 'string') return res.status(400).json({ error: 'Datos incompletos.' });
            if (limpio && !REGEX_EMAIL.test(limpio)) return res.status(400).json({ error: 'El correo no es válido.' });

            const r = await dbx.run('UPDATE usuarios SET email = ? WHERE usuario = ?', [limpio || null, usuario]);
            if (r.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
            res.json({ mensaje: 'Email guardado.' });
        } catch (err) {
            if (/UNIQUE/i.test(String(err.message))) return res.status(409).json({ error: 'Ese correo ya está en uso por otro usuario.' });
            console.error(err);
            res.status(500).json({ error: 'Error interno.' });
        }
    });

    return router;
};