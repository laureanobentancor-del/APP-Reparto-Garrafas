// 'use strict';

// /* =====================================================================
//    APP.JS - Control de Garrafas
//    ---------------------------------------------------------------------
//    0. Utilidades
//    1. Validación de inputs
//    2. Autenticación y permisos
//    3. Clientes
//    4. Stock
//    5. WhatsApp
//    6. Pedidos
//    7. Ventas (tabla, forma de pago, mapa)
//    8. Libro diario
//    9. Arranque
//    ===================================================================== */


// /* =====================================================================
//    0. UTILIDADES
//    ===================================================================== */
// const $ = (id) => document.getElementById(id);

// function setTexto(id, texto) {
//     const el = $(id);
//     if (el) el.textContent = texto;
// }

// function escaparHTML(valor) {
//     const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
//     return String(valor ?? '').replace(/[&<>"']/g, (c) => mapa[c]);
// }

// function dinero(n) {
//     return '$' + (Number(n) || 0).toLocaleString();
// }

// // Fecha local en formato YYYY-MM-DD (sin desfase por UTC)
// function fechaLocalISO(fecha = new Date()) {
//     const anio = fecha.getFullYear();
//     const mes = String(fecha.getMonth() + 1).padStart(2, '0');
//     const dia = String(fecha.getDate()).padStart(2, '0');
//     return `${anio}-${mes}-${dia}`;
// }

// function esperar(ms) {
//     return new Promise((resolver) => setTimeout(resolver, ms));
// }

// // Ejecuta fn cuando el DOM está listo
// function onListo(fn) {
//     if (document.readyState === 'loading') {
//         document.addEventListener('DOMContentLoaded', fn);
//     } else {
//         fn();
//     }
// }

// // Si la página está siendo pre-renderizada (speculationrules), espera a que el usuario la abra
// function cuandoSeaVisible(fn) {
//     if (document.prerendering) {
//         document.addEventListener('prerenderingchange', fn, { once: true });
//     } else {
//         fn();
//     }
// }

// // fetch + JSON + manejo de errores y sesión vencida
// async function api(url, opciones = {}) {
//     const config = { credentials: 'same-origin', ...opciones };

//     if (config.body && typeof config.body !== 'string') {
//         config.body = JSON.stringify(config.body);
//         config.headers = { 'Content-Type': 'application/json', ...(config.headers || {}) };
//     }

//     const res = await fetch(url, config);

//     const sesionVencida = res.status === 401 || (res.redirected && res.url.includes('login'));
//     if (sesionVencida) {
//         localStorage.removeItem('usuarioLogueado');
//         if (!location.pathname.includes('login')) location.href = '/login.html';
//         throw new Error('Sesión expirada');
//     }

//     let datos = null;
//     try { datos = await res.json(); } catch (_) { /* respuesta sin JSON */ }

//     if (!res.ok) throw new Error((datos && datos.error) || `Error ${res.status}`);
//     return datos;
// }

// function mostrarModal(id) {
//     const modal = $(id);
//     if (modal) modal.style.display = 'flex';
// }

// function ocultarModal(id) {
//     const modal = $(id);
//     if (modal) modal.style.display = 'none';
// }

// // ---- Canales de venta y formas de pago (compartidos por Pedidos, Ventas y Diario)
// const CANALES = {
//     deposito:  { texto: '🏭 Depósito',  color: '#3498db' },
//     reparto:   { texto: '🚚 Reparto',   color: '#e67e22' },
//     comercios: { texto: '🏪 Comercios', color: '#9b59b6' }
// };

// const ICONOS_PAGO = {
//     'Efectivo':      '💵 Efectivo',
//     'Mercado Pago':  '📱 Mercado Pago',
//     'Transferencia': '🏦 Transferencia',
//     'Pendiente':     '⏳ Pendiente'
// };

// function normalizarCanal(valor) {
//     const canal = (valor || '').trim().toLowerCase();
//     return CANALES[canal] ? canal : 'deposito';
// }

// function normalizarPago(valor) {
//     return valor ? String(valor).trim() : 'Efectivo';
// }

// function badgeCanal(canal, chico = false) {
//     const c = CANALES[canal];
//     const estilo = chico
//         ? 'padding: 2px 6px; font-size: 0.8em;'
//         : 'padding: 3px 8px; font-size: 0.85em;';
//     return `<span style="background: ${c.color}; color: white; ${estilo} border-radius: 4px; font-weight: bold;">${c.texto}</span>`;
// }

// function formatoFechaHora(fecha) {
//     if (!fecha) return '';
//     return `${fecha.substring(0, 10)} ${fecha.substring(11, 16)}`;
// }

// function canalesVacios() {
//     const vacio = () => ({ cantidad: 0, monto: 0, c10: 0, c15: 0, c30: 0, c45: 0 });
//     return { deposito: vacio(), reparto: vacio(), comercios: vacio() };
// }

// function sumarPorTipo(acumulador, tipo, cantidad) {
//     const clave = { '10kg': 'c10', '15kg': 'c15', '30kg': 'c30', '45kg': 'c45' }[(tipo || '').trim()];
//     if (clave) acumulador[clave] += cantidad;
// }

// function acumularCanales(pedidos) {
//     const canales = canalesVacios();
//     pedidos.forEach((p) => {
//         const canal = canales[normalizarCanal(p.tipo_venta)];
//         const cantidad = parseInt(p.cantidad) || 0;
//         canal.cantidad += cantidad;
//         canal.monto += parseFloat(p.total) || 0;
//         sumarPorTipo(canal, p.tipo, cantidad);
//     });
//     return canales;
// }

// function textoDetalleCanal(c) {
//     return `10kg: ${c.c10} | 15kg: ${c.c15} | 30kg: ${c.c30} | 45kg: ${c.c45}`;
// }


// // ---- Forma de pago editable (se usa en las tablas de Pedidos y de Ventas)
// const PAGOS_COBRADOS = ['efectivo', 'mercado pago', 'transferencia'];

// // Pendiente = cualquier forma de pago que NO sea una de las tres formas de cobro conocidas
// function esPagoPendiente(valor) {
//     return !PAGOS_COBRADOS.includes(normalizarPago(valor).toLowerCase());
// }

