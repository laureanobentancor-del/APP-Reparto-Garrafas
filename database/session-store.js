// database/session-store.js — guarda las sesiones de express-session en Turso (reemplaza a connect-sqlite3).
module.exports = function (session) {
    class TursoSessionStore extends session.Store {
        constructor(client, opciones = {}) {
            super();
            this.client = client;
            this.ttl = opciones.ttlMs || 8 * 60 * 60 * 1000;
            this.listo = client.execute('CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expired INTEGER NOT NULL)')
                .then(() => client.execute('CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired)'));
            this.listo.catch(e => console.error('[sesiones] No se pudo preparar la tabla sessions en Turso:', e.message));
            this.limpieza = setInterval(() => {
                this.client.execute({ sql: 'DELETE FROM sessions WHERE expired < ?', args: [Date.now()] }).catch(() => {});
            }, 15 * 60 * 1000);
            this.limpieza.unref();
        }
        _vence(sess) {
            const e = sess && sess.cookie && sess.cookie.expires;
            const t = e ? new Date(e).getTime() : NaN;
            return Number.isFinite(t) ? t : Date.now() + this.ttl;
        }
        _run(fn, cb) { fn().then(v => cb && cb(null, v), e => cb && cb(e)); }

        get(sid, cb) {
            this._run(async () => {
                await this.listo;
                const r = await this.client.execute({ sql: 'SELECT sess FROM sessions WHERE sid = ? AND expired > ?', args: [sid, Date.now()] });
                if (!r.rows[0]) return null;
                try { return JSON.parse(r.rows[0].sess); } catch (e) { return null; }
            }, cb);
        }
        set(sid, sess, cb) {
            this._run(async () => {
                await this.listo;
                await this.client.execute({ sql: 'INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, ?)', args: [sid, JSON.stringify(sess), this._vence(sess)] });
            }, cb);
        }
        touch(sid, sess, cb) {
            this._run(async () => {
                await this.listo;
                await this.client.execute({ sql: 'UPDATE sessions SET expired = ? WHERE sid = ?', args: [this._vence(sess), sid] });
            }, cb);
        }
        destroy(sid, cb) {
            this._run(async () => {
                await this.listo;
                await this.client.execute({ sql: 'DELETE FROM sessions WHERE sid = ?', args: [sid] });
            }, cb);
        }
    }
    return TursoSessionStore;
};
