
// ==========================================
// LÓGICA DEL LIBRO DIARIO
// ==========================================

if (document.getElementById('cuerpo-tabla-diario')) {
    let todosLosPedidosDiario = [];

    window.ponerDiaHoy = function() {
        const hoy = new Date().toISOString().substring(0, 10);
        const input = document.getElementById('input-fecha-diario');
        if (input) input.value = hoy;
        cargarLibroDiario();
    };

    window.cambiarDia = function(dias) {
        const input = document.getElementById('input-fecha-diario');
        if (!input) return;
        let fechaActual = input.value ? new Date(input.value + 'T00:00:00') : new Date();
        fechaActual.setDate(fechaActual.getDate() + dias);
        input.value = fechaActual.toISOString().substring(0, 10);
        cargarLibroDiario();
    };

    window.cargarLibroDiario = function() {
        const inputFecha = document.getElementById('input-fecha-diario');
        if (!inputFecha) return;
        if (!inputFecha.value) {
            ponerDiaHoy();
            return;
        }
        const fechaSeleccionada = inputFecha.value;

        fetch('/api/pedidos')
            .then(res => res.json())
            .then(pedidos => {
                todosLosPedidosDiario = pedidos;
                filtrarYRenderizarDiario(fechaSeleccionada);
            })
            .catch(err => console.error("Error al cargar datos para el libro diario:", err));
    }

    function filtrarYRenderizarDiario(fechaStr) {
        const tbody = document.getElementById('cuerpo-tabla-diario');
        if (!tbody) return;
        tbody.innerHTML = '';

        const pedidosDelDia = todosLosPedidosDiario.filter(p => {
            if (!p.fecha) return false;
            return p.fecha.substring(0, 10) === fechaStr;
        });

        if (pedidosDelDia.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No se registraron movimientos en esta fecha.</td></tr>`;
            actualizarMetricasDiario(0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            return;
        }

        let totalCobrado = 0;
        let efec = 0, mp = 0, transf = 0, pend = 0;
        let totUnidades = 0;
        let u10 = 0, u15 = 0, u30 = 0, u45 = 0;

        pedidosDelDia.forEach(p => {
            const hora = p.fecha ? p.fecha.substring(11, 16) : '';
            const metodo = p.forma_pago ? p.forma_pago.trim() : 'Efectivo';
            const monto = parseFloat(p.total) || 0;
            const cant = parseInt(p.cantidad) || 0;

            totUnidades += cant;
            if (p.tipo === '10kg') u10 += cant;
            if (p.tipo === '15kg') u15 += cant;
            if (p.tipo === '30kg') u30 += cant;
            if (p.tipo === '45kg') u45 += cant;

            if (metodo === 'Pendiente') {
                pend += monto;
            } else {
                totalCobrado += monto;
                if (metodo === 'Efectivo') efec += monto;
                if (metodo === 'Mercado Pago') mp += monto;
                if (metodo === 'Transferencia') transf += monto;
            }

            let badgeEstado = p.estado === 'Completado' ? '<span style="color:#27ae60; font-weight:bold;">Completado</span>' : '<span style="color:#e67e22; font-weight:bold;">Pendiente</span>';

            tbody.innerHTML += `
                <tr>
                    <td><strong>${hora}</strong><br><small>#${p.id}</small></td>
                    <td><strong>${p.cliente_nombre || 'Desconocido'}</strong><br><small>${p.cliente_telefono || ''}</small></td>
                    <td>${p.tipo}</td>
                    <td>${cant}</td>
                    <td style="font-weight: bold; color: #27ae60;">$${monto}</td>
                    <td>${metodo}</td>
                    <td>${badgeEstado}</td>
                </tr>
            `;
        });

        actualizarMetricasDiario(totalCobrado, efec, mp, transf, pend, totUnidades, u10, u15, u30, u45);
    }

    function actualizarMetricasDiario(cobrado, efec, mp, transf, pend, totUnidades, u10, u15, u30, u45) {
        document.getElementById('diario-total-cobrado').textContent = `$${cobrado.toLocaleString()}`;
        document.getElementById('diario-efectivo').textContent = `$${efec.toLocaleString()}`;
        document.getElementById('diario-mp').textContent = `$${mp.toLocaleString()}`;
        document.getElementById('diario-transf').textContent = `$${transf.toLocaleString()}`;
        document.getElementById('diario-pendiente').textContent = `$${pend.toLocaleString()}`;

        document.getElementById('diario-total-unidades').textContent = `${totUnidades} un.`;
        document.getElementById('diario-g10').textContent = `${u10}`;
        document.getElementById('diario-g15').textContent = `${u15}`;
        document.getElementById('diario-g30').textContent = `${u30}`;
        document.getElementById('diario-g45').textContent = `${u45}`;
    }

    document.addEventListener("DOMContentLoaded", () => {
        const inputFecha = document.getElementById('input-fecha-diario');
        if (inputFecha && !inputFecha.value) {
            ponerDiaHoy();
        }
    });



}
