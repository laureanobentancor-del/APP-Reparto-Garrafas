'use strict';

async function cargarStock() {
    const tbody = $('cuerpo-tabla-stock');
    if (!tbody) return;

    try {
        const stock = await api('/api/stock');
        tbody.innerHTML = stock.map((s) => {
            const total = (s.llenas || 0) + (s.vacias || 0);
            return '<tr>' +
                '<td><strong>' + escaparHTML(s.tipo) + '</strong></td>' +
                '<td>' + s.llenas + '</td>' +
                '<td>' + s.vacias + '</td>' +
                '<td>' + dinero(s.precio) + '</td>' +
                '<td>' + total + '</td>' +
                '<td>' +
                    '<button class="btn-accion btn-editar" title="Editar stock" onclick="abrirModalStock(\'' + escaparHTML(s.tipo) + '\', ' + s.llenas + ', ' + s.vacias + ', ' + s.precio + ')">✏️️</button>' +
                '</td>' +
            '</tr>';
        }).join('');
    } catch (err) {
        console.error('Error al cargar stock:', err);
    }
}

window.abrirModalStock = function (tipo, llenas, vacias, precio) {
    $('titulo-modal-stock').textContent = 'Actualizar Stock: ' + tipo;
    $('stock-tipo').value = tipo;
    $('stock-llenas').value = llenas;
    $('stock-vacias').value = vacias;
    $('stock-precio').value = precio;
    mostrarModal('modal-stock');
};

window.cerrarModalStock = function () {
    ocultarModal('modal-stock');
};

function initStock() {
    const form = $('form-stock');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tipo = $('stock-tipo').value;
            const datos = {
                llenas: parseInt($('stock-llenas').value),
                vacias: parseInt($('stock-vacias').value),
                precio: parseFloat($('stock-precio').value)
            };

            try {
                await api('/api/stock/' + tipo, { method: 'PUT', body: datos });
                window.cerrarModalStock();
                cargarStock();
            } catch (err) {
                alert(err.message || 'No autorizado o error al actualizar stock');
            }
        });
    }

    cargarStock();
}