// // Un pedido "tiene pendientes" si falta entregarlo o falta cobrarlo
// function tienePendientes(pedido) {
//     return (pedido.estado || '').trim() === 'Pendiente' || esPagoPendiente(pedido.forma_pago);
// }

// // Orden: primero todo lo pendiente (lo más viejo arriba), después el resto (lo más nuevo arriba)
// function compararPendientesPrimero(a, b) {
//     const pa = tienePendientes(a);
//     const pb = tienePendientes(b);
//     if (pa !== pb) return pa ? -1 : 1;

//     if (pa && pb) {
//         const fa = a.fecha ? new Date(a.fecha).getTime() : 0;
//         const fb = b.fecha ? new Date(b.fecha).getTime() : 0;
//         if (fa !== fb) return fa - fb;
//     }
//     return b.id - a.id;
// }

// function estiloFila(pedido) {
//     return tienePendientes(pedido) ? 'background: #fff4e5;' : '';
// }

// // Si el pago está "Pendiente" muestra una lista desplegable para registrar cómo pagó el cliente
// function celdaFormaPago(pedido) {
//     const pago = normalizarPago(pedido.forma_pago);

//     if (!esPagoPendiente(pago)) {
//         const clave = Object.keys(ICONOS_PAGO).find((k) => k.toLowerCase() === pago.toLowerCase());
//         return `<span style="font-weight: bold; color: #27ae60;">${ICONOS_PAGO[clave] || escaparHTML(pago)}</span>`;
//     }

//     return `
//         <select onchange="cambiarFormaPago(${pedido.id}, this.value)" style="padding: 4px; border: 2px solid #e67e22; border-radius: 4px; font-weight: bold;">
//             <option value="Pendiente" selected>⏳ Pendiente</option>
//             <option value="Efectivo">💵 Efectivo</option>
//             <option value="Mercado Pago">📱 Mercado Pago</option>
//             <option value="Transferencia">🏦 Transferencia</option>
//         </select>`;
// }

// function refrescarTablasSinRecargar() {
//     if ($('cuerpo-tabla-ventas')) refrescarTablaVentas();
//     if ($('cuerpo-tabla-pedidos')) renderizarPedidos(pedidosGlobales);
// }

// window.cambiarFormaPago = async function (id, forma) {
//     if (forma === 'Pendiente') return;

//     if (!confirm(`¿Marcar este pedido como pagado con ${forma}?`)) {
//         refrescarTablasSinRecargar(); // vuelve a dibujar el select en "Pendiente"
//         return;
//     }

//     try {
//         await api(`/api/pedidos/${id}/pago`, { method: 'PUT', body: { forma_pago: forma } });
//         if ($('cuerpo-tabla-ventas')) await cargarVentas({ actualizarMapa: false });
//         if ($('cuerpo-tabla-pedidos')) await cargarPedidos();
//     } catch (err) {
//         alert(err.message || 'No se pudo actualizar la forma de pago');
//         refrescarTablasSinRecargar();
//     }
// };

// // Devuelve true si el usuario tiene abierta una lista desplegable dentro de una tabla
// function hayListaAbierta() {
//     const activo = document.activeElement;
//     return !!(activo && activo.tagName === 'SELECT' && activo.closest('tbody'));
// }


// /* =====================================================================
//    1. VALIDACIÓN DE INPUTS (automática por id/name)
//    ===================================================================== */
// document.addEventListener('input', (e) => {
//     const input = e.target;
//     if (input.tagName !== 'INPUT') return;

//     const identificador = (input.id + ' ' + (input.name || '')).toLowerCase();

//     if (identificador.includes('precio')) {
//         // El precio admite decimales (un solo punto)
//         const limpio = input.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
//         if (limpio !== input.value) input.value = limpio;
//     } else if (['telefono', 'cantidad', 'llenas', 'vacias'].some((k) => identificador.includes(k))) {
//         const limpio = input.value.replace(/\D/g, '');
//         if (limpio !== input.value) input.value = limpio;
//     } else if (identificador.includes('nombre') && !identificador.includes('usuario')) {
//         const limpio = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
//         if (limpio !== input.value) input.value = limpio;
//     }
// });

// function initValidacionPassword() {
//     const passwordInput = $('nueva-pass');
//     const errorPassword = $('error-password');
//     const formUsuario = $('form-usuario');
//     if (!passwordInput || !errorPassword) return;

//     const regexPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

//     passwordInput.addEventListener('input', () => {
//         const valor = passwordInput.value;
//         if (valor === '') {
//             errorPassword.style.display = 'none';
//             passwordInput.style.borderColor = '';
//         } else if (!regexPassword.test(valor)) {
//             errorPassword.textContent = 'Debe tener al menos 8 caracteres, mayúsculas, minúsculas, números y un carácter especial.';
//             errorPassword.style.display = 'block';
//             passwordInput.style.borderColor = '#e74c3c';
//         } else {
//             errorPassword.style.display = 'none';
//             passwordInput.style.borderColor = '#27ae60';
//         }
//     });

//     if (formUsuario) {
//         formUsuario.addEventListener('submit', (e) => {
//             if (!regexPassword.test(passwordInput.value)) {
//                 e.preventDefault();
//                 errorPassword.textContent = 'La contraseña no cumple con los requisitos de seguridad.';
//                 errorPassword.style.display = 'block';
//                 passwordInput.style.borderColor = '#e74c3c';
//                 passwordInput.focus();
//             }
//         });
//     }
// }


// /* =====================================================================
//    2. AUTENTICACIÓN Y PERMISOS
//    ===================================================================== */
// function initLogin() {
//     const form = $('form-login');
//     if (!form) return;

//     form.addEventListener('submit', async (e) => {
//         e.preventDefault();
//         try {
//             const res = await fetch('/api/login', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     usuario: $('login-usuario').value,
//                     password: $('login-password').value
//                 })
//             });
//             const datos = await res.json();
//             if (!res.ok) throw new Error(datos.error || 'Error al iniciar sesión');

