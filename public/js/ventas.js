'use strict';

let ventasGlobales = [];
let indiceFilaActiva = -1;
let temporizadorMapa = null;

function ventasFiltradas() {
    const texto = ($('buscador-ventas')?.value || '').trim().toLowerCase();
    const desde = $('filtro-ventas-desde')?.value;
    const hasta = $('filtro-ventas-hasta')?.value;

    return ventasGlobales.filter((v) => {
        if (desde || hasta) {
            const fecha = v.fecha ? v.fecha.substring(0, 10) : '';
            if (!fecha) return false;
            if (desde && fecha < desde) return false;
            if (hasta && fecha > hasta) return false;
        }
        if (!texto) return true;
        return [v.cliente_nombre, v.tipo, v.direccion].some((campo) => (campo || '').toLowerCase().includes(texto));
    });
}

function refrescarTablaVentas() {
    renderizarVentas(ventasFiltradas());
}

function renderizarVentas(ventas) {
    const tbody = $('cuerpo-tabla-ventas');
    if (!tbody) return;

    indiceFilaActiva = -1;

    if (ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No se encontraron registros de ventas.</td></tr>';
        actualizarMetricasVentasPorCanal([]);
        return;
    }

    tbody.innerHTML = [...ventas].sort(compararPendientesPrimero).map((v) => '<tr style="' + estiloFila(v) + '">' +
        '<td>#' + v.id + '</td>' +
        '<td><strong>' + (escaparHTML(v.cliente_nombre) || 'Desconocido') + '</strong><br><small>' + escaparHTML(v.cliente_telefono) + '</small></td>' +
        '<td>' + badgeCanal(normalizarCanal(v.tipo_venta)) + '</td>' +
        '<td>' + escaparHTML(v.tipo) + '</td>' +
        '<td>' + v.cantidad + '</td>' +
        '<td style="font-weight: bold; color: #27ae60;">' + dinero(v.total) + '</td>' +
        '<td>' + celdaFormaPago(v) + '</td>' +
        '<td>' + formatoFechaHora(v.fecha) + '</td>' +
        '<td><span style="font-weight:bold; color:#27ae60;">' + escaparHTML(v.estado) + '</span></td>' +
    '</tr>').join('');

    actualizarMetricasVentasPorCanal(ventas);
}

function actualizarMetricasVentasPorCanal(ventas) {
    const canales = acumularCanales(ventas);
    Object.keys(canales).forEach((canal) => {
        setTexto(canal + '-cantidad', canales[canal].cantidad + ' un.');
        setTexto(canal + '-monto', dinero(canales[canal].monto));
        setTexto(canal + '-detalle', textoDetalleCanal(canales[canal]));
    });
}

async function cargarVentas({ actualizarMapa = true } = {}) {
    if (!$('cuerpo-tabla-ventas')) return;

    try {
        const pedidos = await api('/api/pedidos');
        ventasGlobales = pedidos.filter((p) => p.estado === 'Completado');

        const lista = ventasFiltradas();
        renderizarVentas(lista);

        if (actualizarMapa) cuandoSeaVisible(() => inicializarMapaVentas(lista));
    } catch (err) {
        console.error('Error al cargar ventas:', err);
    }
}

window.filtrarVentasTexto = function () {
    const lista = ventasFiltradas();
    renderizarVentas(lista);

    clearTimeout(temporizadorMapa);
    temporizadorMapa = setTimeout(() => inicializarMapaVentas(lista), 600);
};

window.filtrarVentasPorFecha = window.filtrarVentasTexto;

window.limpiarFiltrosVentas = function () {
    ['filtro-ventas-desde', 'filtro-ventas-hasta', 'buscador-ventas'].forEach((id) => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.value = '';
        }
    });
    window.filtrarVentasTexto();
};

function initNavegacionTablaVentas() {
    const contenedor = $('contenedor-tabla-ventas');
    if (!contenedor) return;

    contenedor.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'SELECT') return;

        const filas = $('cuerpo-tabla-ventas').querySelectorAll('tr');
        if (filas.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            indiceFilaActiva = indiceFilaActiva < filas.length - 1 ? indiceFilaActiva + 1 : 0;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            indiceFilaActiva = indiceFilaActiva > 0 ? indiceFilaActiva - 1 : filas.length - 1;
        } else {
            return;
        }

        filas.forEach((fila, idx) => {
            if (idx === indiceFilaActiva) {
                fila.classList.add('fila-seleccionada');
                fila.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                fila.classList.remove('fila-seleccionada');
            }
        });
    });
}

let mapaVentas = null;
let mapaToken = 0;
const CENTRO_NOGOYA = [-32.3947, -59.7894];
const CLAVE_CACHE_GEO = 'geoCacheZonas';

window.centrarMapaNogoya = function () {
    if (mapaVentas) mapaVentas.setView(CENTRO_NOGOYA, 13);
};

