require('dotenv').config();

const express = require('express');
const session = require('express-session');
const TursoSessionStore = require('./database/session-store')(session);
const path = require('path');

const app = express();
app.set('trust proxy', 1); // detrás de Caddy: IP real del cliente (necesario para el límite de intentos)
const PORT = process.env.PORT || 80;

const db = require('./database/db'); 

app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'pages')));
app.use(express.static(path.join(__dirname, 'routes')));

app.use(session({
    store: new TursoSessionStore(db.client),
    secret: process.env.SESSION_SECRET || 'una_clave_secreta_muy_segura_para_firmar_la_cookie',
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

app.get('/api/whatsapp/qr', (req, res) => {
    res.json({ estado: whatsappService.getEstadoWhatsApp(), qr: whatsappService.getQrCodeActual() });
});

app.post('/api/whatsapp/reiniciar', verificarAutenticacion, verificarAdminSesion, async (req, res) => {
    await whatsappService.reiniciarWhatsApp(db);
    res.json({ mensaje: "Ok" });
});

db.listo.then(() => {
    app.listen(PORT, '127.0.0.1', () => {
        console.log(`🚀 Servidor modular seguro corriendo en http://control-stock-garrafas.local`);
    });
}).catch(() => {
    console.error('El servidor no arranca: no se pudo preparar la base de datos en Turso.');
    process.exit(1);
});