//             localStorage.setItem('usuarioLogueado', JSON.stringify(datos));
//             location.href = 'pedidos.html';
//         } catch (err) {
//             alert(err.message);
//         }
//     });
// }

// function verificarPermisos() {
//     let usuario = null;
//     try { usuario = JSON.parse(localStorage.getItem('usuarioLogueado')); } catch (_) { /* dato corrupto */ }

//     if (!usuario) {
//         if (!location.pathname.includes('login')) location.href = 'login.html';
//         return;
//     }

//     if (usuario.rol === 'repartidor' && (location.pathname.includes('stock') || location.pathname.includes('diario'))) {
//         alert('No tienes permisos para acceder a este apartado.');
//         location.href = '/pedidos';
//     }
// }

// /* =====================================================================
//    3. CLIENTES
//    ===================================================================== */
// let clientesGlobales = [];

// async function cargarClientes() {
//     const tbody = $('cuerpo-tabla-clientes');
//     if (!tbody) return;

//     try {
//         clientesGlobales = await api('/api/clientes');

//         tbody.innerHTML = clientesGlobales.map((c) => `
//             <tr>
//                 <td><strong>${escaparHTML(c.nombre)}</strong></td>
//                 <td>${escaparHTML(c.telefono)}</td>
//                 <td>${escaparHTML(c.direccion) || '-'}</td>
//                 <td>
//                     <button class="btn-accion btn-editar" title="Editar cliente" onclick="editarCliente(${c.id})">✏️</button>
//                     <button class="btn-accion btn-historial" title="Ver historial" onclick="verHistorialCliente(${c.id})">📋</button>
//                     <button class="btn-accion btn-eliminar" title="Borrar cliente" onclick="borrarCliente(${c.id})">🗑️</button>
//                 </td>
//             </tr>`).join('');

//         window.filtrarClientes(); // mantiene el filtro de búsqueda aplicado
//     } catch (err) {
//         console.error('Error al cargar clientes:', err);
//     }
// }

// window.filtrarClientes = function () {
//     const input = $('buscador-cliente');
//     const tbody = $('cuerpo-tabla-clientes');
//     if (!input || !tbody) return;

//     const filtro = input.value.toLowerCase();
//     tbody.querySelectorAll('tr').forEach((fila) => {
//         const celdaNombre = fila.querySelector('td');
//         if (celdaNombre) {
//             fila.style.display = celdaNombre.textContent.toLowerCase().includes(filtro) ? '' : 'none';
//         }
//     });
// };

// window.abrirModalCliente = function () {
//     $('titulo-modal-cliente').textContent = 'Registrar Nuevo Cliente';
//     $('form-cliente').reset();
//     $('cliente-id').value = '';
//     mostrarModal('modal-cliente');
// };

// window.editarCliente = function (id) {
//     const c = clientesGlobales.find((x) => x.id === id);
//     if (!c) return;
//     $('titulo-modal-cliente').textContent = 'Editar Cliente';
//     $('cliente-id').value = c.id;
//     $('cliente-nombre').value = c.nombre || '';
//     $('cliente-telefono').value = c.telefono || '';
//     $('cliente-direccion').value = c.direccion || '';
//     mostrarModal('modal-cliente');
// };

// window.cerrarModalCliente = function () {
//     ocultarModal('modal-cliente');
// };

// window.borrarCliente = async function (id) {
//     if (!confirm('¿Estás seguro de borrar este cliente?')) return;
//     try {
//         await api(`/api/clientes/${id}`, { method: 'DELETE' });
//         cargarClientes();
//     } catch (err) {
//         alert(err.message);
//     }
// };

// window.verHistorialCliente = async function (clienteId) {
//     const cliente = clientesGlobales.find((x) => x.id === clienteId);
//     $('titulo-historial').textContent = `Historial de Pedidos - ${cliente ? cliente.nombre : ''}`;

//     try {
//         const pedidos = await api(`/api/clientes/${clienteId}/pedidos`);
//         const tbody = $('cuerpo-tabla-historial');

//         if (pedidos.length === 0) {
//             tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Este cliente no tiene pedidos registrados.</td></tr>`;
//         } else {
//             tbody.innerHTML = pedidos.map((p) => `
//                 <tr>
//                     <td>#${p.id}</td>
//                     <td><strong>${escaparHTML(p.cliente_nombre) || 'Desconocido'}</strong><br><small>${escaparHTML(p.cliente_telefono)}</small></td>
//                     <td>${escaparHTML(p.tipo)}</td>
//                     <td>${p.cantidad}</td>
//                     <td>${dinero(p.total)}</td>
//                     <td>${formatoFechaHora(p.fecha)}</td>
//                     <td><span style="font-weight:bold; color:${p.estado === 'Pendiente' ? '#e67e22' : '#27ae60'}">${escaparHTML(p.estado)}</span></td>
//                 </tr>`).join('');
//         }
//         mostrarModal('modal-historial');
//     } catch (err) {
//         alert(err.message);
//     }
// };

// window.cerrarModalHistorial = function () {
//     ocultarModal('modal-historial');
// };

// function initClientes() {
//     const form = $('form-cliente');
//     if (form) {
//         form.addEventListener('submit', async (e) => {
//             e.preventDefault();
//             const id = $('cliente-id').value;
//             const datos = {
//                 nombre: $('cliente-nombre').value,
//                 telefono: $('cliente-telefono').value,
//                 direccion: $('cliente-direccion').value
//             };

//             try {
//                 await api(id ? `/api/clientes/${id}` : '/api/clientes', {
//                     method: id ? 'PUT' : 'POST',
//                     body: datos
//                 });
//                 window.cerrarModalCliente();
//                 cargarClientes();
//             } catch (err) {
//                 alert(err.message);
//             }
//         });
//     }

//     cargarClientes();
// }


// /* =====================================================================
//    4. STOCK
//    ===================================================================== */
// async function cargarStock() {
//     const tbody = $('cuerpo-tabla-stock');
//     if (!tbody) return;

