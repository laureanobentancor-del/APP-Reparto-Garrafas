// ==========================================
// VARIABLES GLOBALES
// ==========================================
let pedidosGlobales = [];


// ==========================================
// RESTRICCIÓN GLOBAL AUTOMÁTICA POR ID/NOMBRE
// ==========================================
document.addEventListener('input', function (e) {
    const input = e.target;
    if (input.tagName !== 'INPUT') return;

    // Unimos el ID y el nombre del input en minúsculas para analizarlos
    const identificador = (input.id + ' ' + (input.name || '')).toLowerCase();

    // 1. RESTRICCIÓN DE NÚMEROS: Si el ID o nombre contiene 'telefono', 'cantidad', 'llenas', 'vacias' o 'precio'
    if (
        identificador.includes('telefono') || 
        identificador.includes('cantidad') || 
        identificador.includes('llenas') || 
        identificador.includes('vacias') || 
        identificador.includes('precio')
    ) {
        input.value = input.value.replace(/\D/g, '');
    }

    // 2. RESTRICCIÓN DE LETRAS: Si el ID o nombre contiene 'nombre'
    else if (identificador.includes('nombre')) {
        input.value = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    }
});

// ==========================================
// VALIDACIÓN DE CONTRASEÑA EN TIEMPO REAL
// ==========================================
const passwordInput = document.getElementById('nueva-pass'); // <--- Acá corregimos al ID real de tu HTML
const errorPassword = document.getElementById('error-password');
const formUsuario = document.getElementById('form-usuario'); 

if (passwordInput && errorPassword) {
    function evaluarPassword(password) {
        const regexPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        return regexPassword.test(password);
    }

    passwordInput.addEventListener('input', function() {
        const valor = passwordInput.value;

        if (valor === "") {
            errorPassword.style.display = 'none';
            passwordInput.style.borderColor = '';
        } else if (!evaluarPassword(valor)) {
            errorPassword.textContent = "Debe tener al menos 8 caracteres, mayúsculas, minúsculas, números y un carácter especial.";
            errorPassword.style.display = 'block';
            passwordInput.style.borderColor = '#e74c3c';
        } else {
            errorPassword.style.display = 'none';
            passwordInput.style.borderColor = '#27ae60';
        }
    });

    if (formUsuario) {
        formUsuario.addEventListener('submit', function(e) {
            const valor = passwordInput.value;
            if (!evaluarPassword(valor)) {
                e.preventDefault();
                errorPassword.textContent = "La contraseña no cumple con los requisitos de seguridad.";
                errorPassword.style.display = 'block';
                passwordInput.style.borderColor = '#e74c3c';
                passwordInput.focus();
            }
        });
    }
}

// ==========================================
// LÓGICA DE CLIENTES
// ==========================================
function cargarClientes() {
    const tbody = document.getElementById('cuerpo-tabla-clientes');
    
    // Verificación de seguridad interna (si no está en la página, sale silenciosamente)
    if (!tbody) return; 

    fetch('/api/clientes')
        .then(res => res.json())
        .then(clientes => {
            tbody.innerHTML = '';
            clientes.forEach(c => {
                tbody.innerHTML += `
                        <tr>
                            <td><strong>${c.nombre}</strong></td>
                            <td>${c.telefono}</td>
                            <td>${c.direccion || '-'}</td>
                            <td>
                                <button class="btn-accion btn-editar" title="Editar cliente" onclick="editarCliente(${c.id}, '${c.nombre}', '${c.telefono}', '${c.direccion || ''}')">✏️</button>
                                <button class="btn-accion btn-historial" title="Ver historial" onclick="verHistorialCliente(${c.id}, '${c.nombre}')">📋</button>
                                <button class="btn-accion btn-eliminar" title="Borrar cliente" onclick="borrarCliente(${c.id})">🗑️</button>
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

    const formCliente = document.getElementById('form-cliente');
if (formCliente) {
    formCliente.addEventListener('submit', (e) => {
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
        })
        .then(() => {
            cerrarModalCliente();
            cargarClientes();
        });
    });
}

    window.borrarCliente = function(id) {
        if (confirm("¿Estás seguro de borrar este cliente?")) {
            fetch(`/api/clientes/${id}`, { method: 'DELETE' }).then(() => cargarClientes());
        }
    }

    cargarClientes();


// ==========================================
// LÓGICA DE STOCK
// ==========================================
function cargarStock() {
    const tbody = document.getElementById('cuerpo-tabla-stock');
    if (!tbody) return; // No estamos en stock.html, salimos sin hacer nada

    fetch('/api/stock')
        .then(res => res.json())
        .then(stock => {
            tbody.innerHTML = '';
            stock.forEach(s => {
                const total = (s.llenas || 0) + (s.vacias || 0);
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${s.tipo}</strong></td>
                        <td>${s.llenas}</td>
                        <td>${s.vacias}</td>
                        <td>$${Number(s.precio).toLocaleString()}</td>
                        <td>${total}</td>
                        <td>
                            <button class="btn-accion btn-editar" title="Editar stock" onclick="abrirModalStock('${s.tipo}', ${s.llenas}, ${s.vacias}, ${s.precio})">✏️</button>
                        </td>
                    </tr>
                `;
            });
        })
        .catch(err => console.error("Error al cargar stock:", err));
}

