// alertas.js — Alertas tempranas para Express (Node 18+, sin dependencias extra)
//
// USO en tu app.js:
//
//   const express = require('express');
//   const alertas = require('./alertas');
//   const app = express();
//
//   alertas.instalar(app);          // ANTES de tus rutas
//
//   app.post('/login', (req, res) => {
//     const ok = verificarCredenciales(req.body);   // tu lógica
//     if (!ok) alertas.loginFallido(req.ip, req.body.usuario);
//     ...
//   });
//
//   app.use(alertas.manejadorErrores);   // DESPUÉS de tus rutas
//   app.listen(3000);
//
// Variables de entorno necesarias:
//   TELEGRAM_TOKEN   (lo da @BotFather)
//   TELEGRAM_CHAT_ID (tu id de chat con el bot)

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ---- Configuración ----
const LIMITE_LENTITUD_MS = 3000;          // respuesta más lenta que esto = alerta
const MAX_LOGINS_FALLIDOS = 5;            // intentos fallidos permitidos...
const VENTANA_LOGIN_MS = 10 * 60 * 1000;  // ...dentro de esta ventana (10 min)
const ENFRIAMIENTO_MS = 10 * 60 * 1000;   // no repetir la misma alerta antes de 10 min

// ---- Envío de alertas (con anti-spam) ----
const ultimoAviso = new Map();

async function alertar(clave, mensaje) {
  const ahora = Date.now();
  if (ahora - (ultimoAviso.get(clave) || 0) < ENFRIAMIENTO_MS) return;
  ultimoAviso.set(clave, ahora);

  console.warn('[ALERTA]', mensaje);
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: mensaje }),
    });
  } catch (e) {
    console.error('No se pudo enviar la alerta:', e.message);
  }
}

// ---- Monitoreo de lentitud y errores 5xx ----
function monitor(req, res, next) {
  const inicio = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - inicio;
    const ruta = `${req.method} ${req.path}`;
    if (res.statusCode >= 500) {
      alertar(`5xx:${ruta}`, `🔴 Error ${res.statusCode} en ${ruta}`);
    } else if (ms > LIMITE_LENTITUD_MS) {
      alertar(`lento:${ruta}`, `🟡 Lentitud: ${ruta} tardó ${ms} ms`);
    }
  });
  next();
}

// ---- Accesos sospechosos: logins fallidos repetidos ----
const intentos = new Map(); // ip -> [timestamps]

function loginFallido(ip, usuario = 'desconocido') {
  const ahora = Date.now();
  const recientes = (intentos.get(ip) || []).filter(t => ahora - t < VENTANA_LOGIN_MS);
  recientes.push(ahora);
  intentos.set(ip, recientes);

  if (recientes.length >= MAX_LOGINS_FALLIDOS) {
    alertar(
      `login:${ip}`,
      `🚨 Posible ataque: ${recientes.length} logins fallidos desde ${ip} (último usuario: ${usuario})`
    );
  }
}

// Limpieza periódica para no acumular memoria
setInterval(() => {
  const ahora = Date.now();
  for (const [ip, ts] of intentos) {
    const vigentes = ts.filter(t => ahora - t < VENTANA_LOGIN_MS);
    vigentes.length ? intentos.set(ip, vigentes) : intentos.delete(ip);
  }
}, 60 * 1000).unref();

// ---- Manejador de errores de Express (ponelo después de las rutas) ----
function manejadorErrores(err, req, res, next) {
  alertar(`exc:${err.message}`, `🔴 Excepción en ${req.method} ${req.path}: ${err.message}`);
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

// ---- Instalación ----
function instalar(app, conexionDb) {
  app.use(monitor);

  // Endpoint para que UptimeRobot / Better Stack lo consulten.
  app.get('/health', async (req, res) => {
    try {
      if (conexionDb) {
        await conexionDb.execute('SELECT 1'); // Comprobación rápida de Turso si se pasa
        res.json({ ok: true, db: 'conectada', uptime: process.uptime() });
      } else {
        res.json({ ok: true, uptime: process.uptime() });
      }
    } catch (e) {
      res.status(500).json({ ok: false, db: 'caida', error: e.message });
    }
  });
    }

  // Errores que tumban el proceso
  process.on('unhandledRejection', (motivo) => {
    alertar('unhandled', `🔴 unhandledRejection: ${motivo}`);
  });
  process.on('uncaughtException', async (err) => {
    ultimoAviso.delete('uncaught'); // aseguramos que este aviso salga siempre
    await alertar('uncaught', `💥 Proceso caído por excepción: ${err.message}`);
    process.exit(1); // dejá que PM2/systemd/Docker lo reinicie
  });


module.exports = { instalar, alertar, loginFallido, manejadorErrores };
