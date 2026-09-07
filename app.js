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
            
            let botonesAccion = '';
            let columnaEstado = '';

            if (p.estado === 'Completado') {
                // Si está completado, no se muestra nada en la columna de acciones y el estado queda fijo sin enlace
                botonesAccion = '';
                columnaEstado = `<span style="font-weight:bold; color:#27ae60;">${p.estado}</span>`;
            } else {
                // Si está pendiente, se muestran los botones y la interacción para cambiar el estado
                botonesAccion = `
                    <button class="btn-accion btn-editar" onclick="editarPedido(${p.id}, '${p.tipo}', ${p.cantidad})">Editar</button> 
                    <button class="btn-accion btn-eliminar" onclick="borrarPedido(${p.id})">Borrar</button>
                `;
                columnaEstado = `<span onclick="cambiarEstado(${p.id}, '${p.estado}')" style="cursor:pointer; font-weight:bold; color:#e67e22;">${p.estado}</span>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td>#${p.id}</td>
                    <td><strong>${p.cliente_nombre || 'Desconocido'}</strong><br><small>${p.cliente_telefono || ''}</small></td>
                    <td>${p.tipo}</td>
                    <td>${p.cantidad}</td>
                    <td>$${p.total}</td>
                    <td>${fechaFormateada} ${horaFormateada}</td>
                    <td>${columnaEstado}</td>
                    <td>${botonesAccion}</td>
                </tr>`;
        });
    }

    function cargarPedidos() {
        const desde = document.getElementById('filtro-desde')?.value;
        const hasta = document.getElementById('filtro-hasta')?.value;
        
        // Obtenemos la fecha local exacta en formato YYYY-MM-DD evadiendo el desfase UTC
        const fechaLocal = new Date();
        const anio = fechaLocal.getFullYear();
        const mes = String(fechaLocal.getMonth() + 1).padStart(2, '0');
        const dia = String(fechaLocal.getDate()).padStart(2, '0');
        const hoy = `${anio}-${mes}-${dia}`;
        
        fetch('/api/pedidos')
            .then(res => res.json())
            .then(pedidos => {
                pedidosGlobales = pedidos; 
                
                if (window.filtroHoyActivo) {
                    const pedidosHoy = pedidos.filter(p => p.fecha && p.fecha.substring(0, 10) === hoy);
                    renderizarPedidos(pedidosHoy);
                } else if (desde || hasta) {
                    aplicarFiltroLocal(desde, hasta);
                } else {
                    renderizarPedidos(pedidos);
                }
            })
            .catch(err => console.error("Error al cargar pedidos:", err));
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
        if (id) {
            fetch(`/api/pedidos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, cantidad }) }).then(() => { cerrarModalPedido(); cargarPedidos(); });
        } else {
            fetch('/api/pedidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente_id: document.getElementById('pedido-cliente').value, tipo, cantidad }) }).then(() => { cerrarModalPedido(); cargarPedidos(); });
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

// ==========================================
// HISTORIAL DE CLIENTES Y MODALES (7 Columnas - Solo Lectura)
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

window.filtrarPedidosHoy = function() {
    window.filtroHoyActivo = true;
    const inputDesde = document.getElementById('filtro-desde');
    const inputHasta = document.getElementById('filtro-hasta');
    if (inputDesde) inputDesde.value = '';
    if (inputHasta) inputHasta.value = '';

    fetch('/api/pedidos/hoy')
        .then(res => res.json())
        .then(pedidos => {
            if (typeof renderizarPedidos === 'function') {
                renderizarPedidos(pedidos);
            }
        })
        .catch(err => console.error("Error al filtrar pedidos de hoy:", err));
}

window.filtrarPedidosPorFecha = function() {
    window.filtroHoyActivo = false;
    const desde = document.getElementById('filtro-desde').value;
    const hasta = document.getElementById('filtro-hasta').value;

    if (!pedidosGlobales || pedidosGlobales.length === 0) {
        fetch('/api/pedidos')
            .then(res => res.json())
            .then(pedidos => {
                pedidosGlobales = pedidos;
                aplicarFiltroLocal(desde, hasta);
            });
    } else {
        aplicarFiltroLocal(desde, hasta);
    }
}

function aplicarFiltroLocal(desde, hasta) {
    let filtrados = pedidosGlobales.filter(p => {
        if (!p.fecha) return false;
        const fechaPedido = p.fecha.substring(0, 10);
        if (desde && fechaPedido < desde) return false;
        if (hasta && fechaPedido > hasta) return false;
        return true;
    });

    if (typeof renderizarPedidos === 'function') {
        renderizarPedidos(filtrados);
    }
}

window.limpiarFiltrosFecha = function() {
    window.filtroHoyActivo = false;
    const inputDesde = document.getElementById('filtro-desde');
    const inputHasta = document.getElementById('filtro-hasta');
    
    if (inputDesde) inputDesde.value = '';
    if (inputHasta) inputHasta.value = '';
    
    fetch('/api/pedidos')
        .then(res => res.json())
        .then(pedidos => {
            pedidosGlobales = pedidos;
            if (typeof renderizarPedidos === 'function') {
                renderizarPedidos(pedidos);
            }
        })
        .catch(err => console.error("Error al limpiar filtros:", err));
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
        .catch(err => {
            alert(err.message);
        });
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