//     try {
//         const stock = await api('/api/stock');
//         tbody.innerHTML = stock.map((s) => {
//             const total = (s.llenas || 0) + (s.vacias || 0);
//             return `
//                 <tr>
//                     <td><strong>${escaparHTML(s.tipo)}</strong></td>
//                     <td>${s.llenas}</td>
//                     <td>${s.vacias}</td>
//                     <td>${dinero(s.precio)}</td>
//                     <td>${total}</td>
//                     <td>
//                         <button class="btn-accion btn-editar" title="Editar stock"
//                             onclick="abrirModalStock('${escaparHTML(s.tipo)}', ${s.llenas}, ${s.vacias}, ${s.precio})">✏️</button>
//                     </td>
//                 </tr>`;
//         }).join('');
//     } catch (err) {
//         console.error('Error al cargar stock:', err);
//     }
// }

// window.abrirModalStock = function (tipo, llenas, vacias, precio) {
//     $('titulo-modal-stock').textContent = `Actualizar Stock: ${tipo}`;
//     $('stock-tipo').value = tipo;
//     $('stock-llenas').value = llenas;
//     $('stock-vacias').value = vacias;
//     $('stock-precio').value = precio;
//     mostrarModal('modal-stock');
// };

// window.cerrarModalStock = function () {
//     ocultarModal('modal-stock');
// };

// function initStock() {
//     const form = $('form-stock');
//     if (form) {
//         form.addEventListener('submit', async (e) => {
//             e.preventDefault();
//             const tipo = $('stock-tipo').value;
//             const datos = {
//                 llenas: parseInt($('stock-llenas').value),
//                 vacias: parseInt($('stock-vacias').value),
//                 precio: parseFloat($('stock-precio').value)
//             };

//             try {
//                 await api(`/api/stock/${tipo}`, { method: 'PUT', body: datos });
//                 window.cerrarModalStock();
//                 cargarStock();
//             } catch (err) {
//                 alert(err.message || 'No autorizado o error al actualizar stock');
//             }
//         });
//     }

//     cargarStock();
// }


// /* =====================================================================
//    5. WHATSAPP
//    ===================================================================== */
// async function chequearWhatsApp() {
//     const txt = $('whatsapp-estado');
//     const qrDiv = $('contenedor-qr');
//     if (!txt || !qrDiv) return;

//     try {
//         const datos = await api('/api/whatsapp/qr');

//         if (datos.estado === 'Conectado') {
//             txt.textContent = '✅ WhatsApp Conectado';
//             txt.style.color = '#27ae60';
//             qrDiv.innerHTML = '';
//         } else {
//             txt.textContent = '⚠️ Escanea el QR para conectar';
//             txt.style.color = '#e67e22';
//             if (datos.qr) {
//                 qrDiv.innerHTML = `<img src="${datos.qr}" style="width:160px; height:160px;">`;
//             }
//         }
//     } catch (err) {
//         console.error('Error al chequear WhatsApp:', err);
//     }
// }

// window.reiniciarWhatsApp = async function () {
//     if (!confirm('¿Seguro que deseas desvincular WhatsApp y generar un nuevo QR?')) return;
//     try {
//         await api('/api/whatsapp/reiniciar', { method: 'POST' });
//         alert('Reiniciando conexión... Espera unos segundos y recarga la página.');
//         chequearWhatsApp();
//     } catch (err) {
//         alert(err.message);
//     }
// };

// function initWhatsApp() {
//     if (!$('whatsapp-estado')) return;

//     cuandoSeaVisible(() => {
//         chequearWhatsApp();
//         setInterval(() => {
//             if (!document.hidden) chequearWhatsApp();
//         }, 3000);
//     });
// }


// /* =====================================================================
//    6. PEDIDOS
//    ===================================================================== */
// let pedidosGlobales = [];
// let filtroHoyActivo = false;

// async function actualizarResumenPanelPedidos() {
//     // Stock por tipo
//     try {
//         const stock = await api('/api/stock');
//         const elStock = $('resumen-stock-pedidos');
//         if (elStock) {
//             elStock.innerHTML = stock
//                 .map((s) => `<div><strong>${escaparHTML(s.tipo)}:</strong> 🟢 ${s.llenas} | 🟠 ${s.vacias}</div>`)
//                 .join('');
//         }
//     } catch (err) {
//         console.error('Error al cargar stock para el panel:', err);
//     }

//     // Resumen de hoy
//     try {
//         const pedidos = await api('/api/pedidos/hoy');
//         let garrafas = 0, cobrado = 0, pendiente = 0;

//         pedidos.forEach((p) => {
//             garrafas += parseInt(p.cantidad) || 0;
//             const monto = parseFloat(p.total) || 0;
//             if (esPagoPendiente(p.forma_pago)) pendiente += monto;
//             else cobrado += monto;
//         });

//         setTexto('resumen-garrafas-pedidos', `${garrafas} un.`);
//         setTexto('resumen-cobrado-pedidos', dinero(cobrado));
//         setTexto('resumen-pendiente-pedidos', dinero(pendiente));
//     } catch (err) {
//         console.error('Error al cargar resumen de ventas de hoy:', err);
//     }
// }

// function renderizarPedidos(pedidos) {
//     const tbody = $('cuerpo-tabla-pedidos');
//     if (!tbody) return;

//     if (pedidos.length === 0) {
//         tbody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No se encontraron pedidos.</td></tr>`;
//         return;
//     }

//     const ordenados = [...pedidos].sort(compararPendientesPrimero);

//     tbody.innerHTML = ordenados.map((p) => {
//         let botonesAccion = '';
//         let columnaEstado;

//         if (p.estado === 'Completado') {
//             columnaEstado = `<span style="font-weight:bold; color:#27ae60;">${escaparHTML(p.estado)}</span>`;
//         } else {
//             botonesAccion = `
//                 <button class="btn-accion btn-editar" title="Editar pedido" onclick="editarPedido(${p.id})">✏️</button>
//                 <button class="btn-accion btn-eliminar" title="Borrar pedido" onclick="borrarPedido(${p.id})">🗑️</button>`;
//             columnaEstado = `<span onclick="cambiarEstado(${p.id}, '${escaparHTML(p.estado)}')" style="cursor:pointer; font-weight:bold; color:#e67e22;" title="Hacer clic para completar">${escaparHTML(p.estado)}</span>`;
//         }

