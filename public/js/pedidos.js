'use strict';

let pedidosGlobales = [];
let filtroHoyActivo = false;
let preciosStock = {};

const TIPOS_GARRAFA = ['10kg', '15kg', '30kg', '45kg'];
const METODOS_PAGO = [
    ['Efectivo', '💵 Efectivo'],
    ['Mercado Pago', '📱 Mercado Pago'],
    ['Transferencia', '🏦 Transferencia'],
    ['Pendiente', '⏳ Pendiente de Pago']
];

function escaparHTML(valor) {
    var mapa = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    var textoSeguro = (valor !== null && valor !== undefined) ? String(valor) : '';
    return textoSeguro.replace(/[&<>"']/g, function (c) { return mapa[c]; });
}

/* ============ Helpers de datos ============ */

function itemsDePedido(p) {
    try {
        const arr = JSON.parse(p.items);
        if (Array.isArray(arr) && arr.length) return arr;
    } catch (e) { /* pedido viejo sin items */ }
    const cant = parseInt(p.cantidad) || 1;
    return [{ tipo: p.tipo, cantidad: cant, precio: (parseFloat(p.total) || 0) / cant }];
}

function pagosDePedido(p) {
    try {
        const arr = JSON.parse(p.pagos);
        if (Array.isArray(arr) && arr.length) return arr;
    } catch (e) { /* pedido viejo sin pagos */ }
    return [{ metodo: p.forma_pago || 'Efectivo', monto: parseFloat(p.total) || 0 }];
}

async function cargarPreciosStock() {
    const stock = await api('/api/stock');
    preciosStock = {};
    stock.forEach((s) => { preciosStock[s.tipo] = s.precio; });
}

/* ============ Panel de control diario ============ */

const CANALES_PANEL = [['deposito', 'Depósito'], ['reparto', 'Reparto'], ['comercios', 'Comercios']];

async function actualizarResumenPanelPedidos() {
    const elFecha = $('dash-fecha');
    if (elFecha) {
        elFecha.textContent = '📅 ' + new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    let tipos = TIPOS_GARRAFA.slice();

    try {
        const stock = await api('/api/stock');
        tipos = stock.map((s) => s.tipo);
        const elStock = $('dash-stock');
        if (elStock) {
            elStock.innerHTML = stock.map((s) =>
                '<div class="dash-fila-stock">' +
                    '<span class="dash-tipo">' + escaparHTML(s.tipo) + '</span>' +
                    '<span class="dash-stock-vals">' +
                        '<span class="dash-verde">🟢 ' + escaparHTML(s.llenas) + '</span>' +
                        '<span class="dash-naranja">🟠 ' + escaparHTML(s.vacias) + '</span>' +
                    '</span>' +
                '</div>'
            ).join('');
        }
    } catch (err) {
        console.error('Error al cargar stock para el panel:', err);
    }

    try {
        const pedidos = await api('/api/pedidos/hoy');
        const porMetodo = { 'Efectivo': 0, 'Mercado Pago': 0, 'Transferencia': 0 };
        const porTipo = {};
        const montoPorTipo = {};
        const porCanal = {};
        let unidades = 0, cobrado = 0, pendiente = 0;

        pedidos.forEach((p) => {
            const cant = parseInt(p.cantidad) || 0;
            unidades += cant;

            itemsDePedido(p).forEach((i) => {
                const cantItem = parseInt(i.cantidad) || 0;
                porTipo[i.tipo] = (porTipo[i.tipo] || 0) + cantItem;
                montoPorTipo[i.tipo] = (montoPorTipo[i.tipo] || 0) + cantItem * (parseFloat(i.precio) || 0);
            });

            const canal = normalizarCanal(p.tipo_venta);
            porCanal[canal] = porCanal[canal] || { un: 0, total: 0 };
            porCanal[canal].un += cant;
            porCanal[canal].total += parseFloat(p.total) || 0;

            pagosDePedido(p).forEach((x) => {
                const monto = parseFloat(x.monto) || 0;
                if (esPagoPendiente(x.metodo)) {
                    pendiente += monto;
                } else {
                    cobrado += monto;
                    if (porMetodo[x.metodo] !== undefined) porMetodo[x.metodo] += monto;
                }
            });
        });

        setTexto('dash-cobrado', dinero(cobrado));
        setTexto('dash-efectivo', dinero(porMetodo['Efectivo']));
        setTexto('dash-mp', dinero(porMetodo['Mercado Pago']));
        setTexto('dash-transf', dinero(porMetodo['Transferencia']));
        setTexto('dash-pendiente', dinero(pendiente));
        setTexto('dash-vendidas', unidades + ' un.');

        // tipos del stock + cualquier tipo vendido que no esté en el stock
        const listaTipos = [...new Set([...tipos, ...Object.keys(porTipo)])];
        const elTipos = $('dash-tipos');
        if (elTipos) {
            elTipos.innerHTML = listaTipos.map((t) =>
                '<div class="dash-mini dash-mini-tipo">' +
                    '<div class="dash-mini-fila">' +
                        '<span class="dash-etq-mini">' + escaparHTML(t) + '</span>' +
                        '<strong>' + (porTipo[t] || 0) + ' un.</strong>' +
                    '</div>' +
                    '<span class="dash-val-mini dash-verde">' + dinero(montoPorTipo[t] || 0) + '</span>' +
                '</div>'
            ).join('');
        }

        const elCanales = $('dash-canales');
        if (elCanales) {
            elCanales.innerHTML = CANALES_PANEL.map((c) => {
                const d = porCanal[c[0]] || { un: 0, total: 0 };
                return '<span>' + c[1] + ': ' + d.un + ' un. (' + dinero(d.total) + ')</span>';
            }).join('');
        }
    } catch (err) {
        console.error('Error al cargar resumen de ventas de hoy:', err);
    }
}

/* ============ Tabla ============ */
function renderizarPedidos(pedidos) {
    const tbody = $('cuerpo-tabla-pedidos');
    if (!tbody) return;

    if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No se encontraron pedidos registrados.</td></tr>';
        return;
    }

    const ordenados = [...pedidos].sort(compararPendientesPrimero);

    tbody.innerHTML = ordenados.map((p) => {
        // 1. Botones de acción más pequeños y limpios
        const botonesAccion = 
            '<div class="btn-group btn-group-sm" role="group">' +
                '<button class="btn btn-outline-secondary py-0 px-1" title="Ver Detalle" onclick="verDetallePedido(' + p.id + ')">👁️</button>' +
                '<button class="btn btn-outline-primary py-0 px-1" title="Editar" onclick="editarPedido(' + p.id + ')">✏️</button>' +
                '<button class="btn btn-outline-danger py-0 px-1" title="Borrar" onclick="borrarPedido(' + p.id + ')">🗑️</button>' +
            '</div>';

        // 2. Estado interactivo compacto
        const esCompletado = p.estado === 'Completado';
        const columnaEstado = '<span class="badge ' + (esCompletado ? 'bg-success' : 'bg-warning text-dark') + '" ' +
            'style="cursor:pointer; font-size: 0.75rem;" ' +
            'onclick="cambiarEstado(' + p.id + ', \'' + escaparHTML(p.estado) + '\')" ' +
            'title="Hacer clic para cambiar estado">' +
            (esCompletado ? '✔ OK' : '⏳ Pend.') + '</span>';

        // 3. Resumen de items compacto
        const items = itemsDePedido(p);
        const resumenItemsTxt = items.map(i => i.cantidad + 'x ' + i.tipo).join(', ');

       // 4. Íconos y estados inteligentes para formas de pago y pendientes parciales
        const pagos = pagosDePedido(p);
        let htmlPago = '';
        
        if (pagos.length > 1) {
            // Verificar si dentro del pago mixto hay algún monto pendiente
            const tienePendiente = pagos.some(x => esPagoPendiente(x.metodo));
            if (tienePendiente) {
                const montoPendiente = pagos.filter(x => esPagoPendiente(x.metodo)).reduce((a, b) => a + b.monto, 0);
                htmlPago = '<span class="badge bg-warning text-dark" title="Pago Mixto con Saldo Pendiente">⚠️ Mixto (Debe ' + dinero(montoPendiente) + ')</span>';
            } else {
                htmlPago = '<span class="badge bg-info text-dark" title="Pago Mixto Completado">🔀 Mixto</span>';
            }
        } else {
            const metodo = (p.forma_pago || 'Efectivo').trim();
            const iconosPagoMap = {
                'Efectivo': '<span title="Efectivo">💵</span>',
                'Mercado Pago': '<span title="Mercado Pago">📱</span>',
                'Transferencia': '<span title="Transferencia">🏦</span>',
                'Pendiente': '<span title="Pendiente de Pago">⏳</span>'
            };
            htmlPago = (iconosPagoMap[metodo] || '💵') + ' <small class="text-muted">' + escaparHTML(metodo) + '</small>';
        }

        // 5. Canal de venta solo con Íconos (Depósito, Reparto, Comercios)
        const canalNorm = normalizarCanal(p.tipo_venta);
        const iconosCanalMap = {
            'deposito': '<span style="font-size: 1.1rem;" title="Depósito">🏭</span>',
            'reparto': '<span style="font-size: 1.1rem;" title="Reparto">🛵</span>',
            'comercios': '<span style="font-size: 1.1rem;" title="Comercios">🏪</span>'
        };
        const htmlCanal = iconosCanalMap[canalNorm] || '<span title="' + canalNorm + '">📦</span>';

        // 6. Fecha acortada
        let fechaCorta = '';
        if (p.fecha) {
            const fechaStr = p.fecha.substring(0, 10);
            const horaStr = p.fecha.substring(11, 16);
            const hoyStr = new Date().toISOString().substring(0, 10);
            fechaCorta = fechaStr === hoyStr ? 'Hoy ' + horaStr : fechaStr.substring(5) + ' ' + horaStr;
        }

        // 7. Observación oculta tras un botón si existe
        const tieneObs = p.observacion && p.observacion.trim() !== '';
        const botonObs = tieneObs 
            ? '<button class="btn btn-sm btn-link p-0 ms-1 text-warning" title="Ver / Editar observación: ' + escaparHTML(p.observacion) + '" onclick="editarObservacion(' + p.id + ')">💬</button>' 
            : '<button class="btn btn-sm btn-link p-0 ms-1 text-muted" title="Agregar observación" onclick="editarObservacion(' + p.id + ')">➕</button>';

        return '<tr style="' + estiloFila(p) + '" class="align-middle">' +
            // Cliente + Teléfono
            '<td><strong>' + escaparHTML(p.cliente_nombre || 'Sin cliente') + '</strong>' +
                (p.cliente_telefono ? '<br><small class="text-muted">📞 ' + escaparHTML(p.cliente_telefono.split(',')[0]) + '</small>' : '') +
            '</td>' +
            // Items
            '<td><span class="text-truncate d-inline-block" style="max-width: 150px;" title="' + escaparHTML(resumenItemsTxt) + '">' + escaparHTML(resumenItemsTxt) + '</span>' + botonObs + '</td>' +
            // Canal (Solo Ícono con Tooltip)
            '<td class="text-center">' + htmlCanal + '</td>' +
            // Total
            '<td><strong>' + dinero(p.total) + '</strong></td>' +
            // Pago con íconos
            '<td>' + htmlPago + '</td>' +
            // Fecha acortada
            '<td><small class="text-muted">' + fechaCorta + '</small></td>' +
            // Estado y Acciones
            '<td class="text-center">' + columnaEstado + '</td>' +
            '<td class="text-end">' + botonesAccion + '</td>' +
        '</tr>';
    }).join('');
}
async function cargarPedidos() {
    if (!$('cuerpo-tabla-pedidos')) return;

    actualizarResumenPanelPedidos();

    const desde = $('filtro-desde')?.value;
    const hasta = $('filtro-hasta')?.value;

    let url = '/api/pedidos';
    if (filtroHoyActivo) {
        url = '/api/pedidos/hoy';
    } else if (desde || hasta) {
        url = '/api/pedidos/filtrar?desde=' + (desde || '1970-01-01') + '&hasta=' + (hasta || '2100-12-31');
    }

    try {
        pedidosGlobales = await api(url);
        renderizarPedidos(pedidosGlobales);
    } catch (err) {
        console.error('Error al cargar pedidos:', err);
    }
}

/* ============ Filtros ============ */

window.filtrarPedidosHoy = function () {
    filtroHoyActivo = true;
    const d = $('filtro-desde'); if (d) d.value = '';
    const h = $('filtro-hasta'); if (h) h.value = '';
    cargarPedidos();
};

window.filtrarPedidosPorFecha = function () {
    filtroHoyActivo = false;
    cargarPedidos();
};

window.limpiarFiltrosFecha = function () {
    filtroHoyActivo = false;
    const d = $('filtro-desde'); if (d) d.value = '';
    const h = $('filtro-hasta'); if (h) h.value = '';
    cargarPedidos();
};

/* ============ Items (varias garrafas) ============ */

window.agregarItemPedido = function (tipo, cantidad, precio) {
    const fila = document.createElement('div');
    fila.className = 'item-pedido';
    fila.innerHTML =
        '<select class="item-tipo">' +
            TIPOS_GARRAFA.map((t) => '<option value="' + t + '">Garrafa de ' + t + '</option>').join('') +
        '</select>' +
        '<input type="number" class="item-cantidad" min="1" value="1" title="Cantidad">' +
        '<input type="number" class="item-precio" min="0" step="0.01" placeholder="Precio unit." title="Precio unitario">' +
        '<button type="button" class="btn-quitar-fila" title="Quitar" onclick="quitarItemPedido(this)">🗑️</button>';

    const selTipo = fila.querySelector('.item-tipo');
    const inpCant = fila.querySelector('.item-cantidad');
    const inpPrecio = fila.querySelector('.item-precio');

    selTipo.value = (typeof tipo === 'string' && tipo) ? tipo : TIPOS_GARRAFA[0];
    inpCant.value = cantidad || 1;
    inpPrecio.value = precio !== undefined ? precio : (preciosStock[selTipo.value] ?? '');

    // al cambiar el tipo se sugiere el precio de ese tipo (se puede modificar)
    selTipo.addEventListener('change', () => {
        inpPrecio.value = preciosStock[selTipo.value] ?? '';
    });

    $('items-pedido').appendChild(fila);
    actualizarResumenPagos();
};

window.quitarItemPedido = function (btn) {
    const cont = $('items-pedido');
    if (cont.children.length <= 1) {
        mostrarAviso('El pedido necesita al menos una garrafa', 'warning');
        return;
    }
    btn.closest('.item-pedido').remove();
    actualizarResumenPagos();
};

function leerItemsPedido() {
    return [...document.querySelectorAll('#items-pedido .item-pedido')].map((f) => {
        const precioTxt = f.querySelector('.item-precio').value;
        return {
            tipo: f.querySelector('.item-tipo').value,
            cantidad: parseInt(f.querySelector('.item-cantidad').value),
            precio: precioTxt === '' ? null : parseFloat(precioTxt)
        };
    });
}

/* ============ Pagos (simples o mixtos) ============ */

function totalDelFormulario() {
    return leerItemsPedido().reduce((a, i) => {
        const precio = i.precio !== null && !isNaN(i.precio) ? i.precio : (parseFloat(preciosStock[i.tipo]) || 0);
        return a + (i.cantidad || 0) * precio;
    }, 0);
}

function actualizarResumenPagos() {
    const resumen = $('resumen-pagos');
    if (!resumen) return;
    const filas = [...document.querySelectorAll('#pagos-pedido .pago-fila')];
    const total = totalDelFormulario();

    filas.forEach((f) => {
        f.querySelector('.pago-monto').style.display = filas.length > 1 ? '' : 'none';
    });

    if (filas.length <= 1) {
        resumen.textContent = 'Total: ' + dinero(total);
        resumen.style.color = '';
        return;
    }

    const asignado = filas.reduce((a, f) => a + (parseFloat(f.querySelector('.pago-monto').value) || 0), 0);
    const falta = Math.round((total - asignado) * 100) / 100;
    resumen.textContent = 'Total: ' + dinero(total) + ' · Asignado: ' + dinero(asignado) +
        (falta === 0 ? ' ✅' : falta > 0 ? ' · Falta: ' + dinero(falta) : ' · Sobra: ' + dinero(-falta));
    resumen.style.color = falta === 0 ? '#27ae60' : '#e74c3c';
}

window.agregarPagoPedido = function (metodo, monto) {
    const cont = $('pagos-pedido');
    const hayPrevios = cont.children.length > 0;

    const fila = document.createElement('div');
    fila.className = 'pago-fila';
    fila.innerHTML =
        '<select class="pago-metodo">' +
            METODOS_PAGO.map((m) => '<option value="' + m[0] + '">' + m[1] + '</option>').join('') +
        '</select>' +
        '<input type="number" class="pago-monto" min="0" step="0.01" placeholder="Monto" title="Monto">' +
        '<button type="button" class="btn-quitar-fila" title="Quitar" onclick="quitarPagoPedido(this)">🗑️</button>';

    fila.querySelector('.pago-metodo').value = (typeof metodo === 'string' && metodo) ? metodo : 'Efectivo';
    const inpMonto = fila.querySelector('.pago-monto');

    if (monto !== undefined) {
        inpMonto.value = monto;
    } else if (hayPrevios) {
        // al sumar un método nuevo se propone lo que falta por cobrar
        const asignado = [...cont.querySelectorAll('.pago-monto')].reduce((a, i) => a + (parseFloat(i.value) || 0), 0);
        const falta = Math.round((totalDelFormulario() - asignado) * 100) / 100;
        inpMonto.value = falta > 0 ? falta : '';
    }

    cont.appendChild(fila);
    actualizarResumenPagos();
};

window.quitarPagoPedido = function (btn) {
    const cont = $('pagos-pedido');
    if (cont.children.length <= 1) {
        mostrarAviso('Necesitas al menos un método de pago', 'warning');
        return;
    }
    btn.closest('.pago-fila').remove();
    actualizarResumenPagos();
};

function leerPagosPedido() {
    return [...document.querySelectorAll('#pagos-pedido .pago-fila')].map((f) => ({
        metodo: f.querySelector('.pago-metodo').value,
        monto: parseFloat(f.querySelector('.pago-monto').value) || 0
    }));
}

/* ============ Modales ============ */

window.abrirModalPedido = async function () {
    $('titulo-modal-pedido').textContent = 'Nuevo Pedido';
    $('form-pedido').reset();
    $('pedido-id').value = '';
    
    // Al ser nuevo, el cliente es obligatorio
    const selectCliente = $('pedido-cliente');
    if (selectCliente) selectCliente.required = true;
    $('grupo-cliente').style.display = 'block';

    $('grupo-observacion').style.display = '';
    $('btn-agregar-item').style.display = '';
    $('items-pedido').innerHTML = '';
    $('pagos-pedido').innerHTML = '';

    try {
        await cargarPreciosStock();
        const clientes = await api('/api/clientes');
        selectCliente.innerHTML = clientes
            .map((c) => '<option value="' + c.id + '">' + escaparHTML(c.nombre) + ' (' + escaparHTML(c.telefono) + ')</option>')
            .join('');
        window.agregarItemPedido();
        window.agregarPagoPedido('Efectivo');
        mostrarModal('modal-pedido');
    } catch (err) {
        mostrarAviso(err.message, 'danger');
    }
};

window.editarPedido = async function (id) {
    const p = pedidosGlobales.find((x) => x.id === id);
    if (!p) return;

    try {
        await cargarPreciosStock();
    } catch (err) {
        mostrarAviso(err.message, 'danger');
        return;
    }

    $('titulo-modal-pedido').textContent = 'Editar Pedido #' + id;
    $('pedido-id').value = id;

    // Al editar, el cliente no se cambia, quitamos el required para evitar el error de validación
    const selectCliente = $('pedido-cliente');
    if (selectCliente) selectCliente.required = false;
    $('grupo-cliente').style.display = 'none';

    $('grupo-observacion').style.display = 'none'; // la observación se edita con el botón 📝
    $('btn-agregar-item').style.display = '';
    $('pedido-tipo-venta').value = normalizarCanal(p.tipo_venta);

    $('items-pedido').innerHTML = '';
    itemsDePedido(p).forEach((i) => window.agregarItemPedido(i.tipo, i.cantidad, i.precio));

    $('pagos-pedido').innerHTML = '';
    pagosDePedido(p).forEach((x) => window.agregarPagoPedido(x.metodo, x.monto));

    mostrarModal('modal-pedido');
};

window.editarPedido = async function (id) {
    const p = pedidosGlobales.find((x) => x.id === id);
    if (!p) return;

    try {
        await cargarPreciosStock();
    } catch (err) {
        mostrarAviso(err.message, 'danger');
        return;
    }

    $('titulo-modal-pedido').textContent = 'Editar Pedido #' + id;
    $('pedido-id').value = id;
    $('grupo-cliente').style.display = 'none';
    $('grupo-observacion').style.display = 'none'; // la observación se edita con el botón 📝
    $('btn-agregar-item').style.display = '';
    $('pedido-tipo-venta').value = normalizarCanal(p.tipo_venta);

    $('items-pedido').innerHTML = '';
    itemsDePedido(p).forEach((i) => window.agregarItemPedido(i.tipo, i.cantidad, i.precio));

    $('pagos-pedido').innerHTML = '';
    pagosDePedido(p).forEach((x) => window.agregarPagoPedido(x.metodo, x.monto));

    mostrarModal('modal-pedido');
};

window.cerrarModalPedido = function () {
    ocultarModal('modal-pedido');
};
window.editarObservacion = function (id) {
    const p = pedidosGlobales.find((x) => x.id === id);
    if (!p) return;
    
    // Asigna el ID al input oculto y carga el texto actual (si tiene) en el textarea
    $('observacion-id').value = id;
    $('observacion-texto').value = p.observacion || '';
    
    // Muestra el modal de observación
    mostrarModal('modal-observacion');
};

window.cerrarModalObservacion = function () {
    ocultarModal('modal-observacion');
};
window.cerrarModalObservacion = function () {
    ocultarModal('modal-observacion');
};

/* ============ Acciones ============ */

window.borrarPedido = async function (id) {
    if (!confirm('¿Borrar pedido?')) return;
    try {
        await api('/api/pedidos/' + id, { method: 'DELETE' });
        mostrarAviso('Pedido eliminado correctamente', 'success');
        cargarPedidos();
    } catch (err) {
        mostrarAviso(err.message, 'danger');
    }
};

window.cambiarEstado = async function (id, estadoActual) {
    const nuevo = estadoActual === 'Pendiente' ? 'Completado' : 'Pendiente';
    try {
        await api('/api/pedidos/' + id + '/estado', { method: 'PUT', body: { estado: nuevo } });
        mostrarAviso('Pedido marcado como ' + nuevo, 'success');
        cargarPedidos();
    } catch (err) {
        mostrarAviso(err.message, 'danger');
    }
};

/* ============ Inicio ============ */

function initPedidos() {
    if (!$('cuerpo-tabla-pedidos')) return;

    // recalcular el resumen de pagos al cambiar cantidades o precios
    const contItems = $('items-pedido');
    if (contItems) {
        contItems.addEventListener('input', actualizarResumenPagos);
        contItems.addEventListener('change', actualizarResumenPagos);
    }
    const contPagos = $('pagos-pedido');
    if (contPagos) {
        contPagos.addEventListener('input', actualizarResumenPagos);
    }

  const form = $('form-pedido');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = $('pedido-id').value;
            const cliente_id = $('pedido-cliente').value;
            
            // Si es un pedido nuevo y no seleccionó cliente, avisamos y detenemos
            if (!id && !cliente_id) {
                mostrarAviso('Por favor selecciona un cliente', 'warning');
                return;
            }

            const tipo_venta = $('pedido-tipo-venta').value;
            const items = leerItemsPedido();
            const pagos = leerPagosPedido();
        

            if (items.some((it) => !Number.isInteger(it.cantidad) || it.cantidad < 1)) {
                mostrarAviso('Revisá las cantidades', 'warning');
                return;
            }
            if (pagos.length > 1) {
                const asignado = pagos.reduce((a, p) => a + p.monto, 0);
                if (Math.abs(asignado - totalDelFormulario()) > 0.01) {
                    mostrarAviso('Los pagos deben sumar exactamente el total del pedido', 'warning');
                    return;
                }
            }

            try {
                if (id) {
                    await api('/api/pedidos/' + id, {
                        method: 'PUT',
                        body: { items, pagos, tipo_venta }
                    });
                    mostrarAviso('Pedido modificado correctamente', 'success');
                } else {
                    await api('/api/pedidos', {
                        method: 'POST',
                        body: {
                            cliente_id: $('pedido-cliente').value,
                            items,
                            pagos,
                            tipo_venta,
                            observacion: $('pedido-observacion').value
                        }
                    });
                    mostrarAviso('Pedido creado correctamente', 'success');
                }
                window.cerrarModalPedido();
                cargarPedidos();
            } catch (err) {
                mostrarAviso(err.message || 'No hay suficiente stock disponible', 'danger');
            }
        });
    }

    const formObs = $('form-observacion');
    if (formObs) {
        formObs.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = $('observacion-id').value;
            const observacion = $('observacion-texto').value;

            try {
                await api('/api/pedidos/' + id + '/observacion', {
                    method: 'PUT',
                    body: { observacion }
                });
                mostrarAviso('Observación actualizada correctamente', 'success');
                window.cerrarModalObservacion();
                cargarPedidos(); // Recarga la tabla para reflejar el cambio al instante
            } catch (err) {
                mostrarAviso(err.message, 'danger');
            }
        });
    }

    cuandoSeaVisible(() => {
        cargarPedidos();
        setInterval(() => {
            if (!document.hidden && !hayListaAbierta()) cargarPedidos();
        }, 3000);
    });
}


