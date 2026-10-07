require('dotenv').config();

const express = require('express');
const session = require('express-session');
const TursoSessionStore = require('./database/session-store')(session);
const path = require('path');

// Bloqueante: Abortar si falta el secreto de sesión
if (!process.env.SESSION_SECRET) {
    console.error('CRÍTICO: Falta SESSION_SECRET en el archivo .env. Abortando arranque por seguridad.');
    process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // detrás de Caddy: IP real del cliente (necesario para el límite de intentos)
const PORT = process.env.PORT || 80;

const db = require('./database/db'); 

app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'pages')));
// ELIMINADO: app.use(express.static(path.join(__dirname, 'routes'))); -> Previene exposición de código

app.use(session({
    store: new TursoSessionStore(db.client),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        httpOnly: true, 
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8 
    }
}));

const authModule = require('./routes/auth')(db);
app.use('/', authModule.router);

const { verificarAutenticacion, verificarAdminSesion } = authModule;

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

// CORREGIDO: Ruta protegida para administradores
app.get('/api/whatsapp/qr', verificarAutenticacion, verificarAdminSesion, (req, res) => {
    res.json({ estado: whatsappService.getEstadoWhatsApp(), qr: whatsappService.getQrCodeActual() });
});

app.post('/api/whatsapp/reiniciar', verificarAutenticacion, verificarAdminSesion, async (req, res) => {
    await whatsappService.reiniciarWhatsApp(db);
    res.json({ mensaje: "Ok" });
});

db.listo.then(() => {
    // Al usar '0.0.0.0', permites que Docker exponga el puerto hacia afuera
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
    });
}).catch(() => {
    console.error('El servidor no arranca: no se pudo preparar la base de datos en Turso.'); //[cite: 2]
    process.exit(1); 
});