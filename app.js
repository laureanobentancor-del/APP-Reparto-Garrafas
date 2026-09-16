
// ==========================================
// VARIABLES GLOBALES
// ==========================================
let pedidosGlobales = [];


// ==========================================
// LÓGICA DE CLIENTES
// ==========================================
if (document.getElementById('cuerpo-tabla-clientes')) {
    function cargarClientes() {
        fetch('/api/clientes')
            .then(res => res.json())
            .then(clientes => {
                const tbody = document.getElementById('cuerpo-tabla-clientes');
                tbody.innerHTML = '';
                clientes.forEach(c => {
                    tbody.innerHTML += `
                        <tr>
                            <td><strong>${c.nombre}</strong></td>
                            <td>${c.telefono}</td>
                            <td>${c.direccion || '-'}</td>
                            <td>
                                <button class="btn-accion btn-editar" onclick="editarCliente(${c.id}, '${c.nombre}', '${c.telefono}', '${c.direccion || ''}')">Editar</button>
                                <button class="btn-accion" style="background-color: #3498db; color: white;" onclick="verHistorialCliente(${c.id}, '${c.nombre}')">Historial</button>
                                <button class="btn-accion btn-eliminar" onclick="borrarCliente(${c.id})">Borrar</button>
                            </td>
                        </tr>
                    `;
                });
            });
    }

    window.abrirModalCliente = function() { 
        document.getElementById('titulo-modal-cliente').textContent = "Registrar Nuevo Cliente";
        document.getElementById('form-cliente').reset();
        document.getElementById('cliente-id').value = "";
        document.getElementById('modal-cliente').style.display = 'flex'; 
    }

    window.editarCliente = function(id, nombre, telefono, direccion) {
        document.getElementById('titulo-modal-cliente').textContent = "Editar Cliente";
        document.getElementById('cliente-id').value = id;
        document.getElementById('cliente-nombre').value = nombre;
        document.getElementById('cliente-telefono').value = telefono;
        document.getElementById('cliente-direccion').value = direccion;
        document.getElementById('modal-cliente').style.display = 'flex';
    }
    
    window.cerrarModalCliente = function() { 
        document.getElementById('modal-cliente').style.display = 'none'; 
    }

    document.getElementById('form-cliente').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('cliente-id').value;
        const data = {
            nombre: document.getElementById('cliente-nombre').value,
            telefono: document.getElementById('cliente-telefono').value,
            direccion: document.getElementById('cliente-direccion').value
        };

        const metodo = id ? 'PUT' : 'POST';
        const url = id ? `/api/clientes/${id}` : '/api/clientes';

        fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(() => {
            cerrarModalCliente();
            cargarClientes();
        });
    });

    window.borrarCliente = function(id) {
        if (confirm("¿Estás seguro de borrar este cliente?")) {
            fetch(`/api/clientes/${id}`, { method: 'DELETE' }).then(() => cargarClientes());
        }
    }

    cargarClientes();
}

