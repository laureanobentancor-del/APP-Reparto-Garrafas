'use strict';

const $ = (id) => document.getElementById(id);

function setTexto(id, texto) {
    const el = $(id);
    if (el) el.textContent = texto;
}

function dinero(n) {
    return '$' + (Number(n) || 0).toLocaleString();
}

function fechaLocalISO() {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    // getMonth() devuelve 0-11, por lo que sumamos 1. 
    // String().padStart(2, '0') asegura que tenga 2 dígitos (ej: "05" en vez de "5").
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');

    // Retorna estrictamente en formato yyyy-MM-dd
    return `${anio}-${mes}-${dia}`;
}


'use strict';

function escaparHTML(valor) {
    // CORREGIDO: Mapeo real a entidades HTML seguras
    var mapa = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    var textoSeguro = (valor !== null && valor !== undefined) ? String(valor) : '';
    return textoSeguro.replace(/[&<>"']/g, function(c) {
        return mapa[c];
    });
}

function esperar(ms) {
    return new Promise((resolver) => setTimeout(resolver, ms));
}

function onListo(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
}

function cuandoSeaVisible(fn) {
    if (document.prerendering) {
        document.addEventListener('prerenderingchange', fn, { once: true });
    } else {
        fn();
    }
}

async function api(url, opciones = {}) {
    const config = { credentials: 'same-origin', ...opciones };

    if (config.body && typeof config.body !== 'string') {
        config.body = JSON.stringify(config.body);
        config.headers = { 'Content-Type': 'application/json', ...(config.headers || {}) };
    }

    const res = await fetch(url, config);

    const sesionVencida = res.status === 401 || (res.redirected && res.url.includes('login'));
    if (sesionVencida) {
        localStorage.removeItem('usuarioLogueado');
        if (!location.pathname.includes('login')) location.href = '/login.html';
        throw new Error('Sesión expirada');
    }

    let datos = null;
    try { datos = await res.json(); } catch (_) {}

    if (!res.ok) throw new Error((datos && datos.error) || `Error ${res.status}`);
    return datos;
}

function mostrarModal(id) {
    const modal = $(id);
    if (modal) modal.style.display = 'flex';
}

function ocultarModal(id) {
    const modal = $(id);
    if (modal) modal.style.display = 'none';
}

const CANALES = {
    deposito:  { texto: '🏭 Depósito',  color: '#3498db' },
    reparto:   { texto: '🚚 Reparto',   color: '#e67e22' },
    comercios: { texto: '🏪 Comercios', color: '#9b59b6' }
};

const ICONOS_PAGO = {
    'Efectivo':      '💵 Efectivo',
    'Mercado Pago':  '📱 Mercado Pago',
    'Transferencia': '🏦 Transferencia',
    'Pendiente':     '⏳ Pendiente'
};

function normalizarCanal(valor) {
    const canal = (valor || '').trim().toLowerCase();
    return CANALES[canal] ? canal : 'deposito';
}

function normalizarPago(valor) {
    return valor ? String(valor).trim() : 'Efectivo';
}

function badgeCanal(canal, chico = false) {
    const c = CANALES[canal];
    const estilo = chico ? 'padding: 2px 6px; font-size: 0.8em;' : 'padding: 3px 8px; font-size: 0.85em;';
    return '<span style="background: ' + c.color + '; color: white; ' + estilo + ' border-radius: 4px; font-weight: bold;">' + c.texto + '</span>';
}

function formatoFechaHora(fecha) {
    if (!fecha) return '';
    return fecha.substring(0, 10) + ' ' + fecha.substring(11, 16);
}

function canalesVacios() {
    const vacio = () => ({ cantidad: 0, monto: 0, c10: 0, c15: 0, c30: 0, c45: 0 });
    return { deposito: vacio(), reparto: vacio(), comercios: vacio() };
}

function sumarPorTipo(acumulador, tipo, cantidad) {
    const clave = { '10kg': 'c10', '15kg': 'c15', '30kg': 'c30', '45kg': 'c45' }[(tipo || '').trim()];
    if (clave) acumulador[clave] += cantidad;
}

function acumularCanales(pedidos) {
    const canales = canalesVacios();
    pedidos.forEach((p) => {
        const canal = canales[normalizarCanal(p.tipo_venta)];
        const cantidad = parseInt(p.cantidad) || 0;
        canal.cantidad += cantidad;
        canal.monto += parseFloat(p.total) || 0;
        sumarPorTipo(canal, p.tipo, cantidad);
    });
    return canales;
}

function textoDetalleCanal(c) {
    return '10kg: ' + c.c10 + ' | 15kg: ' + c.c15 + ' | 30kg: ' + c.c30 + ' | 45kg: ' + c.c45;
}

const PAGOS_COBRADOS = ['efectivo', 'mercado pago', 'transferencia'];

function esPagoPendiente(valor) {
    return !PAGOS_COBRADOS.includes(normalizarPago(valor).toLowerCase());
}

function tienePendientes(pedido) {
    return (pedido.estado || '').trim() === 'Pendiente' || esPagoPendiente(pedido.forma_pago);
}

function compararPendientesPrimero(a, b) {
    const pa = tienePendientes(a);
    const pb = tienePendientes(b);
    if (pa !== pb) return pa ? -1 : 1;

    if (pa && pb) {
        const fa = a.fecha ? new Date(a.fecha).getTime() : 0;
        const fb = b.fecha ? new Date(b.fecha).getTime() : 0;
        if (fa !== fb) return fa - fb;
    }
    return b.id - a.id;
}

function estiloFila(pedido) {
    return tienePendientes(pedido) ? 'background: #fff4e5;' : '';
}

function celdaFormaPago(pedido) {
    const pago = normalizarPago(pedido.forma_pago);

    if (!esPagoPendiente(pago)) {
        const clave = Object.keys(ICONOS_PAGO).find((k) => k.toLowerCase() === pago.toLowerCase());
        return '<span style="font-weight: bold; color: #27ae60;">' + (ICONOS_PAGO[clave] || escaparHTML(pago)) + '</span>';
    }

    return '<select onchange="cambiarFormaPago(' + pedido.id + ', this.value)" style="padding: 4px; border: 2px solid #e67e22; border-radius: 4px; font-weight: bold;">' +
           '<option value="Pendiente" selected>⏳ Pendiente</option>' +
           '<option value="Efectivo">💵 Efectivo</option>' +
           '<option value="Mercado Pago">📱 Mercado Pago</option>' +
           '<option value="Transferencia">🏦 Transferencia</option>' +
           '</select>';
}

function refrescarTablasSinRecargar() {
    if ($('cuerpo-tabla-ventas')) refrescarTablaVentas();
    if ($('cuerpo-tabla-pedidos')) renderizarPedidos(pedidosGlobales);
}

window.cambiarFormaPago = async function (id, forma) {
    if (forma === 'Pendiente') return;

    if (!confirm('¿Marcar este pedido como pagado con ' + forma + '?')) {
        refrescarTablasSinRecargar();
        return;
    }

    try {
        await api('/api/pedidos/' + id + '/pago', { method: 'PUT', body: { forma_pago: forma } });
        if ($('cuerpo-tabla-ventas')) await cargarVentas({ actualizarMapa: false });
        if ($('cuerpo-tabla-pedidos')) await cargarPedidos();
    } catch (err) {
        alert(err.message || 'No se pudo actualizar la forma de pago');
        refrescarTablasSinRecargar();
    }
};

function hayListaAbierta() {
    const activo = document.activeElement;
    return !!(activo && activo.tagName === 'SELECT' && activo.closest('tbody'));
}