let pedidoIdAEliminar = null;

// Reemplaza el confirm nativo al hacer clic en borrar
window.borrarPedido = function (id) {
    pedidoIdAEliminar = id;
    const modalEl = document.getElementById('modal-confirmar-borrar');
    if (modalEl) modalEl.style.display = 'flex'; // o el método que uses para mostrar tus modales
};

window.cerrarModalBorrar = function () {
    const modalEl = document.getElementById('modal-confirmar-borrar');
    if (modalEl) modalEl.style.display = 'none';
    pedidoIdAEliminar = null;
};

// Función al confirmar dentro del modal de borrado
window.confirmarBorradoPedido = async function () {
    if (!pedidoIdAEliminar) return;
    try {
        await api('/api/pedidos/' + pedidoIdAEliminar, { method: 'DELETE' });
        mostrarAviso('Pedido eliminado correctamente', 'success');
        cerrarModalBorrar();
        cargarPedidos();
    } catch (err) {
        mostrarAviso(err.message, 'danger');
    }
};

// Para cambiar el pago de forma rápida con un modal simple
window.cambiarTipoPagoModal = function (id, formaActual) {
    // Si ya tienes un modal o un selector flotante, puedes asignarle el id aquí
    const nuevoPago = prompt("Selecciona nueva forma de pago (Efectivo, Mercado Pago, Transferencia, Pendiente):", formaActual);
    if (!nuevoPago) return;
    
    api('/api/pedidos/' + id + '/pago', {
        method: 'PUT',
        body: { forma_pago: nuevoPago }
    }).then(() => {
        mostrarAviso('Forma de pago actualizada con éxito', 'success');
        cargarPedidos();
    }).catch(err => {
        mostrarAviso(err.message, 'danger');
    });
};