// ==========================================
// LÓGICA DE STOCK
// ==========================================
if (document.getElementById('cuerpo-tabla-stock')) {
    function cargarStock() {
        fetch('/api/stock')
            .then(res => res.json())
            .then(stock => {
                const tbody = document.getElementById('cuerpo-tabla-stock');
                tbody.innerHTML = '';
                stock.forEach(s => {
                    const totalFisico = s.llenas + s.vacias;
                    tbody.innerHTML += `
                        <tr>
                            <td><strong>Garrafa de ${s.tipo}</strong></td>
                            <td style="color: #27ae60; font-weight: bold;">${s.llenas}</td>
                            <td style="color: #e67e22; font-weight: bold;">${s.vacias}</td>
                            <td>$${s.precio}</td>
                            <td>${totalFisico}</td>
                            <td>
                                <button class="btn-accion btn-editar" onclick="abrirModalStock('${s.tipo}', ${s.llenas}, ${s.vacias}, ${s.precio})">Editar</button>
                            </td>
                        </tr>
                    `;
                });
            });
    }

    window.abrirModalStock = function(tipo, llenas, vacias, precio) {
        document.getElementById('titulo-modal-stock').textContent = "Editar Stock - Garrafa de " + tipo;
        document.getElementById('stock-tipo').value = tipo;
        document.getElementById('stock-llenas').value = llenas;
        document.getElementById('stock-vacias').value = vacias;
        document.getElementById('stock-precio').value = precio;
        document.getElementById('modal-stock').style.display = 'flex';
    }

    window.cerrarModalStock = function() { 
        document.getElementById('modal-stock').style.display = 'none'; 
    }

    document.getElementById('form-stock').addEventListener('submit', (e) => {
        e.preventDefault();
        const tipo = document.getElementById('stock-tipo').value;
        const data = {
            llenas: parseInt(document.getElementById('stock-llenas').value),
            vacias: parseInt(document.getElementById('stock-vacias').value),
            precio: parseFloat(document.getElementById('stock-precio').value)
        };
        
        fetch(`/api/stock/${tipo}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(() => {
            cerrarModalStock();
            cargarStock();
        });
    });

    cargarStock();
}

// ==========================================
// LÓGICA DE PEDIDOS Y WHATSAPP
// ==========================================
if (document.getElementById('cuerpo-tabla-pedidos')) {
    function renderizarPedidos(pedidos) {
        const tbody = document.getElementById('cuerpo-tabla-pedidos');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (pedidos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center;">No se encontraron pedidos.</td></tr>`;
            return;
        }

        pedidos.forEach(p => {
            const fechaFormateada = p.fecha ? p.fecha.substring(0, 10) : '';
            const horaFormateada = p.fecha ? p.fecha.substring(11, 16) : '';
            
            const metodoPago = p.forma_pago ? p.forma_pago.trim() : 'Efectivo';
            
            let iconoPago = '💵 Efectivo';
            if (metodoPago === 'Mercado Pago') iconoPago = '📱 Mercado Pago';
            if (metodoPago === 'Transferencia') iconoPago = '🏦 Transferencia';
            if (metodoPago === 'Pendiente') iconoPago = '⏳ Pendiente';

            let botonesAccion = '';
            let columnaEstado = '';

            if (p.estado === 'Completado') {
                botonesAccion = '';
                columnaEstado = `<span style="font-weight:bold; color:#27ae60;">${p.estado}</span>`;
            } else {
                botonesAccion = `
                    <button class="btn-accion btn-editar" onclick="editarPedido(${p.id}, '${p.tipo}', ${p.cantidad})">Editar</button> 
                    <button class="btn-accion btn-eliminar" onclick="borrarPedido(${p.id})">Borrar</button>
                `;
                columnaEstado = `<span onclick="cambiarEstado(${p.id}, '${p.estado}')" style="cursor:pointer; font-weight:bold; color:#e67e22;">${p.estado}</span>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td><strong>${p.cliente_nombre || 'Desconocido'}</strong><br><small>${p.cliente_telefono || ''}</small></td>
                    <td>${p.tipo}</td>
                    <td>${p.cantidad}</td>
                    <td>$${p.total}</td>
                    <td>${iconoPago}</td>
                    <td>${fechaFormateada} ${horaFormateada}</td>
                    <td>${columnaEstado}</td>
                    <td>${botonesAccion}</td>
                </tr>`;
        });
    }

    function cargarPedidos() {
     actualizarResumenPanelPedidos(); 
        
        const desde = document.getElementById('filtro-desde')?.value;
        const hasta = document.getElementById('filtro-hasta')?.value;
        
        if (window.filtroHoyActivo) {
            fetch('/api/pedidos/hoy')
                .then(res => res.json())
                .then(pedidos => renderizarPedidos(pedidos))
                .catch(err => console.error("Error al cargar pedidos de hoy:", err));
            return;
        }

        if (desde || hasta) {
            const urlDesde = desde || '1970-01-01';
            const urlHasta = hasta || '2100-12-31';
            fetch(`/api/pedidos/filtrar?desde=${urlDesde}&hasta=${urlHasta}`)
                .then(res => res.json())
                .then(pedidos => {
                    pedidosGlobales = pedidos;
                    renderizarPedidos(pedidos);
                })
                .catch(err => console.error("Error al filtrar pedidos:", err));
            return;
        }
        
        fetch('/api/pedidos')
            .then(res => res.json())
            .then(pedidos => {
                pedidosGlobales = pedidos; 
                renderizarPedidos(pedidos);
            })
            .catch(err => console.error("Error al cargar pedidos:", err));
    }

    window.filtrarPedidosHoy = function() {
        window.filtroHoyActivo = true;
        const inputDesde = document.getElementById('filtro-desde');
        const inputHasta = document.getElementById('filtro-hasta');
        if (inputDesde) inputDesde.value = '';
        if (inputHasta) inputHasta.value = '';
        cargarPedidos();
    }

    window.filtrarPedidosPorFecha = function() {
        window.filtroHoyActivo = false;
        cargarPedidos();
    }

    window.limpiarFiltrosFecha = function() {
        window.filtroHoyActivo = false;
        const inputDesde = document.getElementById('filtro-desde');
        const inputHasta = document.getElementById('filtro-hasta');
        
        if (inputDesde) inputDesde.value = '';
        if (inputHasta) inputHasta.value = '';
        
        cargarPedidos();
    }

    window.abrirModalPedido = function() {
        document.getElementById('titulo-modal-pedido').textContent = "Nuevo Pedido Manual";
        document.getElementById('form-pedido').reset();
        document.getElementById('pedido-id').value = "";
        document.getElementById('grupo-cliente').style.display = "block";
        fetch('/api/clientes').then(res => res.json()).then(clientes => {
            const select = document.getElementById('pedido-cliente');
            select.innerHTML = '';
            clientes.forEach(c => select.innerHTML += `<option value="${c.id}">${c.nombre} (${c.telefono})</option>`);
            document.getElementById('modal-pedido').style.display = "flex";
        });
    }

    window.editarPedido = function(id, tipo, cantidad) {
        document.getElementById('titulo-modal-pedido').textContent = "Editar Pedido #" + id;
        document.getElementById('pedido-id').value = id;
        document.getElementById('grupo-cliente').style.display = "none";
        document.getElementById('pedido-tipo').value = tipo;
        document.getElementById('pedido-cantidad').value = cantidad;
        document.getElementById('modal-pedido').style.display = "flex";
    }

    window.cerrarModalPedido = function() { 
        document.getElementById('modal-pedido').style.display = 'none'; 
    }

    document.getElementById('form-pedido').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('pedido-id').value;
        const tipo = document.getElementById('pedido-tipo').value;
        const cantidad = document.getElementById('pedido-cantidad').value;
        const forma_pago = document.getElementById('pedido-forma-pago').value;

        if (id) {
            fetch(`/api/pedidos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, cantidad }) })
                .then(() => { cerrarModalPedido(); cargarPedidos(); });
        } else {
            fetch('/api/pedidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente_id: document.getElementById('pedido-cliente').value, tipo, cantidad, forma_pago }) })
                .then(async res => {
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "No hay suficiente stock disponible");
                    return data;
                })
                .then(() => { cerrarModalPedido(); cargarPedidos(); })
                .catch(err => alert(err.message));
        }
    });

    window.borrarPedido = function(id) { 
        if (confirm("¿Borrar pedido?")) fetch(`/api/pedidos/${id}`, { method: 'DELETE' }).then(() => cargarPedidos()); 
    }
    
    window.cambiarEstado = function(id, estadoActual) {
        const nuevo = estadoActual === 'Pendiente' ? 'Completado' : 'Pendiente';
        fetch(`/api/pedidos/${id}/estado`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevo }) }).then(() => cargarPedidos());
    }

    cargarPedidos();
    chequearWhatsApp();
    setInterval(() => { cargarPedidos(); chequearWhatsApp(); }, 3000);
}

function actualizarResumenPanelPedidos() {
        // Cargar stock detallado por tipo (llenas y vacías)
        fetch('/api/stock')
            .then(res => res.json())
            .then(stock => {
                const elStock = document.getElementById('resumen-stock-pedidos');
                if (elStock) {
                    let htmlStock = '';
                    stock.forEach(s => {
                        htmlStock += `<div><strong>${s.tipo}:</strong> 🟢 ${s.llenas} | 🟠 ${s.vacias}</div>`;
                    });
                    elStock.innerHTML = htmlStock;
                }
            })
            .catch(err => console.error("Error al cargar stock para el panel:", err));

        // Cargar pedidos de hoy y separar cobrados de pendientes
        fetch('/api/pedidos/hoy')
            .then(res => res.json())
            .then(pedidos => {
                let garrafasHoy = 0;
                let cobradoHoy = 0;
                let pendienteHoy = 0;

                pedidos.forEach(p => {
                    garrafasHoy += parseInt(p.cantidad) || 0;
                    const metodoPago = p.forma_pago ? p.forma_pago.trim() : 'Efectivo';
                    const monto = parseFloat(p.total) || 0;

                    if (metodoPago === 'Pendiente') {
                        pendienteHoy += monto;
                    } else {
                        cobradoHoy += monto;
                    }
                });

                document.getElementById('resumen-garrafas-pedidos').textContent = `${garrafasHoy} un.`;
                document.getElementById('resumen-cobrado-pedidos').textContent = `$${cobradoHoy.toLocaleString()}`;
                document.getElementById('resumen-pendiente-pedidos').textContent = `$${pendienteHoy.toLocaleString()}`;
            })
            .catch(err => console.error("Error al cargar resumen de ventas de hoy:", err));
    }


// ==========================================
// HISTORIAL DE CLIENTES Y MODALES
// ==========================================
window.verHistorialCliente = function(clienteId, nombreCliente) {
    document.getElementById('titulo-historial').textContent = `Historial de Pedidos - ${nombreCliente}`;
    fetch(`/api/clientes/${clienteId}/pedidos`)
        .then(res => res.json())
        .then(pedidos => {
            const tbody = document.getElementById('cuerpo-tabla-historial');
            tbody.innerHTML = '';
            if (pedidos.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Este cliente no tiene pedidos registrados.</td></tr>`;
            } else {
                pedidos.forEach(p => {
                    const fechaFormateada = p.fecha ? p.fecha.substring(0, 10) : '';
                    const horaFormateada = p.fecha ? p.fecha.substring(11, 16) : '';
                    tbody.innerHTML += `
                        <tr>
                            <td>#${p.id}</td>
                            <td><strong>${p.cliente_nombre || 'Desconocido'}</strong><br><small>${p.cliente_telefono || ''}</small></td>
                            <td>${p.tipo}</td>
                            <td>${p.cantidad}</td>
                            <td>$${p.total}</td>
                            <td>${fechaFormateada} ${horaFormateada}</td>
                            <td><span style="font-weight:bold; color:${p.estado==='Pendiente'?'#e67e22':'#27ae60'}">${p.estado}</span></td>
                        </tr>`;
                });
            }
            document.getElementById('modal-historial').style.display = 'flex';
        });
}

window.cerrarModalHistorial = function() {
    document.getElementById('modal-historial').style.display = 'none';
}

// ==========================================
// LÓGICA DE WHATSAPP
// ==========================================
function chequearWhatsApp() {
    fetch('/api/whatsapp/qr')
        .then(res => res.json())
        .then(data => {
            const txt = document.getElementById('whatsapp-estado');
            const qrDiv = document.getElementById('contenedor-qr');
            if (!txt || !qrDiv) return;
            if (data.estado === 'Conectado') {
                txt.textContent = "✅ WhatsApp Conectado";
                txt.style.color = "#27ae60";
                qrDiv.innerHTML = "";
            } else {
                txt.textContent = "⚠️ Escanea el QR para conectar";
                txt.style.color = "#e67e22";
                if (data.qr) {
                    qrDiv.innerHTML = `<img src="${data.qr}" style="width:160px; height:160px;">`;
                }
            }
        })
        .catch(err => console.error("Error al chequear WhatsApp:", err));
}

window.reiniciarWhatsApp = function() {
    if (confirm("¿Seguro que deseas desvincular WhatsApp y generar un nuevo QR?")) {
        fetch('/api/whatsapp/reiniciar', { method: 'POST' })
            .then(res => res.json())
            .then(() => {
                alert("Reiniciando conexión... Espera unos segundos y recarga la página.");
                chequearWhatsApp();
            })
            .catch(err => console.error("Error al reiniciar WhatsApp:", err));
    }
}

if (document.getElementById('whatsapp-estado')) {
    chequearWhatsApp();
    setInterval(chequearWhatsApp, 3000);
}

// ==========================================
// BUSCADORES Y FILTROS
// ==========================================
window.filtrarClientes = function() {
    const input = document.getElementById('buscador-cliente');
    if (!input) return;
    const filtro = input.value.toLowerCase();
    const tbody = document.getElementById('cuerpo-tabla-clientes');
    if (!tbody) return;
    const filas = tbody.getElementsByTagName('tr');

    for (let i = 0; i < filas.length; i++) {
        const columnaNombre = filas[i].getElementsByTagName('td')[0];
        if (columnaNombre) {
            const textoNombre = columnaNombre.textContent || columnaNombre.innerText;
            filas[i].style.display = textoNombre.toLowerCase().indexOf(filtro) > -1 ? "" : "none";
        }
    }
}

// ==========================================
// AUTENTICACIÓN Y PERMISOS
// ==========================================
const formLogin = document.getElementById('form-login');
if (formLogin) {
    formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const usuario = document.getElementById('login-usuario').value;
        const password = document.getElementById('login-password').value;

        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, password })
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al iniciar sesión");
            return data;
        })
        .then(data => {
            localStorage.setItem('usuarioLogueado', JSON.stringify(data));
            window.location.href = 'pedidos.html';
        })
        .catch(err => alert(err.message));
    });
}