//         return `
//             <tr style="${estiloFila(p)}">
//                 <td><strong>${escaparHTML(p.cliente_nombre) || 'Desconocido'}</strong><br><small>${escaparHTML(p.cliente_telefono)}</small></td>
//                 <td>${escaparHTML(p.tipo)}</td>
//                 <td>${badgeCanal(normalizarCanal(p.tipo_venta))}</td>
//                 <td>${p.cantidad}</td>
//                 <td>${dinero(p.total)}</td>
//                 <td>${celdaFormaPago(p)}</td>
//                 <td>${formatoFechaHora(p.fecha)}</td>
//                 <td>${columnaEstado}</td>
//                 <td>${botonesAccion}</td>
//             </tr>`;
//     }).join('');
// }

// async function cargarPedidos() {
//     if (!$('cuerpo-tabla-pedidos')) return;

//     actualizarResumenPanelPedidos();

//     const desde = $('filtro-desde')?.value;
//     const hasta = $('filtro-hasta')?.value;

//     let url = '/api/pedidos';
//     if (filtroHoyActivo) {
//         url = '/api/pedidos/hoy';
//     } else if (desde || hasta) {
//         url = `/api/pedidos/filtrar?desde=${desde || '1970-01-01'}&hasta=${hasta || '2100-12-31'}`;
//     }

//     try {
//         pedidosGlobales = await api(url);
//         renderizarPedidos(pedidosGlobales);
//     } catch (err) {
//         console.error('Error al cargar pedidos:', err);
//     }
// }

// window.filtrarPedidosHoy = function () {
//     filtroHoyActivo = true;
//     if ($('filtro-desde')) $('filtro-desde').value = '';
//     if ($('filtro-hasta')) $('filtro-hasta').value = '';
//     cargarPedidos();
// };

// window.filtrarPedidosPorFecha = function () {
//     filtroHoyActivo = false;
//     cargarPedidos();
// };

// window.limpiarFiltrosFecha = function () {
//     filtroHoyActivo = false;
//     if ($('filtro-desde')) $('filtro-desde').value = '';
//     if ($('filtro-hasta')) $('filtro-hasta').value = '';
//     cargarPedidos();
// };

// window.abrirModalPedido = async function () {
//     $('titulo-modal-pedido').textContent = 'Nuevo Pedido';
//     $('form-pedido').reset();
//     $('pedido-id').value = '';
//     $('grupo-cliente').style.display = 'block';
//     $('pedido-forma-pago').closest('.grupo-form').style.display = '';

//     try {
//         const clientes = await api('/api/clientes');
//         $('pedido-cliente').innerHTML = clientes
//             .map((c) => `<option value="${c.id}">${escaparHTML(c.nombre)} (${escaparHTML(c.telefono)})</option>`)
//             .join('');
//         mostrarModal('modal-pedido');
//     } catch (err) {
//         alert(err.message);
//     }
// };

// window.editarPedido = function (id) {
//     const p = pedidosGlobales.find((x) => x.id === id);
//     if (!p) return;

//     $('titulo-modal-pedido').textContent = 'Editar Pedido #' + id;
//     $('pedido-id').value = id;
//     $('grupo-cliente').style.display = 'none';
//     $('pedido-forma-pago').closest('.grupo-form').style.display = 'none';
//     $('pedido-tipo').value = p.tipo;
//     $('pedido-cantidad').value = p.cantidad;
//     $('pedido-tipo-venta').value = normalizarCanal(p.tipo_venta); // conserva el canal real
//     mostrarModal('modal-pedido');
// };

// window.cerrarModalPedido = function () {
//     ocultarModal('modal-pedido');
// };

// window.borrarPedido = async function (id) {
//     if (!confirm('¿Borrar pedido?')) return;
//     try {
//         await api(`/api/pedidos/${id}`, { method: 'DELETE' });
//         cargarPedidos();
//     } catch (err) {
//         alert(err.message);
//     }
// };

// window.cambiarEstado = async function (id, estadoActual) {
//     const nuevo = estadoActual === 'Pendiente' ? 'Completado' : 'Pendiente';
//     try {
//         await api(`/api/pedidos/${id}/estado`, { method: 'PUT', body: { estado: nuevo } });
//         cargarPedidos();
//     } catch (err) {
//         alert(err.message);
//     }
// };

// function initPedidos() {
//     if (!$('cuerpo-tabla-pedidos')) return;

//     const form = $('form-pedido');
//     if (form) {
//         form.addEventListener('submit', async (e) => {
//             e.preventDefault();
//             const id = $('pedido-id').value;
//             const tipo = $('pedido-tipo').value;
//             const cantidad = parseInt($('pedido-cantidad').value);
//             const tipo_venta = $('pedido-tipo-venta').value;
//             const forma_pago = $('pedido-forma-pago').value;

//             try {
//                 if (id) {
//                     await api(`/api/pedidos/${id}`, { method: 'PUT', body: { tipo, cantidad, tipo_venta } });
//                 } else {
//                     await api('/api/pedidos', {
//                         method: 'POST',
//                         body: { cliente_id: $('pedido-cliente').value, tipo, cantidad, forma_pago, tipo_venta }
//                     });
//                 }
//                 window.cerrarModalPedido();
//                 cargarPedidos();
//             } catch (err) {
//                 alert(err.message || 'No hay suficiente stock disponible');
//             }
//         });
//     }

//     cuandoSeaVisible(() => {
//         cargarPedidos();
//         setInterval(() => {
//             if (!document.hidden && !hayListaAbierta()) cargarPedidos();
//         }, 3000);
//     });
// }


// /* =====================================================================
//    7. VENTAS
//    ===================================================================== */
// let ventasGlobales = [];
// let indiceFilaActiva = -1;
// let temporizadorMapa = null;

// function ventasFiltradas() {
//     const texto = ($('buscador-ventas')?.value || '').trim().toLowerCase();
//     const desde = $('filtro-ventas-desde')?.value;
//     const hasta = $('filtro-ventas-hasta')?.value;

