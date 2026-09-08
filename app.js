// ==========================================
// LÓGICA DEL APARTADO DE VENTAS
// ==========================================
let ventasGlobales = [];

if (document.getElementById('cuerpo-tabla-ventas')) {
    function renderizarVentas(ventas) {
        const tbody = document.getElementById('cuerpo-tabla-ventas');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (ventas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center;">No se encontraron registros de ventas.</td></tr>`;
            actualizarMetricasVentas(0, 0);
            return;
        }

        let totalRecaudadoGeneral = 0;
        let totalGarrafasGeneral = 0;

        ventas.forEach(v => {
            const fechaFormateada = v.fecha ? v.fecha.substring(0, 10) : '';
            const horaFormateada = v.fecha ? v.fecha.substring(11, 16) : '';
            
            const metodoPago = v.forma_pago ? v.forma_pago.trim() : 'Efectivo';

            if (metodoPago !== 'Pendiente') {
                totalRecaudadoGeneral += parseFloat(v.total) || 0;
            }
            totalGarrafasGeneral += parseInt(v.cantidad) || 0;

            let columnaPago = '';
            if (metodoPago === 'Pendiente') {
                columnaPago = `
                    <select onchange="actualizarFormaPagoVenta(${v.id}, this.value)" style="padding: 5px; border-radius: 4px; font-weight: bold; cursor: pointer; border: 1px solid #e67e22; background-color: #fdf2e9; color: #d35400;">
                        <option value="Pendiente" selected>⏳ Pendiente</option>
                        <option value="Efectivo">💵 Efectivo</option>
                        <option value="Mercado Pago">📱 Mercado Pago</option>
                        <option value="Transferencia">🏦 Transferencia</option>
                    </select>
                `;
            } else {
                let iconoPago = '💵 Efectivo';
                if (metodoPago === 'Mercado Pago') iconoPago = '📱 Mercado Pago';
                if (metodoPago === 'Transferencia') iconoPago = '🏦 Transferencia';
                
                columnaPago = `<span style="font-weight: bold; color: #27ae60;">${iconoPago}</span>`;
            }

            // Las 8 columnas exactas correspondientes a los 8 th de ventas.html
            tbody.innerHTML += `
                <tr>
                    <td>#${v.id}</td>
                    <td><strong>${v.cliente_nombre || 'Desconocido'}</strong><br><small>${v.cliente_telefono || ''}</small></td>
                    <td>${v.tipo}</td>
                    <td>${v.cantidad}</td>
                    <td style="font-weight: bold; color: #27ae60;">$${v.total}</td>
                    <td>${columnaPago}</td>
                    <td>${fechaFormateada} ${horaFormateada}</td>
                    <td><span style="font-weight:bold; color:#27ae60;">${v.estado}</span></td>
                </tr>`;
        });

        actualizarMetricasVentas(totalRecaudadoGeneral, totalGarrafasGeneral);
    }

    function actualizarMetricasVentas(recaudado, garrafas) {
        document.getElementById('total-recaudado').textContent = `$${recaudado.toLocaleString()}`;
        document.getElementById('total-garrafas').textContent = `${garrafas} unidades`;
    }

    function cargarVentas() {
        fetch('/api/pedidos')
            .then(res => res.json())
            .then(pedidos => {
                ventasGlobales = pedidos.filter(p => p.estado === 'Completado');
                renderizarVentas(ventasGlobales);
            })
            .catch(err => console.error("Error al cargar ventas:", err));
    }

    window.actualizarFormaPagoVenta = function(idPedido, nuevaFormaPago) {
        fetch(`/api/pedidos/${idPedido}/pago`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forma_pago: nuevaFormaPago })
        })
        .then(res => res.json())
        .then(() => {
            cargarVentas();
        })
        .catch(err => console.error("Error al actualizar la forma de pago:", err));
    }

    window.filtrarVentasHoy = function() {
        const fechaLocal = new Date();
        const anio = fechaLocal.getFullYear();
        const mes = String(fechaLocal.getMonth() + 1).padStart(2, '0');
        const dia = String(fechaLocal.getDate()).padStart(2, '0');
        const hoy = `${anio}-${mes}-${dia}`;
        
        const ventasHoy = ventasGlobales.filter(v => v.fecha && v.fecha.substring(0, 10) === hoy);
        renderizarVentas(ventasHoy);
    }

    window.filtrarVentasPorFecha = function() {
        const desde = document.getElementById('filtro-ventas-desde').value;
        const hasta = document.getElementById('filtro-ventas-hasta').value;

        let filtradas = ventasGlobales.filter(v => {
            if (!v.fecha) return false;
            const fechaVenta = v.fecha.substring(0, 10);
            if (desde && fechaVenta < desde) return false;
            if (hasta && fechaVenta > hasta) return false;
            return true;
        });

        renderizarVentas(filtradas);
    }

    window.filtrarVentasTexto = function() {
        const texto = document.getElementById('buscador-ventas').value.toLowerCase();
        let filtradas = ventasGlobales.filter(v => {
            const cliente = (v.cliente_nombre || '').toLowerCase();
            const tipo = (v.tipo || '').toLowerCase();
            return cliente.includes(texto) || tipo.includes(texto);
        });
        renderizarVentas(filtradas);
    }

    window.limpiarFiltrosVentas = function() {
        document.getElementById('filtro-ventas-desde').value = '';
        document.getElementById('filtro-ventas-hasta').value = '';
        document.getElementById('buscador-ventas').value = '';
        renderizarVentas(ventasGlobales);
    }

    cargarVentas();
}