window.verObservacion = function(id) {
    const p = pedidosGlobales.find(x => x.id === id);
    if (p && p.observacion) {
        mostrarAviso('Observación: ' + p.observacion, 'info');
    }
};

window.verDetallePedido = function(id) {
    const p = pedidosGlobales.find(x => x.id === id);
    if (!p) return;
    const items = itemsDePedido(p).map(i => '• ' + i.cantidad + 'x ' + i.tipo + ' ($' + i.precio + ' c/u)').join('\n');
    alert('Detalle del Pedido #' + p.id + '\n\n' + items + '\n\nObservación: ' + (p.observacion || 'Ninguna'));
};


// ============ Modal de Detalle y Ticket ============

window.verDetallePedido = function (id) {
    const p = pedidosGlobales.find((x) => x.id === id);
    if (!p) return;

// Rellenar datos básicos
    $('det-cliente').textContent = p.cliente_nombre || 'Desconocido';
    $('det-telefono').textContent = p.cliente_telefono || 'No especificado';
    $('det-direccion').textContent = p.direccion || 'Sin dirección';
    $('det-total').textContent = dinero(p.total);
    $('ticket-fecha-hora').textContent = formatoFechaHora(p.fecha);

    // Rellenar items (garrafas)
    const items = itemsDePedido(p);
    const contenedorItems = $('det-lista-items');
    contenedorItems.innerHTML = items.map(i => 
        `<div style="display: flex; justify-content: space-between;">
            <span>${i.cantidad}x ${i.tipo} (${dinero(i.precio)} c/u)</span>
            <span>${dinero(i.cantidad * i.precio)}</span>
        </div>`
    ).join('');

    // Rellenar pagos (soportando pagos mixtos o simples)
    const pagos = pagosDePedido(p);
    const contenedorPagos = $('det-lista-pagos');
    contenedorPagos.innerHTML = pagos.map(pg => 
        `<div style="display: flex; justify-content: space-between;">
            <span>• ${pg.metodo}</span>
            <span>${dinero(pg.monto)}</span>
        </div>`
    ).join('');

    // Observación si existe
    const obsContainer = $('ticket-observacion-container');
    if (p.observacion && p.observacion.trim() !== '') {
        $('det-observacion').textContent = p.observacion;
        obsContainer.style.display = 'block';
    } else {
        obsContainer.style.display = 'none';
    }

    mostrarModal('modal-detalle-pedido');
};