//     return ventasGlobales.filter((v) => {
//         if (desde || hasta) {
//             const fecha = v.fecha ? v.fecha.substring(0, 10) : '';
//             if (!fecha) return false;
//             if (desde && fecha < desde) return false;
//             if (hasta && fecha > hasta) return false;
//         }
//         if (!texto) return true;
//         return [v.cliente_nombre, v.tipo, v.direccion].some((campo) => (campo || '').toLowerCase().includes(texto));
//     });
// }

// function refrescarTablaVentas() {
//     renderizarVentas(ventasFiltradas());
// }

// function renderizarVentas(ventas) {
//     const tbody = $('cuerpo-tabla-ventas');
//     if (!tbody) return;

//     indiceFilaActiva = -1;

//     if (ventas.length === 0) {
//         tbody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No se encontraron registros de ventas.</td></tr>`;
//         actualizarMetricasVentasPorCanal([]);
//         return;
//     }

//     tbody.innerHTML = [...ventas].sort(compararPendientesPrimero).map((v) => `
//         <tr style="${estiloFila(v)}">
//             <td>#${v.id}</td>
//             <td><strong>${escaparHTML(v.cliente_nombre) || 'Desconocido'}</strong><br><small>${escaparHTML(v.cliente_telefono)}</small></td>
//             <td>${badgeCanal(normalizarCanal(v.tipo_venta))}</td>
//             <td>${escaparHTML(v.tipo)}</td>
//             <td>${v.cantidad}</td>
//             <td style="font-weight: bold; color: #27ae60;">${dinero(v.total)}</td>
//             <td>${celdaFormaPago(v)}</td>
//             <td>${formatoFechaHora(v.fecha)}</td>
//             <td><span style="font-weight:bold; color:#27ae60;">${escaparHTML(v.estado)}</span></td>
//         </tr>`).join('');

//     actualizarMetricasVentasPorCanal(ventas);
// }

// function actualizarMetricasVentasPorCanal(ventas) {
//     const canales = acumularCanales(ventas);
//     Object.keys(canales).forEach((canal) => {
//         setTexto(`${canal}-cantidad`, `${canales[canal].cantidad} un.`);
//         setTexto(`${canal}-monto`, dinero(canales[canal].monto));
//         setTexto(`${canal}-detalle`, textoDetalleCanal(canales[canal]));
//     });
// }

// async function cargarVentas({ actualizarMapa = true } = {}) {
//     if (!$('cuerpo-tabla-ventas')) return;

//     try {
//         const pedidos = await api('/api/pedidos');
//         ventasGlobales = pedidos.filter((p) => p.estado === 'Completado');

//         const lista = ventasFiltradas();
//         renderizarVentas(lista);

//         if (actualizarMapa) cuandoSeaVisible(() => inicializarMapaVentas(lista));
//     } catch (err) {
//         console.error('Error al cargar ventas:', err);
//     }
// }

// window.filtrarVentasTexto = function () {
//     const lista = ventasFiltradas();
//     renderizarVentas(lista);

//     // El mapa consulta un servicio externo: se actualiza recién cuando se deja de escribir
//     clearTimeout(temporizadorMapa);
//     temporizadorMapa = setTimeout(() => inicializarMapaVentas(lista), 600);
// };

// window.filtrarVentasPorFecha = window.filtrarVentasTexto;

// window.limpiarFiltrosVentas = function () {
//     ['filtro-ventas-desde', 'filtro-ventas-hasta', 'buscador-ventas'].forEach((id) => {
//         if ($(id)) $(id).value = '';
//     });
//     window.filtrarVentasTexto();
// };

// // ---- Navegación por teclado (flechas arriba/abajo) en la tabla de ventas
// function initNavegacionTablaVentas() {
//     const contenedor = $('contenedor-tabla-ventas');
//     if (!contenedor) return;

//     contenedor.addEventListener('keydown', (e) => {
//         if (e.target.tagName === 'SELECT') return; // no interferir con las listas desplegables

//         const filas = $('cuerpo-tabla-ventas').querySelectorAll('tr');
//         if (filas.length === 0) return;

//         if (e.key === 'ArrowDown') {
//             e.preventDefault();
//             indiceFilaActiva = indiceFilaActiva < filas.length - 1 ? indiceFilaActiva + 1 : 0;
//         } else if (e.key === 'ArrowUp') {
//             e.preventDefault();
//             indiceFilaActiva = indiceFilaActiva > 0 ? indiceFilaActiva - 1 : filas.length - 1;
//         } else {
//             return;
//         }

//         filas.forEach((fila, idx) => {
//             if (idx === indiceFilaActiva) {
//                 fila.classList.add('fila-seleccionada');
//                 fila.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
//             } else {
//                 fila.classList.remove('fila-seleccionada');
//             }
//         });
//     });
// }

// // ---- Mapa de concentración de ventas
// let mapaVentas = null;
// let mapaToken = 0; // permite cancelar un dibujo de mapa en curso si se pide otro
// const CENTRO_NOGOYA = [-32.3947, -59.7894];
// const CLAVE_CACHE_GEO = 'geoCacheZonas';

// window.centrarMapaNogoya = function () {
//     if (mapaVentas) mapaVentas.setView(CENTRO_NOGOYA, 13);
// };

// function leerCacheGeo() {
//     try { return JSON.parse(localStorage.getItem(CLAVE_CACHE_GEO)) || {}; } catch (_) { return {}; }
// }

// function guardarCacheGeo(cache) {
//     try { localStorage.setItem(CLAVE_CACHE_GEO, JSON.stringify(cache)); } catch (_) { /* sin espacio */ }
// }

// async function geocodificar(direccion) {
//     const consulta = encodeURIComponent(`${direccion}, Nogoyá, Entre Ríos, Argentina`);
//     const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${consulta}`);
//     const datos = await res.json();
//     if (datos && datos.length > 0) return [parseFloat(datos[0].lat), parseFloat(datos[0].lon)];
//     return null;
// }