const formStock = document.getElementById('form-stock');
if (formStock) {
    formStock.addEventListener('submit', (e) => {
        e.preventDefault(); 
        const tipo = document.getElementById('stock-tipo').value;
        const data = {
            llenas: parseInt(document.getElementById('stock-llenas').value),
            vacias: parseInt(document.getElementById('stock-vacias').value),
            precio: parseFloat(document.getElementById('stock-precio').value)
        };

        // 👇 ¡Es aquí adentro donde debe ir 'credentials: 'include''! 👇
        fetch(`/api/stock/${tipo}`, {
            method: 'PUT',
            credentials: 'include', // 👈 Esto le avisa al navegador que mande la cookie de sesión
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(res => {
            if (!res.ok) throw new Error("No autorizado o error al actualizar stock");
            return res.json();
        })
        .then(() => {
            if (typeof cerrarModalStock === 'function') cerrarModalStock();
            cargarStock(); // Recarga la tabla para que se vea el cambio
        })
        .catch(err => alert(err.message));
    });
}

window.abrirModalStock = function(tipo, llenas, vacias, precio) {
    document.getElementById('titulo-modal-stock').textContent = `Actualizar Stock: ${tipo}`;
    document.getElementById('stock-tipo').value = tipo;
    document.getElementById('stock-llenas').value = llenas;
    document.getElementById('stock-vacias').value = vacias;
    document.getElementById('stock-precio').value = precio;
    document.getElementById('modal-stock').style.display = 'flex';
}

window.cerrarModalStock = function() {
    document.getElementById('modal-stock').style.display = 'none';
}

cargarStock();

// ==========================================
// FUNCIÓN AUXILIAR DE RESUMEN (Global)
// ==========================================
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

            const elGarrafas = document.getElementById('resumen-garrafas-pedidos');
            const elCobrado = document.getElementById('resumen-cobrado-pedidos');
            const elPendiente = document.getElementById('resumen-pendiente-pedidos');

            if (elGarrafas) elGarrafas.textContent = `${garrafasHoy} un.`;
            if (elCobrado) elCobrado.textContent = `$${cobradoHoy.toLocaleString()}`;
            if (elPendiente) elPendiente.textContent = `$${pendienteHoy.toLocaleString()}`;
        })
        .catch(err => console.error("Error al cargar resumen de ventas de hoy:", err));
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
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No se encontraron pedidos.</td></tr>`;
            return;
        }

        // --- ORDENAR: Primero los Pendientes, luego los demás ---
       // --- ORDENAR: Primero Pendientes ordenados por fecha (antiguos arriba), luego completados ---
pedidos.sort((a, b) => {
    const estadoA = (a.estado || '').trim();
    const estadoB = (b.estado || '').trim();

    // 1. Prioridad absoluta a los Pendientes sobre los Completados
    if (estadoA === 'Pendiente' && estadoB !== 'Pendiente') return -1;
    if (estadoA !== 'Pendiente' && estadoB === 'Pendiente') return 1;

    // 2. Si ambos son Pendientes, ordenar por fecha de forma ascendente (lo más viejo arriba)
    if (estadoA === 'Pendiente' && estadoB === 'Pendiente') {
        const fechaA = a.fecha ? new Date(a.fecha).getTime() : 0;
        const fechaB = b.fecha ? new Date(b.fecha).getTime() : 0;
        return fechaA - fechaB; // Ascendente: Entre más viejo el pendiente, más arriba aparece
    }

    // 3. Para los demás casos (ej. completados), mantener orden descendente por ID
    return b.id - a.id;
});

        pedidos.forEach(p => {
            const fechaFormateada = p.fecha ? p.fecha.substring(0, 10) : '';
            const horaFormateada = p.fecha ? p.fecha.substring(11, 16) : '';
            
            const metodoPago = p.forma_pago ? p.forma_pago.trim() : 'Efectivo';
            
            let iconoPago = '💵 Efectivo';
            if (metodoPago === 'Mercado Pago') iconoPago = '📱 Mercado Pago';
            if (metodoPago === 'Transferencia') iconoPago = '🏦 Transferencia';
            if (metodoPago === 'Pendiente') iconoPago = '⏳ Pendiente';

            let tipoVentaTexto = '🏭 Depósito';
            let badgeColor = '#3498db';
            
            if (p.tipo_venta === 'reparto') {
                tipoVentaTexto = '🚚 Reparto';
                badgeColor = '#e67e22';
            } else if (p.tipo_venta === 'comercios') {
                tipoVentaTexto = '🏪 Comercios';
                badgeColor = '#9b59b6';
            }

            if (p.estado === 'Completado') {
                botonesAccion = '';
                columnaEstado = `<span style="font-weight:bold; color:#27ae60;">${p.estado}</span>`;
            } else {
                botonesAccion = `
                    <button class="btn-accion btn-editar" title="Editar pedido" onclick="editarPedido(${p.id}, '${p.tipo}', ${p.cantidad})">✏️</button> 
                    <button class="btn-accion btn-eliminar" title="Borrar pedido" onclick="borrarPedido(${p.id})">🗑️</button>
                `;
                columnaEstado = `<span onclick="cambiarEstado(${p.id}, '${p.estado}')" style="cursor:pointer; font-weight:bold; color:#e67e22;" title="Hacer clic para completar">${p.estado}</span>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td><strong>${p.cliente_nombre || 'Desconocido'}</strong><br><small>${p.cliente_telefono || ''}</small></td>
                    <td>${p.tipo}</td>
                    <td><span style="background: ${badgeColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold;">${tipoVentaTexto}</span></td>
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
        document.getElementById('titulo-modal-pedido').textContent = "Nuevo Pedido";
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
        const tipo_venta = document.getElementById('pedido-tipo-venta').value;

        if (id) {
            fetch(`/api/pedidos/${id}`, { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ tipo, cantidad, tipo_venta }) 
            })
            .then(() => { cerrarModalPedido(); cargarPedidos(); });
        } else {
            fetch('/api/pedidos', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ cliente_id: document.getElementById('pedido-cliente').value, tipo, cantidad, forma_pago, tipo_venta }) 
            })
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

    function iniciarModuloPedidos() {
        cargarPedidos();
        chequearWhatsApp();
        
        setInterval(() => { 
            if (!document.hidden) {
                cargarPedidos(); 
                chequearWhatsApp(); 
            }
        }, 3000);
    }

    if (document.prerendering) {
        document.addEventListener('prerenderingchange', () => {
            iniciarModuloPedidos();
        }, { once: true });
    } else {
        iniciarModuloPedidos();
    }
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

    // --- LÓGICA DE NAVEGACIÓN POR TECLADO EN LA TABLA ---
  let indiceFilaActiva = -1;

    function resaltarFilaActual(filas) {
        filas.forEach((fila, idx) => {
            if (idx === indiceFilaActiva) {
                fila.classList.add('fila-seleccionada');
                // Esto hace que el contenedor haga scroll automático a la fila activa
                fila.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                fila.classList.remove('fila-seleccionada');
            }
        });
    }

    const contenedorTablaVentas = document.getElementById('contenedor-tabla-ventas');
    if (contenedorTablaVentas) {
        contenedorTablaVentas.addEventListener('keydown', (e) => {
            const tbody = document.getElementById('cuerpo-tabla-ventas');
            if (!tbody) return;
            const filas = tbody.querySelectorAll('tr');
            if (filas.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (indiceFilaActiva < filas.length - 1) {
                    indiceFilaActiva++;
                } else {
                    indiceFilaActiva = 0; // Vuelve al inicio si llega al final
                }
                resaltarFilaActual(filas);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (indiceFilaActiva > 0) {
                    indiceFilaActiva--;
                } else {
                    indiceFilaActiva = filas.length - 1; // Va al final si está en el primero
                }
                resaltarFilaActual(filas);
            }
        });
    }
    
    function renderizarVentas(ventas) {
        const tbody = document.getElementById('cuerpo-tabla-ventas');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        indiceFilaActiva = -1;

        if (ventas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No se encontraron registros de ventas.</td></tr>`;
            actualizarMetricasVentasPorCanal([]);
            return;
        }

        ventas.forEach(v => {
            const fechaFormateada = v.fecha ? v.fecha.substring(0, 10) : '';
            const horaFormateada = v.fecha ? v.fecha.substring(11, 16) : '';
            const metodoPago = v.forma_pago ? v.forma_pago.trim() : 'Efectivo';
            
            // Tipo de venta formateado para visualización
            let tipoVentaTexto = '🏭 Depósito';
            let badgeColor = '#3498db';
            if (v.tipo_venta === 'reparto') {
                tipoVentaTexto = '🚚 Reparto';
                badgeColor = '#e67e22';
            } else if (v.tipo_venta === 'comercios') {
                tipoVentaTexto = '🏪 Comercios';
                badgeColor = '#9b59b6';
            }

            let columnaPago = `<span style="font-weight: bold; color: #27ae60;">💵 ${metodoPago}</span>`;

            tbody.innerHTML += `
                <tr>
                    <td>#${v.id}</td>
                    <td><strong>${v.cliente_nombre || 'Desconocido'}</strong><br><small>${v.cliente_telefono || ''}</small></td>
                    <td><span style="background: ${badgeColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold;">${tipoVentaTexto}</span></td>
                    <td>${v.tipo}</td>
                    <td>${v.cantidad}</td>
                    <td style="font-weight: bold; color: #27ae60;">$${v.total}</td>
                    <td>${columnaPago}</td>
                    <td>${fechaFormateada} ${horaFormateada}</td>
                    <td><span style="font-weight:bold; color:#27ae60;">${v.estado}</span></td>
                </tr>`;
        });

        // Llamada a la función que calcula los totales por canal
        actualizarMetricasVentasPorCanal(ventas);
    }

    function actualizarMetricasVentasPorCanal(ventas) {
        // Inicializar contadores por canal
        const canales = {
            deposito: { cantidad: 0, monto: 0, c10: 0, c15: 0, c30: 0, c45: 0 },
            reparto: { cantidad: 0, monto: 0, c10: 0, c15: 0, c30: 0, c45: 0 },
            comercios: { cantidad: 0, monto: 0, c10: 0, c15: 0, c30: 0, c45: 0 }
        };

        ventas.forEach(v => {
            const canal = (v.tipo_venta && canales[v.tipo_venta]) ? v.tipo_venta : 'deposito';
            const cantidad = parseInt(v.cantidad) || 0;
            const monto = parseFloat(v.total) || 0;

            canales[canal].cantidad += cantidad;
            canales[canal].monto += monto;

            if (v.tipo === '10kg') canales[canal].c10 += cantidad;
            if (v.tipo === '15kg') canales[canal].c15 += cantidad;
            if (v.tipo === '30kg') canales[canal].c30 += cantidad;
            if (v.tipo === '45kg') canales[canal].c45 += cantidad;
        });

        // Actualizar DOM para Depósito
        document.getElementById('deposito-cantidad').textContent = `${canales.deposito.cantidad} un.`;
        document.getElementById('deposito-monto').textContent = `$${canales.deposito.monto.toLocaleString()}`;
        document.getElementById('deposito-detalle').textContent = `10kg: ${canales.deposito.c10} | 15kg: ${canales.deposito.c15} | 30kg: ${canales.deposito.c30} | 45kg: ${canales.deposito.c45}`;

        // Actualizar DOM para Reparto
        document.getElementById('reparto-cantidad').textContent = `${canales.reparto.cantidad} un.`;
        document.getElementById('reparto-monto').textContent = `$${canales.reparto.monto.toLocaleString()}`;
        document.getElementById('reparto-detalle').textContent = `10kg: ${canales.reparto.c10} | 15kg: ${canales.reparto.c15} | 30kg: ${canales.reparto.c30} | 45kg: ${canales.reparto.c45}`;

        // Actualizar DOM para Comercios
        document.getElementById('comercios-cantidad').textContent = `${canales.comercios.cantidad} un.`;
        document.getElementById('comercios-monto').textContent = `$${canales.comercios.monto.toLocaleString()}`;
        document.getElementById('comercios-detalle').textContent = `10kg: ${canales.comercios.c10} | 15kg: ${canales.comercios.c15} | 30kg: ${canales.comercios.c30} | 45kg: ${canales.comercios.c45}`;
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

window.ponerDiaHoy = function() {
    const inputDesde = document.getElementById('filtro-diario-desde');
    const inputHasta = document.getElementById('filtro-diario-hasta');
    const inputBuscador = document.getElementById('buscador-diario');
    
    if (inputBuscador) inputBuscador.value = '';

    const fechaLocal = new Date();
    const anio = fechaLocal.getFullYear();
    const mes = String(fechaLocal.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaLocal.getDate()).padStart(2, '0');
    
    // Concatenación tradicional (cero errores de sintaxis en editores)
    const hoy = anio + '-' + mes + '-' + dia;
    
    if (inputDesde) inputDesde.value = hoy;
    if (inputHasta) inputHasta.value = hoy;

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
    const canalSeleccionado = document.getElementById('filtro-diario-canal')?.value || 'todos';

    let totalCobrado = 0, efec = 0, mp = 0, transf = 0, pend = 0;
    let totUnidades = 0, u10 = 0, u15 = 0, u30 = 0, u45 = 0;

    // Objeto acumulador para los canales
    const canales = {
        deposito: { cantidad: 0, monto: 0, c10: 0, c15: 0, c30: 0, c45: 0 },
        reparto: { cantidad: 0, monto: 0, c10: 0, c15: 0, c30: 0, c45: 0 },
        comercios: { cantidad: 0, monto: 0, c10: 0, c15: 0, c30: 0, c45: 0 }
    };

    const pedidosFiltrados = todosLosPedidosDiario.filter(p => {
        if (!p.fecha) return false;
        const fechaPedido = p.fecha.substring(0, 10);
        if (desde && fechaPedido < desde) return false;
        if (hasta && fechaPedido > hasta) return false;

        if (canalSeleccionado !== 'todos') {
            const tipoVentaReg = p.tipo_venta ? p.tipo_venta.trim().toLowerCase() : 'deposito';
            if (tipoVentaReg !== canalSeleccionado) return false;
        }

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
        const metodo = p.forma_pago ? p.forma_pago.trim() : 'Efectivo';
        
        // --- CORRECCIÓN CLAVE ---
        // Normalizamos el tipo de venta. Si viene vacío o extraño, lo mandamos a 'deposito' por seguridad.
        let tipoVentaReg = p.tipo_venta ? p.tipo_venta.trim().toLowerCase() : 'deposito';
        if (!canales[tipoVentaReg]) {
            tipoVentaReg = 'deposito';
        }

        // Acumular en el canal correspondiente de forma segura
        canales[tipoVentaReg].cantidad += cant;
        canales[tipoVentaReg].monto += monto;
        
        const tipoGarrafa = (p.tipo || '').trim();
        if (tipoGarrafa === '10kg') canales[tipoVentaReg].c10 += cant;
        else if (tipoGarrafa === '15kg') canales[tipoVentaReg].c15 += cant;
        else if (tipoGarrafa === '30kg') canales[tipoVentaReg].c30 += cant;
        else if (tipoGarrafa === '45kg') canales[tipoVentaReg].c45 += cant;

        let tipoVentaTexto = '🏭 Depósito';
        let badgeColor = '#3498db';
        if (tipoVentaReg === 'reparto') {
            tipoVentaTexto = '🚚 Reparto';
            badgeColor = '#e67e22';
        } else if (tipoVentaReg === 'comercios') {
            tipoVentaTexto = '🏪 Comercios';
            badgeColor = '#9b59b6';
        }

        const badgeEstado = p.estado === 'Completado' ? 'Completado' : 'Pendiente';

        totUnidades += cant;
        if (tipoGarrafa === '10kg') u10 += cant;
        else if (tipoGarrafa === '15kg') u15 += cant;
        else if (tipoGarrafa === '30kg') u30 += cant;
        else if (tipoGarrafa === '45kg') u45 += cant;

        if (metodo === 'Efectivo') efec += monto;
        else if (metodo === 'Mercado Pago') mp += monto;
        else if (metodo === 'Transferencia') transf += monto;
        else pend += monto;
        totalCobrado += monto;

        tbody.innerHTML += `
            <tr>
                <td>${fecha} ${hora}</td>
                <td><strong>${p.cliente_nombre || 'Desconocido'}</strong><br><small>${p.cliente_telefono || ''}</small></td>
                <td><span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; font-weight: bold;">${tipoVentaTexto}</span></td>
                <td>${p.tipo}</td>
                <td>${cant}</td>
                <td style="font-weight: bold; color: #27ae60;">$${monto.toLocaleString()}</td>
                <td>${metodo}</td>
                <td>${badgeEstado}</td>
            </tr>`;
    });

    actualizarMetricasDiario(totalCobrado, efec, mp, transf, pend, totUnidades, u10, u15, u30, u45, canales);
}

window.filtrarDiarioPorCanal = function() {
    filtrarYRenderizarDiario();
};

function actualizarMetricasDiario(cobrado, efec, mp, transf, pend, totUnidades, u10, u15, u30, u45, canalesParam) {
    // 1. Resumen Financiero
    document.getElementById('diario-total-cobrado').textContent = `$${cobrado.toLocaleString()}`;
    document.getElementById('diario-efectivo').textContent = `$${efec.toLocaleString()}`;
    document.getElementById('diario-mp').textContent = `$${mp.toLocaleString()}`;
    document.getElementById('diario-transf').textContent = `$${transf.toLocaleString()}`;
    document.getElementById('diario-pendiente').textContent = `$${pend.toLocaleString()}`;

    // 2. Unidades Vendidas
    document.getElementById('diario-total-unidades').textContent = `${totUnidades} un.`;
    document.getElementById('diario-g10').textContent = `${u10} un.`;
    document.getElementById('diario-g15').textContent = `${u15} un.`;
    document.getElementById('diario-g30').textContent = `${u30} un.`;
    document.getElementById('diario-g45').textContent = `${u45} un.`;

    // 3. Resumen por Canal (Mapeado exacto con los IDs de diario.html)
    const canales = canalesParam || {
        deposito: { cantidad: 0, monto: 0, c10: 0, c15: 0, c30: 0, c45: 0 },
        reparto: { cantidad: 0, monto: 0, c10: 0, c15: 0, c30: 0, c45: 0 },
        comercios: { cantidad: 0, monto: 0, c10: 0, c15: 0, c30: 0, c45: 0 }
    };

    ['deposito', 'reparto', 'comercios'].forEach(c => {
        // Enlace corregido a los IDs de diario.html
        const elCant = document.getElementById(`diario-${c}-cant`);
        const elMonto = document.getElementById(`diario-${c}-monto`);
        const elDet = document.getElementById(`diario-${c}-det`);

        if (elCant) elCant.textContent = `${canales[c].cantidad} un.`;
        if (elMonto) elMonto.textContent = `$${canales[c].monto.toLocaleString()}`;
        if (elDet) {
           elDet.textContent = `10kg: \({canales[c].c10} | 15kg:\){canales[c].c15} | 30kg: \({canales[c].c30} | 45kg:\){canales[c].c45}`;
        }

    });
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