window.cerrarModalDetalle = function () {
    ocultarModal('modal-detalle-pedido');
};

window.imprimirTicketPedido = function () {
    const contenidoTicket = $('ticket-imprimible').innerHTML;
    const ventanaImpresion = window.open('', '_blank', 'width=400,height=600');
    
    ventanaImpresion.document.write(`
        <html>
            <head>
                <title>Imprimir Ticket</title>
                <style>
                    body { font-family: monospace; padding: 20px; color: #000; }
                    div { margin-bottom: 5px; }
                </style>
            </head>
            <body>
                ${contenidoTicket}
                <script>
                    window.onload = function() {
                        window.print();
                        window.close();
                    }
                </script>
            </body>
        </html>
    `);
    ventanaImpresion.document.close();
};


function mostrarConfirmacionPersonalizada(titulo, mensaje, onAceptar) {
    const modal = document.getElementById('modal-personalizado');
    document.getElementById('modal-titulo').textContent = titulo;
    document.getElementById('modal-mensaje').textContent = mensaje;
    
    modal.style.display = 'flex';

    const btnAceptar = document.getElementById('modal-btn-aceptar');
    const btnCancelar = document.getElementById('modal-btn-cancelar');

    // Limpiar eventos anteriores clonando los botones
    const nuevoBtnAceptar = btnAceptar.cloneNode(true);
    const nuevoBtnCancelar = btnCancelar.cloneNode(true);
    btnAceptar.parentNode.replaceChild(nuevoBtnAceptar, btnAceptar);
    btnCancelar.parentNode.replaceChild(nuevoBtnCancelar, btnCancelar);

    // Acción al cancelar
    document.getElementById('modal-btn-cancelar').onclick = function() {
        modal.style.display = 'none';
    };

    // Acción al aceptar
    document.getElementById('modal-btn-aceptar').onclick = function() {
        modal.style.display = 'none';
        if (onAceptar) onAceptar();
    };
}

// Cuando el usuario hace clic en el botón Reiniciar:
function clickReiniciarWhatsApp() {
    mostrarConfirmacionPersonalizada(
        "🔄 Reiniciar WhatsApp", 
        "¿Estás seguro de que deseas reiniciar la sesión? Se borrará el estado actual y se generará un nuevo QR.", 
        function() {
            // Aquí llamas a tu función real de reinicio
            reiniciarWhatsApp(); 
        }
    );
}