// function agruparZonas(ventas) {
//     const zonas = {};
//     ventas.forEach((v) => {
//         if (!v.direccion) return;
//         const clave = v.direccion.trim().toLowerCase();
//         if (!zonas[clave]) {
//             zonas[clave] = { clave, direccionOriginal: v.direccion, cantidadTotal: 0, montoTotal: 0, clientes: new Set() };
//         }
//         zonas[clave].cantidadTotal += parseInt(v.cantidad) || 0;
//         zonas[clave].montoTotal += parseFloat(v.total) || 0;
//         if (v.cliente_nombre) zonas[clave].clientes.add(v.cliente_nombre);
//     });
//     return Object.values(zonas).sort((a, b) => b.cantidadTotal - a.cantidadTotal);
// }

// function dibujarZona(zona, punto) {
//     let color = '#f1c40f';
//     let radio = 8;
//     if (zona.cantidadTotal >= 10) { color = '#8b0000'; radio = 20; }
//     else if (zona.cantidadTotal >= 5) { color = '#c0392b'; radio = 15; }
//     else if (zona.cantidadTotal >= 3) { color = '#e67e22'; radio = 11; }

//     L.circleMarker(punto, {
//         radius: radio,
//         fillColor: color,
//         color: '#ffffff',
//         weight: 2,
//         opacity: 1,
//         fillOpacity: 0.85
//     }).addTo(mapaVentas).bindPopup(`
//         <div style="font-size: 13px;">
//             <b>Zona / Dirección:</b> ${escaparHTML(zona.direccionOriginal)}<br>
//             <b>Total Garrafas:</b> ${zona.cantidadTotal} un.<br>
//             <b>Recaudado:</b> ${dinero(zona.montoTotal)}<br>
//             <b>Clientes:</b> ${escaparHTML(Array.from(zona.clientes).join(', '))}
//         </div>`);
// }

// async function inicializarMapaVentas(ventas) {
//     if (!$('mapa-ventas')) return;

//     const token = ++mapaToken;
//     const zonas = agruparZonas(ventas);
//     renderizarPanelEstadisticasZonas(zonas);

//     if (typeof L === 'undefined') {
//         console.warn('Leaflet no está disponible: se muestra sólo el ranking de zonas.');
//         return;
//     }

//     if (mapaVentas) mapaVentas.remove();
//     mapaVentas = L.map('mapa-ventas').setView(CENTRO_NOGOYA, 13);
//     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//         maxZoom: 19,
//         attribution: '&copy; OpenStreetMap contributors'
//     }).addTo(mapaVentas);

//     const cache = leerCacheGeo();

//     for (const zona of zonas) {
//         if (token !== mapaToken) return; // se pidió un mapa más nuevo: cancelar este

//         let punto = cache[zona.clave];

//         if (!punto) {
//             try {
//                 punto = await geocodificar(zona.direccionOriginal);
//                 if (punto) {
//                     cache[zona.clave] = punto;
//                     guardarCacheGeo(cache);
//                 }
//             } catch (err) {
//                 console.error('Error de red al geocodificar zona:', err);
//             }
//             await esperar(1100); // respeta el límite de ~1 consulta por segundo de Nominatim
//             if (token !== mapaToken) return;
//         }

//         if (!punto) {
//             // Si no se encuentra la dirección, se ubica cerca del centro de Nogoyá
//             punto = [
//                 CENTRO_NOGOYA[0] + (Math.random() - 0.5) * 0.025,
//                 CENTRO_NOGOYA[1] + (Math.random() - 0.5) * 0.025
//             ];
//         }

//         dibujarZona(zona, punto);
//     }
// }

// function renderizarPanelEstadisticasZonas(zonas) {
//     const panel = $('panel-estadisticas-zonas');
//     if (!panel) return;

//     if (zonas.length === 0) {
//         panel.innerHTML = '<span style="color: #7f8c8d; text-align: center;">No hay datos de zonas para mostrar.</span>';
//         return;
//     }

//     const maximo = zonas[0].cantidadTotal || 1;

//     panel.innerHTML = zonas.map((z) => {
//         const porcentaje = Math.round((z.cantidadTotal / maximo) * 100);
//         let colorBarra = '#f1c40f';
//         if (z.cantidadTotal >= 5) colorBarra = '#c0392b';
//         else if (z.cantidadTotal >= 3) colorBarra = '#e67e22';

//         return `
//             <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 10px;">
//                 <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px; color: #2c3e50;">
//                     <span>📍 ${escaparHTML(z.direccionOriginal)}</span>
//                     <span style="color: #27ae60;">${z.cantidadTotal} un. (${dinero(z.montoTotal)})</span>
//                 </div>
//                 <div style="background: #e1e8ed; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;">
//                     <div style="background: ${colorBarra}; width: ${porcentaje}%; height: 100%; transition: width 0.4s;"></div>
//                 </div>
//             </div>`;
//     }).join('');
// }

// function initVentas() {
//     if (!$('cuerpo-tabla-ventas')) return;
//     initNavegacionTablaVentas();
//     cargarVentas();
// }


// /* =====================================================================
//    8. LIBRO DIARIO
//    ===================================================================== */
// let todosLosPedidosDiario = [];

// window.cargarLibroDiario = async function () {
//     try {
//         todosLosPedidosDiario = await api('/api/pedidos');
//         filtrarYRenderizarDiario();
//     } catch (err) {
//         console.error('Error al cargar datos para el libro diario:', err);
//     }
// };

// function fijarRangoDiario(desde, hasta) {
//     if ($('filtro-diario-desde')) $('filtro-diario-desde').value = desde;
//     if ($('filtro-diario-hasta')) $('filtro-diario-hasta').value = hasta;
// }

// window.ponerDiaHoy = function () {
//     if ($('buscador-diario')) $('buscador-diario').value = '';
//     const hoy = fechaLocalISO();
//     fijarRangoDiario(hoy, hoy);
//     filtrarYRenderizarDiario();
// };
// window.filtrarDiarioHoy = window.ponerDiaHoy;

// window.cambiarDia = function (dias) {
//     const inputDesde = $('filtro-diario-desde');
//     if (!inputDesde) return;

//     const base = inputDesde.value ? new Date(inputDesde.value + 'T00:00:00') : new Date();
//     base.setDate(base.getDate() + dias);

