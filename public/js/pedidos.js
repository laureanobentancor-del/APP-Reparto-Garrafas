'use strict';

let pedidosGlobales = [];
let filtroHoyActivo = false;

async function actualizarResumenPanelPedidos() {
    try {
        const stock = await api('/api/stock');
        const elStock = $('resumen-stock-pedidos');
        if (elStock) {
            elStock.innerHTML = stock
                .map((s) => '<div><strong>' + escaparHTML(s.tipo) + ':</strong> 🟢 ' + s.llenas + ' | 🟠 ' + s.vacias + '</div>')
                .join('');
        }
    } catch (err) {
        console.error('Error al cargar stock para el panel:', err);
    }

    try {
        const pedidos = await api('/api/pedidos/hoy');
        let garrafas = 0, cobrado = 0, pendiente = 0;

        pedidos.forEach((p) => {
            garrafas += parseInt(p.cantidad) || 0;
            const monto = parseFloat(p.total) || 0;
            if (esPagoPendiente(p.forma_pago)) pendiente += monto;
            else cobrado += monto;
        });

        setTexto('resumen-garrafas-pedidos', garrafas + ' un.');
        setTexto('resumen-cobrado-pedidos', dinero(cobrado));
        setTexto('resumen-pendiente-pedidos', dinero(pendiente));
    } catch (err) {
        console.error('Error al cargar resumen de ventas de hoy:', err);
    }
}


'use strict';

function escaparHTML(valor) {
    var mapa = {
        '&': '&',
        '<': '<',
        '>': '>',
        '"': '"',
    };
    
    var textoSeguro = (valor !== null && valor !== undefined) ? String(valor) : '';
    
    return textoSeguro.replace(/[&<>"']/g, function(c) {
        return mapa[c];
    });
}




function renderizarPedidos(pedidos) {
    const tbody = $('cuerpo-tabla-pedidos');
    if (!tbody) return;

    if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No se encontraron pedidos.</td></tr>';
        return;
    }

    const ordenados = [...pedidos].sort(compararPendientesPrimero);

    tbody.innerHTML = ordenados.map((p) => {
        let botonesAccion = '';
        let columnaEstado;

        if (p.estado === 'Completado') {
            columnaEstado = '<span style="font-weight:bold; color:#27ae60;">' + escaparHTML(p.estado) + '</span>';
        } else {
            botonesAccion = '<button class="btn-accion btn-editar" title="Editar pedido" onclick="editarPedido(' + p.id + ')">✏️</button>' +
                            '<button class="btn-accion btn-eliminar" title="Borrar pedido" onclick="borrarPedido(' + p.id + ')">🗑️</button>';
            columnaEstado = '<span onclick="cambiarEstado(' + p.id + ', \'' + escaparHTML(p.estado) + '\')" style="cursor:pointer; font-weight:bold; color:#e67e22;" title="Hacer clic para completar">' + escaparHTML(p.estado) + '</span>';
        }

        return '<tr style="' + estiloFila(p) + '">' +
            '<td><strong>' + (escaparHTML(p.cliente_nombre) || 'Desconocido') + '</strong><br><small>' + escaparHTML(p.cliente_telefono) + '</small></td>' +
            '<td>' + escaparHTML(p.tipo) + '</td>' +
            '<td>' + badgeCanal(normalizarCanal(p.tipo_venta)) + '</td>' +
            '<td>' + p.cantidad + '</td>' +
            '<td>' + dinero(p.total) + '</td>' +
            '<td>' + celdaFormaPago(p) + '</td>' +
            '<td>' + formatoFechaHora(p.fecha) + '</td>' +
            '<td>' + columnaEstado + '</td>' +
            '<td>' + botonesAccion + '</td>' +
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

window.filtrarPedidosHoy = function () {
    filtroHoyActivo = true;
    
    const filtroDesde = document.getElementById('filtro-desde');
    if (filtroDesde) {
        filtroDesde.value = '';
    }
    
    const filtroHasta = document.getElementById('filtro-hasta');
    if (filtroHasta) {
        filtroHasta.value = '';
    }
    
    cargarPedidos();
};

window.filtrarPedidosPorFecha = function () {
    filtroHoyActivo = false;
    cargarPedidos();
};

window.limpiarFiltrosFecha = function () {
    filtroHoyActivo = false;
    
    const filtroDesde = document.getElementById('filtro-desde');
    if (filtroDesde) {
        filtroDesde.value = '';
    }
    
    const filtroHasta = document.getElementById('filtro-hasta');
    if (filtroHasta) {
        filtroHasta.value = '';
    }
    
    cargarPedidos();
};

window.abrirModalPedido = async function () {
    $('titulo-modal-pedido').textContent = 'Nuevo Pedido';
    $('form-pedido').reset();
    $('pedido-id').value = '';
    $('grupo-cliente').style.display = 'block';
    $('pedido-forma-pago').closest('.grupo-form').style.display = '';

    try {
        const clientes = await api('/api/clientes');
        $('pedido-cliente').innerHTML = clientes
            .map((c) => '<option value="' + c.id + '">' + escaparHTML(c.nombre) + ' (' + escaparHTML(c.telefono) + ')</option>')
            .join('');
        mostrarModal('modal-pedido');
    } catch (err) {
        alert(err.message);
    }
};

window.editarPedido = function (id) {
    const p = pedidosGlobales.find((x) => x.id === id);
    if (!p) return;

    $('titulo-modal-pedido').textContent = 'Editar Pedido #' + id;
    $('pedido-id').value = id;
    $('grupo-cliente').style.display = 'none';
    $('pedido-forma-pago').closest('.grupo-form').style.display = 'none';
    $('pedido-tipo').value = p.tipo;
    $('pedido-cantidad').value = p.cantidad;
    $('pedido-tipo-venta').value = normalizarCanal(p.tipo_venta);
    mostrarModal('modal-pedido');
};

window.cerrarModalPedido = function () {
    ocultarModal('modal-pedido');
};

window.borrarPedido = async function (id) {
    if (!confirm('¿Borrar pedido?')) return;
    try {
        await api('/api/pedidos/' + id, { method: 'DELETE' });
        cargarPedidos();
    } catch (err) {
        alert(err.message);
    }
};

window.cambiarEstado = async function (id, estadoActual) {
    const nuevo = estadoActual === 'Pendiente' ? 'Completado' : 'Pendiente';
    try {
        await api('/api/pedidos/' + id + '/estado', { method: 'PUT', body: { estado: nuevo } });
        cargarPedidos();
    } catch (err) {
        alert(err.message);
    }
};

function initPedidos() {
    if (!$('cuerpo-tabla-pedidos')) return;

    const form = $('form-pedido');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = $('pedido-id').value;
            const tipo = $('pedido-tipo').value;
            const cantidad = parseInt($('pedido-cantidad').value);
            const tipo_venta = $('pedido-tipo-venta').value;
            const forma_pago = $('pedido-forma-pago').value;

            try {
                if (id) {
                    await api('/api/pedidos/' + id, { method: 'PUT', body: { tipo, cantidad, tipo_venta } });
                } else {
                    await api('/api/pedidos', {
                        method: 'POST',
                        body: { cliente_id: $('pedido-cliente').value, tipo, cantidad, forma_pago, tipo_venta }
                    });
                }
                window.cerrarModalPedido();
                cargarPedidos();
            } catch (err) {
                alert(err.message || 'No hay suficiente stock disponible');
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