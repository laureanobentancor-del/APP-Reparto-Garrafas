'use strict';

let clientesGlobales = [];

async function cargarClientes() {
    const tbody = $('cuerpo-tabla-clientes');
    if (!tbody) return;

    try {
        clientesGlobales = await api('/api/clientes');

        tbody.innerHTML = clientesGlobales.map((c) => '<tr>' +
            '<td><strong>' + escaparHTML(c.nombre) + '</strong></td>' +
            '<td>' + escaparHTML(c.telefono) + '</td>' +
            '<td>' + (escaparHTML(c.direccion) || '-') + '</td>' +
            '<td>' +
                '<button class="btn-accion btn-editar" title="Editar cliente" onclick="editarCliente(' + c.id + ')">✏️</button>' +
                '<button class="btn-accion btn-historial" title="Ver historial" onclick="verHistorialCliente(' + c.id + ')">📋</button>' +
                '<button class="btn-accion btn-eliminar" title="Borrar cliente" onclick="borrarCliente(' + c.id + ')">🗑️</button>' +
            '</td>' +
        '</tr>').join('');

        window.filtrarClientes();
    } catch (err) {
        console.error('Error al cargar clientes:', err);
    }
}

window.filtrarClientes = function () {
    const input = $('buscador-cliente');
    const tbody = $('cuerpo-tabla-clientes');
    if (!input || !tbody) return;

    const filtro = input.value.toLowerCase();
    tbody.querySelectorAll('tr').forEach((fila) => {
        const celdaNombre = fila.querySelector('td');
        if (celdaNombre) {
            fila.style.display = celdaNombre.textContent.toLowerCase().includes(filtro) ? '' : 'none';
        }
    });
};

window.abrirModalCliente = function () {
    $('titulo-modal-cliente').textContent = 'Registrar Nuevo Cliente';
    $('form-cliente').reset();
    $('cliente-id').value = '';
    mostrarModal('modal-cliente');
};

window.editarCliente = function (id) {
    const c = clientesGlobales.find((x) => x.id === id);
    if (!c) return;
    $('titulo-modal-cliente').textContent = 'Editar Cliente';
    $('cliente-id').value = c.id;
    $('cliente-nombre').value = c.nombre || '';
    $('cliente-telefono').value = c.telefono || '';
    $('cliente-direccion').value = c.direccion || '';
    mostrarModal('modal-cliente');
};

window.cerrarModalCliente = function () {
    ocultarModal('modal-cliente');
};

window.borrarCliente = async function (id) {
    if (!confirm('¿Estás seguro de borrar este cliente?')) return;
    try {
        await api('/api/clientes/' + id, { method: 'DELETE' });
        cargarClientes();
    } catch (err) {
        alert(err.message);
    }
};

window.verHistorialCliente = async function (clienteId) {
    const cliente = clientesGlobales.find((x) => x.id === clienteId);
    $('titulo-historial').textContent = 'Historial de Pedidos - ' + (cliente ? cliente.nombre : '');

    try {
        const pedidos = await api('/api/clientes/' + clienteId + '/pedidos');
        const tbody = $('cuerpo-tabla-historial');

        if (pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Este cliente no tiene pedidos registrados.</td></tr>';
        } else {
            tbody.innerHTML = pedidos.map((p) => '<tr>' +
                '<td>#' + p.id + '</td>' +
                '<td><strong>' + (escaparHTML(p.cliente_nombre) || 'Desconocido') + '</strong><br><small>' + escaparHTML(p.cliente_telefono) + '</small></td>' +
                '<td>' + escaparHTML(p.tipo) + '</td>' +
                '<td>' + p.cantidad + '</td>' +
                '<td>' + dinero(p.total) + '</td>' +
                '<td>' + formatoFechaHora(p.fecha) + '</td>' +
                '<td><span style="font-weight:bold; color:' + (p.estado === 'Pendiente' ? '#e67e22' : '#27ae60') + '">' + escaparHTML(p.estado) + '</span></td>' +
            '</tr>').join('');
        }
        mostrarModal('modal-historial');
    } catch (err) {
        alert(err.message);
    }
};

window.cerrarModalHistorial = function () {
    ocultarModal('modal-historial');
};

function initClientes() {
    const form = $('form-cliente');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = $('cliente-id').value;
            const datos = {
                nombre: $('cliente-nombre').value,
                telefono: $('cliente-telefono').value,
                direccion: $('cliente-direccion').value
            };

            try {
                await api(id ? '/api/clientes/' + id : '/api/clientes', {
                    method: id ? 'PUT' : 'POST',
                    body: datos
                });
                window.cerrarModalCliente();
                cargarClientes();
            } catch (err) {
                alert(err.message);
            }
        });
    }

    cargarClientes();
}