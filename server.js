require('dotenv').config();

const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const TursoSessionStore = require('./database/session-store')(session);
const path = require('path');

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    console.error('Falta SESSION_SECRET en el .env. El servidor no arranca sin una clave segura.');
    process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // detrás de Caddy: IP real del cliente (necesario para el límite de intentos)
const PORT = process.env.PORT || 80;

const db = require('./database/db');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'pages')));
// IMPORTANTE: se quitó express.static de 'routes' (exponía el código del backend por HTTP)

app.use(session({
    store: new TursoSessionStore(db.client),
    secret: process.env.SESSION_SECRET || 'solo_para_desarrollo_local_cambiar',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8
    }
}));

// Límite de intentos de login: 10 cada 15 minutos por IP
app.use('/api/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Probá de nuevo en 15 minutos.' }
}));

// Límite general para toda la API
app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones. Esperá un momento.' }
}));

const authModule = require('./routes/auth')(db);
app.use('/', authModule.router); // acá se atiende /api/login y /api/logout

const { verificarAutenticacion, verificarAdminSesion } = authModule;

// ==========================================
// GUARD GLOBAL: todo lo que cuelgue de /api exige sesión iniciada.
// /api/login ya fue atendido arriba por el router de auth, por eso no llega acá.
// Si algún router (ej. password.js) tiene una ruta pública, agregala a esta lista.
// ==========================================
const RUTAS_PUBLICAS = [];
app.use('/api', (req, res, next) => {
    if (RUTAS_PUBLICAS.includes('/api' + req.path)) return next();
    return verificarAutenticacion(req, res, next);
});

const passwordRouter = require('./routes/password')(db, verificarAutenticacion, verificarAdminSesion);
app.use('/', passwordRouter);

const stockRouter = require('./routes/stock')(db, verificarAutenticacion, verificarAdminSesion);
app.use('/', stockRouter);

const clientesRouter = require('./routes/clientes')(db, verificarAutenticacion, verificarAdminSesion);
app.use('/', clientesRouter);

const pedidosRouter = require('./routes/pedidos')(db, verificarAutenticacion);
app.use('/', pedidosRouter);

const ventasRouter = require('./routes/ventas')(db, verificarAutenticacion);
app.use('/', ventasRouter);

const diarioRouter = require('./routes/diario')(db, verificarAutenticacion);
app.use('/', diarioRouter);

const vistasRouter = require('./routes/vistas');
app.use('/', vistasRouter);

const whatsappService = require('./services/whatsapp');
whatsappService.iniciarWhatsApp(db);

// El QR solo lo puede ver un admin con sesión (antes era público)
app.get('/api/whatsapp/qr', verificarAutenticacion, verificarAdminSesion, (req, res) => {
    res.json({ estado: whatsappService.getEstadoWhatsApp(), qr: whatsappService.getQrCodeActual() });
});

app.post('/api/whatsapp/reiniciar', verificarAutenticacion, verificarAdminSesion, async (req, res) => {
    await whatsappService.reiniciarWhatsApp(db);
    res.json({ mensaje: "Ok" });
});

// Columnas nuevas de la tabla pedidos (si ya existen, el error se ignora)
const COLUMNAS_NUEVAS_PEDIDOS = ['observacion TEXT', 'items TEXT', 'pagos TEXT'];

function agregarColumna(definicion) {
    return new Promise((resolve) => {
        db.run('ALTER TABLE pedidos ADD COLUMN ' + definicion, (err) => {
            if (err && !/duplicate column/i.test(err.message)) {
                console.error('Aviso al crear columna (' + definicion + '):', err.message);
            }
            resolve();
        });
    });
}

db.listo.then(async () => {
    for (const col of COLUMNAS_NUEVAS_PEDIDOS) {
        await agregarColumna(col);
    }
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor modular seguro corriendo en http://control-stock-garrafas.local`);
    });
}).catch(() => {
    console.error('El servidor no arranca: no se pudo preparar la base de datos en Turso.');
    process.exit(1);
});