function leerCacheGeo() {
    try { return JSON.parse(localStorage.getItem(CLAVE_CACHE_GEO)) || {}; } catch (_) { return {}; }
}

function guardarCacheGeo(cache) {
    try { localStorage.setItem(CLAVE_CACHE_GEO, JSON.stringify(cache)); } catch (_) {}
}

async function geocodificar(direccion) {
    const consulta = encodeURIComponent(direccion + ', Nogoyá, Entre Ríos, Argentina');
    const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + consulta);
    const datos = await res.json();
    if (datos && datos.length > 0) return [parseFloat(datos[0].lat), parseFloat(datos[0].lon)];
    return null;
}

function agruparZonas(ventas) {
    const zonas = {};
    ventas.forEach((v) => {
        if (!v.direccion) return;
        const clave = v.direccion.trim().toLowerCase();
        if (!zonas[clave]) {
            zonas[clave] = { clave, direccionOriginal: v.direccion, cantidadTotal: 0, montoTotal: 0, clientes: new Set() };
        }
        zonas[clave].cantidadTotal += parseInt(v.cantidad) || 0;
        zonas[clave].montoTotal += parseFloat(v.total) || 0;
        if (v.cliente_nombre) zonas[clave].clientes.add(v.cliente_nombre);
    });
    return Object.values(zonas).sort((a, b) => b.cantidadTotal - a.cantidadTotal);
}

function dibujarZona(zona, punto) {
    let color = '#f1c40f';
    let radio = 8;
    if (zona.cantidadTotal >= 10) { color = '#8b0000'; radio = 20; }
    else if (zona.cantidadTotal >= 5) { color = '#c0392b'; radio = 15; }
    else if (zona.cantidadTotal >= 3) { color = '#e67e22'; radio = 11; }

    L.circleMarker(punto, {
        radius: radio,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85
    }).addTo(mapaVentas).bindPopup(
        '<div style="font-size: 13px;">' +
            '<b>Zona / Dirección:</b> ' + escaparHTML(zona.direccionOriginal) + '<br>' +
            '<b>Total Garrafas:</b> ' + zona.cantidadTotal + ' un.<br>' +
            '<b>Recaudado:</b> ' + dinero(zona.montoTotal) + '<br>' +
            '<b>Clientes:</b> ' + escaparHTML(Array.from(zona.clientes).join(', ')) +
        '</div>'
    );
}

async function inicializarMapaVentas(ventas) {
    if (!$('mapa-ventas')) return;

    const token = ++mapaToken;
    const zonas = agruparZonas(ventas);
    renderizarPanelEstadisticasZonas(zonas);

    if (typeof L === 'undefined') return;

    if (mapaVentas) mapaVentas.remove();
    mapaVentas = L.map('mapa-ventas').setView(CENTRO_NOGOYA, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapaVentas);

    const cache = leerCacheGeo();

    for (const zona of zonas) {
        if (token !== mapaToken) return;

        let punto = cache[zona.clave];

        if (!punto) {
            try {
                punto = await geocodificar(zona.direccionOriginal);
                if (punto) {
                    cache[zona.clave] = punto;
                    guardarCacheGeo(cache);
                }
            } catch (err) {
                console.error('Error al geocodificar:', err);
            }
            await esperar(1100);
            if (token !== mapaToken) return;
        }

        if (!punto) {
            punto = [
                CENTRO_NOGOYA[0] + (Math.random() - 0.5) * 0.025,
                CENTRO_NOGOYA[1] + (Math.random() - 0.5) * 0.025
            ];
        }

        dibujarZona(zona, punto);
    }
}

function renderizarPanelEstadisticasZonas(zonas) {
    const panel = $('panel-estadisticas-zonas');
    if (!panel) return;

    if (zonas.length === 0) {
        panel.innerHTML = '<span style="color: #7f8c8d; text-align: center;">No hay datos de zonas para mostrar.</span>';
        return;
    }

    const maximo = zonas[0].cantidadTotal || 1;

    panel.innerHTML = zonas.map((z) => {
        const porcentaje = Math.round((z.cantidadTotal / maximo) * 100);
        let colorBarra = '#f1c40f';
        if (z.cantidadTotal >= 5) colorBarra = '#c0392b';
        else if (z.cantidadTotal >= 3) colorBarra = '#e67e22';

        return '<div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 10px;">' +
            '<div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px; color: #2c3e50;">' +
                '<span>📍 ' + escaparHTML(z.direccionOriginal) + '</span>' +
                '<span style="color: #27ae60;">' + z.cantidadTotal + ' un. (' + dinero(z.montoTotal) + ')</span>' +
            '</div>' +
            '<div style="background: #e1e8ed; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;">' +
                '<div style="background: ' + colorBarra + '; width: ' + porcentaje + '%; height: 100%; transition: width 0.4s;"></div>' +
            '</div>' +
        '</div>';
    }).join('');
}

function initVentas() {
    if (!$('cuerpo-tabla-ventas')) return;
    initNavegacionTablaVentas();
    cargarVentas();
}