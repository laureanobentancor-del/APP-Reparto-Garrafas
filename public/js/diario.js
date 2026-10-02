'use strict';

let todosLosPedidosDiario = [];

window.cargarLibroDiario = async function () {
    try {
        todosLosPedidosDiario = await api('/api/pedidos');
        filtrarYRenderizarDiario();
    } catch (err) {
        console.error('Error al cargar datos para el libro diario:', err);
    }
};

function fijarRangoDiario(desde, hasta) {
    const inputDesde = $('filtro-diario-desde');
    const inputHasta = $('filtro-diario-hasta');

    // Usa la fecha local en formato ISO correcto o un valor por defecto seguro
    const fechaActual = fechaLocalISO();

    if (inputDesde) {
        inputDesde.value = desde ? desde : fechaActual;
    }
    if (inputHasta) {
        inputHasta.value = hasta ? hasta : fechaActual;
    }
}


window.ponerDiaHoy = function () {
    const buscador = document.getElementById('buscador-diario');
    if (buscador) {
        buscador.value = '';
    }
    const hoy = fechaLocalISO();
    fijarRangoDiario(hoy, hoy);
    filtrarYRenderizarDiario();
};
window.filtrarDiarioHoy = window.ponerDiaHoy;

window.cambiarDia = function (dias) {
    const inputDesde = $('filtro-diario-desde');
    if (!inputDesde) return;

    const base = inputDesde.value ? new Date(inputDesde.value + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + dias);

    const nuevaFecha = fechaLocalISO(base);
    fijarRangoDiario(nuevaFecha, nuevaFecha);
    filtrarYRenderizarDiario();
};

window.limpiarFiltrosDiario = function () {
    fijarRangoDiario('', '');
    
    const buscador = document.getElementById('buscador-diario');
    if (buscador) {
        buscador.value = '';
    }
    
    const canal = document.getElementById('filtro-diario-canal');
    if (canal) {
        canal.value = 'todos';
    }
    
    filtrarYRenderizarDiario();
};

window.filtrarDiarioPorFecha = () => filtrarYRenderizarDiario();
window.filtrarDiarioTexto = () => filtrarYRenderizarDiario();
window.filtrarDiarioPorCanal = () => filtrarYRenderizarDiario();

function filtrarYRenderizarDiario() {
    const tbody = $('cuerpo-tabla-diario');
    if (!tbody) return;

    const desde = $('filtro-diario-desde')?.value;
    const hasta = $('filtro-diario-hasta')?.value;
    const texto = ($('buscador-diario')?.value || '').toLowerCase();
    const canalSeleccionado = $('filtro-diario-canal')?.value || 'todos';

    const pedidos = todosLosPedidosDiario.filter((p) => {
        if (!p.fecha) return false;
        const fecha = p.fecha.substring(0, 10);
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;

        if (canalSeleccionado !== 'todos' && normalizarCanal(p.tipo_venta) !== canalSeleccionado) return false;

        if (texto) {
            const cliente = (p.cliente_nombre || '').toLowerCase();
            const tipo = (p.tipo || '').toLowerCase();
            const idStr = String(p.id || '');
            if (!cliente.includes(texto) && !tipo.includes(texto) && !idStr.includes(texto)) return false;
        }
        return true;
    });

    const totales = { cobrado: 0, efectivo: 0, mp: 0, transf: 0, pendiente: 0, unidades: 0, c10: 0, c15: 0, c30: 0, c45: 0 };

    pedidos.forEach((p) => {
        const monto = parseFloat(p.total) || 0;
        const cantidad = parseInt(p.cantidad) || 0;
        const pago = normalizarPago(p.forma_pago);

        totales.unidades += cantidad;
        sumarPorTipo(totales, p.tipo, cantidad);

        if (pago === 'Efectivo') { totales.efectivo += monto; totales.cobrado += monto; }
        else if (pago === 'Mercado Pago') { totales.mp += monto; totales.cobrado += monto; }
        else if (pago === 'Transferencia') { totales.transf += monto; totales.cobrado += monto; }
        else { totales.pendiente += monto; }
    });

    if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No hay movimientos para el período seleccionado.</td></tr>';
    } else {
        tbody.innerHTML = pedidos.map((p) => '<tr>' +
            '<td>' + formatoFechaHora(p.fecha) + '</td>' +
            '<td><strong>' + (escaparHTML(p.cliente_nombre) || 'Desconocido') + '</strong><br><small>' + escaparHTML(p.cliente_telefono) + '</small></td>' +
            '<td>' + badgeCanal(normalizarCanal(p.tipo_venta), true) + '</td>' +
            '<td>' + escaparHTML(p.tipo) + '</td>' +
            '<td>' + (parseInt(p.cantidad) || 0) + '</td>' +
            '<td style="font-weight: bold; color: #27ae60;">' + dinero(p.total) + '</td>' +
            '<td>' + escaparHTML(normalizarPago(p.forma_pago)) + '</td>' +
            '<td>' + (p.estado === 'Completado' ? 'Completado' : 'Pendiente') + '</td>' +
        '</tr>').join('');
    }

    actualizarMetricasDiario(totales, acumularCanales(pedidos));
}

function actualizarMetricasDiario(t, canales) {
    setTexto('diario-total-cobrado', dinero(t.cobrado));
    setTexto('diario-efectivo', dinero(t.efectivo));
    setTexto('diario-mp', dinero(t.mp));
    setTexto('diario-transf', dinero(t.transf));
    setTexto('diario-pendiente', dinero(t.pendiente));

    setTexto('diario-total-unidades', t.unidades + ' un.');
    setTexto('diario-g10', t.c10 + ' un.');
    setTexto('diario-g15', t.c15 + ' un.');
    setTexto('diario-g30', t.c30 + ' un.');
    setTexto('diario-g45', t.c45 + ' un.');

    Object.keys(canales).forEach((canal) => {
        setTexto('diario-' + canal + '-cant', canales[canal].cantidad + ' un.');
        setTexto('diario-' + canal + '-monto', dinero(canales[canal].monto));
        setTexto('diario-' + canal + '-det', textoDetalleCanal(canales[canal]));
    });
}

function initDiario() {
    if (!$('cuerpo-tabla-diario')) return;
    const hoy = fechaLocalISO();
    fijarRangoDiario(hoy, hoy);
    window.cargarLibroDiario();
}