function verificarPermisos() {
    const user = JSON.parse(localStorage.getItem('usuarioLogueado'));
    if (!user) {
        if (!window.location.href.includes('login.html')) {
            window.location.href = 'login.html';
        }
        return;
    }

    if (user.rol === 'repartidor') {
        const linkStock = document.getElementById('nav-stock');
        if (linkStock) linkStock.style.display = 'none';
        
        if (window.location.href.includes('stock.html')) {
            alert("No tienes permisos para acceder a este apartado.");
            window.location.href = 'pedidos.html';
        }
    }
}

document.addEventListener("DOMContentLoaded", verificarPermisos);

window.cerrarSesion = function() {
    localStorage.removeItem('usuarioLogueado');
    window.location.href = 'login.html';
}

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
            actualizarMetricasVentas({
                recaudado: 0, efectivo: 0, mp: 0, transf: 0, pendiente: 0,
                totalGarrafas: 0, c10: 0, c15: 0, c30: 0, c45: 0
            });
            return;
        }

        let totalRecaudadoGeneral = 0;
        let efectivoTotal = 0;
        let mpTotal = 0;
        let transfTotal = 0;
        let pendienteTotal = 0;

        let totalGarrafasGeneral = 0;
        let cant10 = 0;
        let cant15 = 0;
        let cant30 = 0;
        let cant45 = 0;

        ventas.forEach(v => {
            const fechaFormateada = v.fecha ? v.fecha.substring(0, 10) : '';
            const horaFormateada = v.fecha ? v.fecha.substring(11, 16) : '';
            
            const metodoPago = v.forma_pago ? v.forma_pago.trim() : 'Efectivo';
            const monto = parseFloat(v.total) || 0;
            const cantidad = parseInt(v.cantidad) || 0;

            totalGarrafasGeneral += cantidad;

            // Conteo por gramaje
            if (v.tipo === '10kg') cant10 += cantidad;
            if (v.tipo === '15kg') cant15 += cantidad;
            if (v.tipo === '30kg') cant30 += cantidad;
            if (v.tipo === '45kg') cant45 += cantidad;

            // Acumulado por tipo de pago
            if (metodoPago === 'Efectivo') {
                efectivoTotal += monto;
                totalRecaudadoGeneral += monto;
            } else if (metodoPago === 'Mercado Pago') {
                mpTotal += monto;
                totalRecaudadoGeneral += monto;
            } else if (metodoPago === 'Transferencia') {
                transfTotal += monto;
                totalRecaudadoGeneral += monto;
            } else if (metodoPago === 'Pendiente') {
                pendienteTotal += monto;
            }

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

        actualizarMetricasVentas({
            recaudado: totalRecaudadoGeneral,
            efectivo: efectivoTotal,
            mp: mpTotal,
            transf: transfTotal,
            pendiente: pendienteTotal,
            totalGarrafas: totalGarrafasGeneral,
            c10: cant10,
            c15: cant15,
            c30: cant30,
            c45: cant45
        });
    }
    function actualizarMetricasVentas(m) {
    const actualizarTexto = (id, valor) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
    };

    actualizarTexto('total-recaudado', `$${m.recaudado.toLocaleString()}`);
    actualizarTexto('pago-efectivo', `$${m.efectivo.toLocaleString()}`);
    actualizarTexto('pago-mp', `$${m.mp.toLocaleString()}`);
    actualizarTexto('pago-transf', `$${m.transf.toLocaleString()}`);
    actualizarTexto('pago-pendiente', `$${m.pendiente.toLocaleString()}`);

    actualizarTexto('total-garrafas', `${m.totalGarrafas} unidades`);
    actualizarTexto('garrafas-10', `${m.c10} un.`);
    actualizarTexto('garrafas-15', `${m.c15} un.`);
    actualizarTexto('garrafas-30', `${m.c30} un.`);
    actualizarTexto('garrafas-45', `${m.c45} un.`);
}


    function cargarVentas() {
        fetch('/api/pedidos')
            .then(res => res.json())
            .then(pedidos => {
                ventasGlobales = pedidos.filter(p => p.estado === 'Completado');
                renderizarVentas(ventasGlobales);
                inicializarMapaVentas(ventasGlobales);

                
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
        const input = document.getElementById('buscador-ventas');
        if (!input) return;
        const texto = input.value.toLowerCase();
        
        let filtradas = ventasGlobales.filter(v => {
            const cliente = (v.cliente_nombre || '').toLowerCase();
            const tipo = (v.tipo || '').toLowerCase();
            const direccion = (v.direccion || '').toLowerCase(); // 👈 Captura la dirección del cliente
            
            return cliente.includes(texto) || tipo.includes(texto) || direccion.includes(texto);
        });
        
        renderizarVentas(filtradas);
        inicializarMapaVentas(filtradas); // 👈 Actualiza el mapa y las estadísticas con los filtrados
    }

    window.limpiarFiltrosVentas = function() {
        document.getElementById('filtro-ventas-desde').value = '';
        document.getElementById('filtro-ventas-hasta').value = '';
        document.getElementById('buscador-ventas').value = '';
        renderizarVentas(ventasGlobales);
    }

    cargarVentas();
}




// ============================
// LÓGICA DEL LIBRO DIARIO
// ============================
let todosLosPedidosDiario = [];

window.cargarLibroDiario = function() {
    return fetch('/api/pedidos')
        .then(res => res.json())
        .then(pedidos => {
            todosLosPedidosDiario = pedidos;
            filtrarYRenderizarDiario();
        })
        .catch(err => console.error("Error al cargar datos para el libro diario:", err));
}

window.filtrarDiarioHoy = function() {
    const inputDesde = document.getElementById('filtro-diario-desde');
    const inputHasta = document.getElementById('filtro-diario-hasta');
    const inputBuscador = document.getElementById('buscador-diario');
    
    if (inputBuscador) inputBuscador.value = '';

    const fechaLocal = new Date();
    const anio = fechaLocal.getFullYear();
    const mes = String(fechaLocal.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaLocal.getDate()).padStart(2, '0');
    const hoy = `${anio}-${mes}-${dia}`;
    
    if (inputDesde) inputDesde.value = hoy;
    if (inputHasta) inputHasta.value = hoy;

    filtrarYRenderizarDiario();
};

window.ponerDiaHoy = function() {
    window.filtrarDiarioHoy();
};

window.cambiarDia = function(dias) {
    const inputDesde = document.getElementById('filtro-diario-desde');
    if (!inputDesde) return;
    let fechaActual = inputDesde.value ? new Date(inputDesde.value + 'T00:00:00') : new Date();
    fechaActual.setDate(fechaActual.getDate() + dias);
    inputDesde.value = fechaActual.toISOString().substring(0, 10);
    const inputHasta = document.getElementById('filtro-diario-hasta');
    if (inputHasta) inputHasta.value = inputDesde.value;
    filtrarYRenderizarDiario();
};

window.filtrarDiarioPorFecha = function() {
    filtrarYRenderizarDiario();
};

window.filtrarDiarioTexto = function() {
    filtrarYRenderizarDiario();
};

window.limpiarFiltrosDiario = function() {
    const inputDesde = document.getElementById('filtro-diario-desde');
    const inputHasta = document.getElementById('filtro-diario-hasta');
    const inputBuscador = document.getElementById('buscador-diario');
    
    if (inputDesde) inputDesde.value = '';
    if (inputHasta) inputHasta.value = '';
    if (inputBuscador) inputBuscador.value = '';
    
    filtrarYRenderizarDiario();
};

function filtrarYRenderizarDiario() {
    const tbody = document.getElementById('cuerpo-tabla-diario');
    if (!tbody) return;
    tbody.innerHTML = '';

    const desde = document.getElementById('filtro-diario-desde')?.value;
    const hasta = document.getElementById('filtro-diario-hasta')?.value;
    const texto = document.getElementById('buscador-diario')?.value.toLowerCase() || '';

    let totalCobrado = 0, efec = 0, mp = 0, transf = 0, pend = 0;
    let totUnidades = 0, u10 = 0, u15 = 0, u30 = 0, u45 = 0;

    const pedidosFiltrados = todosLosPedidosDiario.filter(p => {
        if (!p.fecha) return false;
        const fechaPedido = p.fecha.substring(0, 10);
        if (desde && fechaPedido < desde) return false;
        if (hasta && fechaPedido > hasta) return false;

        if (texto) {
            const cliente = (p.cliente_nombre || '').toLowerCase();
            const tipo = (p.tipo || '').toLowerCase();
            const idStr = String(p.id || '');
            if (!cliente.includes(texto) && !tipo.includes(texto) && !idStr.includes(texto)) return false;
        }
        return true;
    });

    pedidosFiltrados.forEach(p => {
        const fecha = p.fecha ? p.fecha.substring(0, 10) : '';
        const hora = p.fecha ? p.fecha.substring(11, 16) : '';
        const monto = parseFloat(p.total) || 0;
        const cant = parseInt(p.cantidad) || 0;
        const metodo = p.forma_pago || 'Efectivo';
        const badgeEstado = p.estado === 'Completado' ? 
            `<span style="color:#27ae60; font-weight:bold;">Completado</span>` : 
            `<span style="color:#e67e22; font-weight:bold;">Pendiente</span>`;

        // Sumas
        totUnidades += cant;
        if(p.tipo === '10kg') u10 += cant;
        if(p.tipo === '15kg') u15 += cant;
        if(p.tipo === '30kg') u30 += cant;
        if(p.tipo === '45kg') u45 += cant;

        if (metodo === 'Efectivo') efec += monto;
        else if (metodo === 'Mercado Pago') mp += monto;
        else if (metodo === 'Transferencia') transf += monto;
        else pend += monto;
        totalCobrado += monto;

        tbody.innerHTML += `
            <tr>
                <td>${fecha}</td>
                <td>${hora}</td>
                <td><strong>${p.cliente_nombre || 'Desconocido'}</strong><br><small>${p.cliente_telefono || ''}</small></td>
                <td>${p.tipo}</td>
                <td>${cant}</td>
                <td style="font-weight: bold; color: #27ae60;">$${monto.toLocaleString()}</td>
                <td>${metodo}</td>
                <td>${badgeEstado}</td>
            </tr>`;
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

// Al iniciar el script o al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('cuerpo-tabla-diario')) {
        // 1. Establecer fecha de hoy en los inputs de rango
        const fechaLocal = new Date();
        const anio = fechaLocal.getFullYear();
        const mes = String(fechaLocal.getMonth() + 1).padStart(2, '0');
        const dia = String(fechaLocal.getDate()).padStart(2, '0');
        const hoy = `${anio}-${mes}-${dia}`;

        const inputDesde = document.getElementById('filtro-diario-desde');
        const inputHasta = document.getElementById('filtro-diario-hasta');
        
        if (inputDesde) inputDesde.value = hoy;
        if (inputHasta) inputHasta.value = hoy;

        // 2. Cargar los datos y renderizar el día actual
        cargarLibroDiario();
    }
});



let mapaVentas = null;
const centroNogoya = [-32.3947, -59.7894];

window.centrarMapaNogoya = function() {
    if (mapaVentas) {
        mapaVentas.setView(centroNogoya, 13);
    }
};

function inicializarMapaVentas(ventasConDireccion) {
    const contenedorMapa = document.getElementById('mapa-ventas');
    if (!contenedorMapa) return;

    if (mapaVentas) {
        mapaVentas.remove();
    }

    mapaVentas = L.map('mapa-ventas').setView(centroNogoya, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapaVentas);

    let zonasMap = {};
    ventasConDireccion.forEach(v => {
        if (!v.direccion) return;
        const dirKey = v.direccion.trim().toLowerCase();
        if (!zonasMap[dirKey]) {
            zonasMap[dirKey] = {
                direccionOriginal: v.direccion,
                cantidadTotal: 0,
                montoTotal: 0,
                clientes: new Set()
            };
        }
        zonasMap[dirKey].cantidadTotal += parseInt(v.cantidad) || 0;
        zonasMap[dirKey].montoTotal += parseFloat(v.total) || 0;
        if (v.cliente_nombre) zonasMap[dirKey].clientes.add(v.cliente_nombre);
    });

    let zonasArray = Object.values(zonasMap);
    zonasArray.sort((a, b) => b.cantidadTotal - a.cantidadTotal);
    renderizarPanelEstadisticasZonas(zonasArray);

    zonasArray.forEach((zona, index) => {
        const direccionCompleta = `${zona.direccionOriginal}, Nogoyá, Entre Ríos, Argentina`;

        setTimeout(() => {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccionCompleta)}`)
                .then(res => res.json())
                .then(data => {
                    let lat, lon;
                    if (data && data.length > 0) {
                        lat = parseFloat(data[0].lat);
                        lon = parseFloat(data[0].lon);
                    } else {
                        // Fallback: Si el mapa no encuentra la dirección exacta, se ubica en Nogoyá con un desplazamiento aleatorio seguro
                        lat = centroNogoya[0] + (Math.random() - 0.5) * 0.025;
                        lon = centroNogoya[1] + (Math.random() - 0.5) * 0.025;
                    }

                    let colorRojo = '#f1c40f'; // Amarillo para 1 unidad
let radio = 8;

if (zona.cantidadTotal >= 10) {
    colorRojo = '#8b0000'; // Rojo oscuro (alta concentración masiva)
    radio = 20;
} else if (zona.cantidadTotal >= 5) {
    colorRojo = '#c0392b'; // Rojo intenso
    radio = 15;
} else if (zona.cantidadTotal >= 3) {
    colorRojo = '#e67e22'; // Naranja (moderada)
    radio = 11;
}

                    const circleMarker = L.circleMarker([lat, lon], {
                        radius: radio,
                        fillColor: colorRojo,
                        color: '#ffffff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.85
                    }).addTo(mapaVentas);

                    const listaClientes = Array.from(zona.clientes).join(', ');
                    circleMarker.bindPopup(`
                        <div style="font-size: 13px;">
                            <b>Zona / Dirección:</b> ${zona.direccionOriginal}<br>
                            <b>Total Garrafas:</b> ${zona.cantidadTotal} un.<br>
                            <b>Recaudado:</b> $${zona.montoTotal.toLocaleString()}<br>
                            <b>Clientes:</b> ${listaClientes}
                        </div>
                    `);
                })
                .catch(err => {
                    console.error("Error de red al geocodificar zona:", err);
                });
        }, index * 700);
    });
}

function renderizarPanelEstadisticasZonas(zonas) {
    const panel = document.getElementById('panel-estadisticas-zonas');
    if (!panel) return;
    panel.innerHTML = '';

    if (zonas.length === 0) {
        panel.innerHTML = '<span style="color: #7f8c8d; text-align: center;">No hay datos de zonas para mostrar.</span>';
        return;
    }

    const maxUnidades = zonas[0].cantidadTotal || 1;

    zonas.forEach(z => {
        const porcentaje = Math.round((z.cantidadTotal / maxUnidades) * 100);
        let colorBarra = '#f1c40f';
        if (z.cantidadTotal >= 5) colorBarra = '#c0392b';
        else if (z.cantidadTotal >= 3) colorBarra = '#e67e22';

        panel.innerHTML += `
            <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 10px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px; color: #2c3e50;">
                    <span>📍 ${z.direccionOriginal}</span>
                    <span style="color: #27ae60;">${z.cantidadTotal} un. ($${z.montoTotal.toLocaleString()})</span>
                </div>
                <div style="background: #e1e8ed; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;">
                    <div style="background: ${colorBarra}; width: ${porcentaje}%; height: 100%; transition: width 0.4s;"></div>
                </div>
            </div>
        `;
    });
}


