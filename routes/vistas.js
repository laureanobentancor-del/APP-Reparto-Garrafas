const express = require('express');
const router = express.Router();
const path = require('path');

// Rutas limpias y con .html soportadas al mismo tiempo
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../pages/index.html'));
});

router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../pages/login.html'));
});

router.get('/clientes', (req, res) => {
    res.sendFile(path.join(__dirname, '../pages/clientes.html'));
});

router.get(['/pedidos', '/pedidos'], (req, res) => {
    res.sendFile(path.join(__dirname, '../pages/pedidos.html'));
});

router.get('/stock',(req, res) => {
    res.sendFile(path.join(__dirname, '../pages/stock.html'));
});

router.get('/ventas', (req, res) => {
    res.sendFile(path.join(__dirname, '../pages/ventas.html'));
});

router.get('/diario', (req, res) => {
    res.sendFile(path.join(__dirname, '../pages/diario.html'));
});

module.exports = router;