//     const nuevaFecha = fechaLocalISO(base);
//     fijarRangoDiario(nuevaFecha, nuevaFecha);
//     filtrarYRenderizarDiario();
// };

// window.limpiarFiltrosDiario = function () {
//     fijarRangoDiario('', '');
//     if ($('buscador-diario')) $('buscador-diario').value = '';
//     if ($('filtro-diario-canal')) $('filtro-diario-canal').value = 'todos';
//     filtrarYRenderizarDiario();
// };

// window.filtrarDiarioPorFecha = () => filtrarYRenderizarDiario();
// window.filtrarDiarioTexto = () => filtrarYRenderizarDiario();
// window.filtrarDiarioPorCanal = () => filtrarYRenderizarDiario();

// function filtrarYRenderizarDiario() {
//     const tbody = $('cuerpo-tabla-diario');
//     if (!tbody) return;

//     const desde = $('filtro-diario-desde')?.value;
//     const hasta = $('filtro-diario-hasta')?.value;
//     const texto = ($('buscador-diario')?.value || '').toLowerCase();
//     const canalSeleccionado = $('filtro-diario-canal')?.value || 'todos';

//     const pedidos = todosLosPedidosDiario.filter((p) => {
//         if (!p.fecha) return false;
//         const fecha = p.fecha.substring(0, 10);
//         if (desde && fecha < desde) return false;
//         if (hasta && fecha > hasta) return false;

//         if (canalSeleccionado !== 'todos' && normalizarCanal(p.tipo_venta) !== canalSeleccionado) return false;

//         if (texto) {
//             const cliente = (p.cliente_nombre || '').toLowerCase();
//             const tipo = (p.tipo || '').toLowerCase();
//             const idStr = String(p.id || '');
//             if (!cliente.includes(texto) && !tipo.includes(texto) && !idStr.includes(texto)) return false;
//         }
//         return true;
//     });

//     const totales = { cobrado: 0, efectivo: 0, mp: 0, transf: 0, pendiente: 0, unidades: 0, c10: 0, c15: 0, c30: 0, c45: 0 };

//     pedidos.forEach((p) => {
//         const monto = parseFloat(p.total) || 0;
//         const cantidad = parseInt(p.cantidad) || 0;
//         const pago = normalizarPago(p.forma_pago);

//         totales.unidades += cantidad;
//         sumarPorTipo(totales, p.tipo, cantidad);

//         // "Total cobrado" suma sólo lo efectivamente cobrado; lo pendiente va aparte
//         if (pago === 'Efectivo') { totales.efectivo += monto; totales.cobrado += monto; }
//         else if (pago === 'Mercado Pago') { totales.mp += monto; totales.cobrado += monto; }
//         else if (pago === 'Transferencia') { totales.transf += monto; totales.cobrado += monto; }
//         else { totales.pendiente += monto; }
//     });

//     if (pedidos.length === 0) {
//         tbody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No hay movimientos para el período seleccionado.</td></tr>`;
//     } else {
//         tbody.innerHTML = pedidos.map((p) => `
//             <tr>
//                 <td>${formatoFechaHora(p.fecha)}</td>
//                 <td><strong>${escaparHTML(p.cliente_nombre) || 'Desconocido'}</strong><br><small>${escaparHTML(p.cliente_telefono)}</small></td>
//                 <td>${badgeCanal(normalizarCanal(p.tipo_venta), true)}</td>
//                 <td>${escaparHTML(p.tipo)}</td>
//                 <td>${parseInt(p.cantidad) || 0}</td>
//                 <td style="font-weight: bold; color: #27ae60;">${dinero(p.total)}</td>
//                 <td>${escaparHTML(normalizarPago(p.forma_pago))}</td>
//                 <td>${p.estado === 'Completado' ? 'Completado' : 'Pendiente'}</td>
//             </tr>`).join('');
//     }

//     actualizarMetricasDiario(totales, acumularCanales(pedidos));
// }

// function actualizarMetricasDiario(t, canales) {
//     // Resumen financiero
//     setTexto('diario-total-cobrado', dinero(t.cobrado));
//     setTexto('diario-efectivo', dinero(t.efectivo));
//     setTexto('diario-mp', dinero(t.mp));
//     setTexto('diario-transf', dinero(t.transf));
//     setTexto('diario-pendiente', dinero(t.pendiente));

//     // Unidades vendidas
//     setTexto('diario-total-unidades', `${t.unidades} un.`);
//     setTexto('diario-g10', `${t.c10} un.`);
//     setTexto('diario-g15', `${t.c15} un.`);
//     setTexto('diario-g30', `${t.c30} un.`);
//     setTexto('diario-g45', `${t.c45} un.`);

//     // Por canal
//     Object.keys(canales).forEach((canal) => {
//         setTexto(`diario-${canal}-cant`, `${canales[canal].cantidad} un.`);
//         setTexto(`diario-${canal}-monto`, dinero(canales[canal].monto));
//         setTexto(`diario-${canal}-det`, textoDetalleCanal(canales[canal]));
//     });
// }

// function initDiario() {
//     if (!$('cuerpo-tabla-diario')) return;
//     const hoy = fechaLocalISO();
//     fijarRangoDiario(hoy, hoy);
//     window.cargarLibroDiario();
// }


// /* =====================================================================
//    9. ARRANQUE
//    ===================================================================== */
// onListo(() => {
//     verificarPermisos();
//     initLogin();
//     initValidacionPassword();
//     initClientes();
//     initStock();
//     initWhatsApp();
//     initPedidos();
//     initVentas();
//     initDiario();
// });




'use strict';

onListo(() => {
    // El orquestador ejecuta los módulos solo si existen en la página actual
    if (typeof verificarPermisos === 'function') verificarPermisos();
    if (typeof initLogin === 'function') initLogin();
    if (typeof initValidacionPassword === 'function') initValidacionPassword();
    if (typeof initClientes === 'function') initClientes();
    if (typeof initStock === 'function') initStock();
    if (typeof initPedidos === 'function') initPedidos();
    if (typeof initVentas === 'function') initVentas();
    if (typeof initDiario === 'function') initDiario();
    if (typeof initWhatsApp === 'function') initWhatsApp();
});