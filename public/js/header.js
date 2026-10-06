function escHtml(valor) {
    const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(valor == null ? '' : valor).replace(/[&<>"']/g, c => mapa[c]);
}

let perfilesCache = [];

// ---------- Helpers de seguridad de contraseña ----------
const REQUISITOS_PASSWORD = [
    { id: 'len',   texto: 'Al menos 8 caracteres',        ok: p => p.length >= 8 },
    { id: 'mayus', texto: 'Una mayúscula',                ok: p => /[A-Z]/.test(p) },
    { id: 'minus', texto: 'Una minúscula',                ok: p => /[a-z]/.test(p) },
    { id: 'num',   texto: 'Un número',                    ok: p => /\d/.test(p) }
];

function validarPasswordNueva(nueva, actual) {
    const faltan = REQUISITOS_PASSWORD.filter(r => !r.ok(nueva));
    if (faltan.length) return 'La nueva contraseña debe tener: ' + faltan.map(r => r.texto.toLowerCase()).join(', ') + '.';
    if (actual !== undefined && nueva === actual) return 'La nueva contraseña debe ser distinta a la actual.';
    return null;
}

function pintarRequisitos(inputId, listaId) {
    const val = document.getElementById(inputId).value;
    document.getElementById(listaId).innerHTML = REQUISITOS_PASSWORD.map(r =>
        `<li style="color:${r.ok(val) ? '#16a34a' : '#6b7280'}">${r.ok(val) ? '✔' : '○'} ${r.texto}</li>`
    ).join('');
}

async function peticionJson(url, metodo, cuerpo) {
    const res = await fetch(url, {
        method: metodo,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo)
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* respuesta sin JSON */ }
    if (!res.ok) throw new Error(data.error || 'Error en la solicitud (' + res.status + ')');
    return data;
}

// Modal "Olvidé mi contraseña" (también se inyecta en login.html)
function inyectarModalOlvide() {
    if (document.getElementById('modal-olvide')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="modal-olvide" class="modal-fondo">
            <div class="modal-contenido modal-ancho-400">
                <h3 class="modal-historial-titulo">Recuperar contraseña</h3>
                <form id="form-olvide">
                    <p style="font-size:14px;color:#6b7280;margin-bottom:10px;">
                        Ingresá el correo asociado a tu cuenta y te enviaremos un enlace para crear una nueva contraseña.
                    </p>
                    <div class="form-group">
                        <label>Correo electrónico:</label>
                        <input type="email" id="input-olvide-email" autocomplete="email" required>
                    </div>
                    <div class="form-fila-flex mt-20">
                        <button type="submit" id="btn-olvide-enviar" class="btn-guardar flex-1">Enviar enlace</button>
                        <button type="button" onclick="cerrarModalOlvide()" class="btn-cancelar flex-1">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>`);
}

document.addEventListener("DOMContentLoaded", () => {
    const user = JSON.parse(localStorage.getItem('usuarioLogueado'));
    if (!user && !window.location.href.includes('login')) {
        window.location.href = 'login.html';
        return;
    }

    if (window.location.href.includes('login')) {
        inyectarModalOlvide(); // permite usar abrirModalOlvide() desde login.html
        return;
    }

    const headerViejo = document.querySelector('header');
    if (headerViejo) headerViejo.remove();

    const rolFormateado = user ? (user.rol && user.rol.toLowerCase() === 'admin' ? 'Administrador' : user.rol) : '';

    const estructuraHeader = `
   
        <header class="app-header">
            <div class="app-header-left">
                <h2 class="app-title">Garrafas App</h2>
                <nav class="app-nav">
    <a href="/pedidos" id="nav-pedidos" class="app-nav-link ${window.location.pathname === '/pedidos' ? 'active' : ''}">Pedidos</a>
    <a href="/clientes" id="nav-clientes" class="app-nav-link ${window.location.pathname === '/clientes' ? 'active' : ''}">Clientes</a>
    <a href="/ventas" id="nav-ventas" class="app-nav-link ${window.location.pathname === '/ventas' ? 'active' : ''}">Ventas</a>
    <a href="/diario" id="nav-diario" class="app-nav-link ${window.location.pathname === '/diario' ? 'active' : ''}">Diario</a>
    <a href="/stock" id="nav-stock" class="app-nav-link ${window.location.pathname === '/stock' ? 'active' : ''}">Stock</a>
</nav>

            </div>

            <div class="header-user-container">
                <span class="header-rol-badge">${rolFormateado}</span>

                <div onclick="toggleMenuPerfil(event)" class="header-avatar">
                    <span id="avatar-iniciales">U</span>
                </div>

                <div id="dropdown-perfil" class="header-dropdown">
                    <a href="#" onclick="cerrarSesion(); event.preventDefault();" class="dropdown-item cerrar-sesion">1. Cerrar sesión</a>

                    ${user && user.rol === 'admin' ? `
                        <a href="#" onclick="abrirModalAdministrarPerfiles(); event.preventDefault();" class="dropdown-item font-bold">2. Administrar perfiles</a>
                    ` : ''}

                    <a href="#" onclick="abrirModalRecuperar(); event.preventDefault();" class="dropdown-item">${user && user.rol === 'admin' ? '3.' : '2.'} Cambiar contraseña</a>
                </div>
            </div>
        </header>

        <!-- Modal de Administrar Perfiles -->
        <div id="modal-admin-perfiles" class="modal-fondo">
            <div class="modal-contenido modal-ancho-650" style="max-height: 85vh; display: flex; flex-direction: column; overflow-y: auto;">
                <div class="modal-header-flex">
                    <h3 class="modal-historial-titulo">Administrar Perfiles de Usuario</h3>
                    <button onclick="cerrarModalAdminPerfiles()" class="btn-cerrar-historial">&times;</button>
                </div>

                <div class="mb-15 text-right">
                    <button onclick="toggleFormularioNuevoUsuario()" class="btn-nuevo-usuario">+ Nuevo Usuario</button>
                </div>

                <form id="form-nuevo-repartidor" class="form-panel-secundario" onsubmit="crearNuevoUsuario(event)">
                    <h4>Crear Nueva Cuenta</h4>
                    <div class="form-fila-flex">
                        <input type="text" id="nuevo-usuario-nombre" autocomplete = "username"  placeholder="Nombre de usuario" required>
                        <input type="password" id="nueva-pass" autocomplete="new-password" placeholder="Contraseña" required>
                    </div>
                    <div class="mb-10">
                        <input type="email" id="nuevo-usuario-email" autocomplete="email" placeholder="Correo electrónico (para recuperar contraseña)" required style="width:100%;">
                    </div>
                    <div class="mb-10">
                        <label>Rol del Sistema:</label>
                        <select id="nuevo-usuario-rol">
                            <option value="repartidor">Repartidor (Acceso solo a Pedidos y Clientes)</option>
                            <option value="admin">Administrador (Acceso total a todo el sistema)</option>
                        </select>
                    </div>
                    <div class="text-right">
                        <button type="submit" class="btn-nuevo-usuario">Guardar Cuenta</button>
                        <button type="button" onclick="toggleFormularioNuevoUsuario()" class="btn-cancelar">Cancelar</button>
                    </div>
                </form>

                <div class="tabla-contenedor-scroll">
                    <table class="tabla-perfiles">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Usuario</th>
                                <th>Rol</th>
                                <th>Email</th>
                                <th class="text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="tabla-cuerpo-perfiles"></tbody>
                    </table>
                </div>

                <div class="mt-20 text-right">
                    <button type="button" onclick="cerrarModalAdminPerfiles()" class="btn-cancelar">Cerrar</button>
                </div>
            </div>
        </div>

        <!-- Modal de Cambiar Contraseña -->
        <div id="modal-password" class="modal-fondo">
            <div class="modal-contenido modal-ancho-400">
                <h3 class="modal-historial-titulo">Cambiar Contraseña</h3>
                <form id="form-password">
                    <!-- Usuario oculto para gestores de contraseñas -->
                    <input type="text" id="input-pass-username" autocomplete="username" style="display: none;" value="${user ? escHtml(user.usuario) : ''}" aria-hidden="true">

                    <div class="form-group">
                        <label>Contraseña actual:</label>
                        <input type="password" id="input-pass-actual" autocomplete="current-password" required>
                    </div>
                    <div class="form-group">
                        <label>Nueva contraseña:</label>
                        <input type="password" id="input-cambiar-pass" autocomplete="new-password" oninput="pintarRequisitos('input-cambiar-pass','lista-requisitos')" required>
                        <ul id="lista-requisitos" style="list-style:none;padding:0;margin:6px 0 0;font-size:13px;"></ul>
                    </div>
                    <div class="form-group">
                        <label>Repetir nueva contraseña:</label>
                        <input type="password" id="input-pass-confirmar" autocomplete="new-password" required>
                    </div>

                    <p id="msg-password" style="font-size:13px;color:#dc2626;min-height:18px;margin:6px 0 0;"></p>

                    <div class="form-fila-flex mt-20">
                        <button type="submit" id="btn-password-guardar" class="btn-guardar flex-1">Actualizar</button>
                        <button type="button" onclick="cerrarModalRecuperar()" class="btn-cancelar flex-1">Cancelar</button>
                    </div>
                    <p style="text-align:center;margin-top:12px;font-size:13px;">
                        <a href="#" onclick="abrirModalOlvide(); event.preventDefault();">¿Olvidaste tu contraseña?</a>
                    </p>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', estructuraHeader);
    inyectarModalOlvide();

    if (user && user.usuario) {
        const inicial = user.usuario.charAt(0).toUpperCase();
        const avatarEl = document.getElementById('avatar-iniciales');
        if (avatarEl) avatarEl.textContent = inicial;
    }

    if (user && user.rol === 'repartidor') {
        // Ocultar botón de Stock
        const linkStock = document.getElementById('nav-stock');
        if (linkStock) linkStock.style.display = 'none';

        // Ocultar botón de Diario
        const linkDiario = document.getElementById('nav-diario');
        if (linkDiario) linkDiario.style.display = 'none';

        // Bloquear acceso por URL a Stock y Diario
        if (window.location.pathname.includes('stock') || window.location.pathname.includes('diario')) {
            alert("No tienes permisos para acceder a este apartado.");
            window.location.href = '/pedidos';
        }
    }
});

window.toggleMenuPerfil = function (event) {
    event.stopPropagation();
    const dropdown = document.getElementById('dropdown-perfil');
    if (dropdown) {
        const abierto = getComputedStyle(dropdown).display !== 'none';
        dropdown.style.display = abierto ? 'none' : 'block';
    }
}

window.addEventListener('click', () => {
    const dropdown = document.getElementById('dropdown-perfil');
    if (dropdown) dropdown.style.display = 'none';
});

window.abrirModalAdministrarPerfiles = function () {
    const user = JSON.parse(localStorage.getItem('usuarioLogueado'));
    if (!user || user.rol !== 'admin') {
        alert("Acceso denegado. Solo los administradores pueden gestionar perfiles.");
        return;
    }
    document.getElementById('modal-admin-perfiles').style.display = 'flex';
    cargarPerfilesEnTabla();
}

window.cerrarModalAdminPerfiles = function () {
    document.getElementById('modal-admin-perfiles').style.display = 'none';
}

window.toggleFormularioNuevoUsuario = function () {
    const form = document.getElementById('form-nuevo-repartidor');
    if (form) {
        const oculto = getComputedStyle(form).display === 'none';
        form.style.display = oculto ? 'block' : 'none';
    }
}

window.cargarPerfilesEnTabla = function () {
    Promise.all([
        fetch('/api/usuarios', { method: 'GET', credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error("No autorizado para ver usuarios");
                return res.json();
            }),
        fetch('/api/password/emails', { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
    ])
        .then(([usuarios, emails]) => {
            const mapaEmails = {};
            emails.forEach(e => { mapaEmails[Number(e.id)] = e.email; });
            usuarios = usuarios.map(u => ({ ...u, email: mapaEmails[Number(u.id)] || '' }));
            const tbody = document.getElementById('tabla-cuerpo-perfiles');
            if (!tbody) return;
            tbody.innerHTML = '';

            perfilesCache = usuarios;
            const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioLogueado')) || {};

            tbody.innerHTML = usuarios.map(u => {
                const esBloqueado = Number(u.bloqueado) === 1;
                const iconoEstado = esBloqueado ? "🔓 Desbloquear" : "🔒 Bloquear";
                const claseEstado = esBloqueado ? 'btn-desbloquear' : 'btn-bloquear';
                const esUsuarioActual = Number(u.id) === Number(usuarioLogueado.id);

                const botonesAccion = esUsuarioActual
                    ? '🔒 Vos'
                    : `<button onclick="toggleBloqueoUsuario(${Number(u.id)}, ${esBloqueado ? 0 : 1})" class="btn-accion ${claseEstado}">${iconoEstado}</button>
                       <button onclick="borrarUsuario(${Number(u.id)})" class="btn-accion btn-borrar">🗑️ Borrar</button>`;

                return `
                <tr>
                    <td>${Number(u.id)}</td>
                    <td>${escHtml(u.usuario)}</td>
                    <td>${escHtml(u.rol)}</td>
                    <td>${u.email ? escHtml(u.email) : '<span style="color:#9ca3af">sin email</span>'} <button onclick="editarEmailUsuario(${Number(u.id)})" class="btn-accion" title="Editar email">✉️</button></td>
                    <td class="text-center">${botonesAccion}</td>
                </tr>`;
            }).join('');
        })
        .catch(err => console.error("Error al cargar usuarios:", err));
};

window.crearNuevoUsuario = function (event) {
    event.preventDefault();

    const nombreInput = document.getElementById('nuevo-usuario-nombre');
    const passInput = document.getElementById('nueva-pass');
    const rolInput = document.getElementById('nuevo-usuario-rol');

    if (!nombreInput || !passInput || !rolInput) {
        alert("Error: No se encontraron los campos del formulario en el DOM.");
        return;
    }

    const data = {
        usuario: nombreInput.value,
        password: passInput.value,
        rol: rolInput.value,
        email: (document.getElementById('nuevo-usuario-email') || {}).value || ''
    };

    const emailAlta = data.email;
    const usuarioAlta = data.usuario;

    fetch('/api/usuarios', {
        method: 'POST',
        credentials: 'include', // 👈 Indispensable para express-session
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(async res => {
            const resultado = await res.json();
            if (!res.ok) throw new Error(resultado.error || "Error al crear el usuario");
            return resultado;
        })
        .then(async data => {
            if (emailAlta) {
                try {
                    await peticionJson('/api/password/email', 'PUT', { usuario: usuarioAlta, email: emailAlta });
                } catch (e) {
                    alert("El usuario se creó, pero no se pudo guardar el email: " + e.message);
                }
            }
            alert(data.mensaje || "Usuario creado correctamente");
            const form = document.getElementById('form-nuevo-repartidor');
            if (form) form.reset();
            toggleFormularioNuevoUsuario();
            cargarPerfilesEnTabla(); // Recarga la tabla de usuarios
        })
        .catch(err => {
            console.error("Error al crear usuario:", err);
            alert("No se pudo crear el usuario: " + err.message);
        });
};

window.editarEmailUsuario = async function (id) {
    const perfil = perfilesCache.find(x => Number(x.id) === Number(id));
    if (!perfil) return;
    const nuevo = prompt(`Email de "${perfil.usuario}" (vacío para quitarlo):`, perfil.email || '');
    if (nuevo === null) return;
    try {
        await peticionJson('/api/password/email', 'PUT', { usuario: perfil.usuario, email: nuevo });
        cargarPerfilesEnTabla();
    } catch (err) {
        alert("No se pudo guardar el email: " + err.message);
    }
};

window.toggleBloqueoUsuario = function (id, nuevoEstado, nombreUsuario) {
    const perfil = perfilesCache.find(x => Number(x.id) === Number(id));
    nombreUsuario = nombreUsuario || (perfil ? perfil.usuario : '');
    const accion = nuevoEstado === 1 ? "bloquear" : "desbloquear";

    if (confirm(`¿Estás seguro de ${accion} al usuario "${nombreUsuario}"?`)) {
        fetch(`/api/usuarios/${id}/bloquear`, {
            method: 'PUT',
            credentials: 'include', // 👈 Indispensable para enviar la sesión
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bloqueado: nuevoEstado })
        })
            .then(async res => {
                if (!res.ok) throw new Error("No autorizado o error al actualizar estado");
                return res.json();
            })
            .then(data => {
                alert(`El usuario ha sido ${accion}do correctamente.`);
                cargarPerfilesEnTabla();
            })
            .catch(err => {
                console.error("Error al cambiar estado:", err);
                alert("No se pudo actualizar el estado del usuario.");
            });
    }
};

window.borrarUsuario = function (id) {
    if (confirm("¿Estás seguro de que deseas borrar este perfil de forma permanente?")) {
        fetch(`/api/usuarios/${id}`, {
            method: 'DELETE',
            credentials: 'include' // 👈 Envía la cookie de sesión del servidor
        })
            .then(async res => {
                // Verificamos si la respuesta es JSON antes de parsearla para evitar excepciones
                const contentType = res.headers.get("content-type");
                let data = {};
                if (contentType && contentType.includes("application/json")) {
                    data = await res.json();
                } else {
                    data = { error: await res.text() };
                }

                if (!res.ok) {
                    throw new Error(data.error || "No autorizado o error al eliminar el usuario");
                }
                return data;
            })
            .then(data => {
                alert(data.mensaje || "Usuario eliminado con éxito.");
                cargarPerfilesEnTabla();
            })
            .catch(err => {
                console.error("Error al borrar usuario (Línea 251):", err);
                alert("No se pudo borrar el usuario: " + err.message);
            });
    }
};

window.pintarRequisitos = pintarRequisitos;

window.abrirModalRecuperar = function () {
    ['input-pass-actual', 'input-cambiar-pass', 'input-pass-confirmar'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('msg-password').textContent = '';
    pintarRequisitos('input-cambiar-pass', 'lista-requisitos');
    document.getElementById('modal-password').style.display = 'flex';
}

window.cerrarModalRecuperar = function () {
    document.getElementById('modal-password').style.display = 'none';
}

window.abrirModalOlvide = function () {
    inyectarModalOlvide();
    const modalPass = document.getElementById('modal-password');
    if (modalPass) modalPass.style.display = 'none';
    document.getElementById('input-olvide-email').value = '';
    document.getElementById('modal-olvide').style.display = 'flex';
}

window.cerrarModalOlvide = function () {
    document.getElementById('modal-olvide').style.display = 'none';
}

document.addEventListener('submit', async (e) => {
    // ----- Cambiar contraseña (requiere contraseña actual) -----
    if (e.target && e.target.id === 'form-password') {
        e.preventDefault();
        const msg = document.getElementById('msg-password');
        const btn = document.getElementById('btn-password-guardar');
        const actual = document.getElementById('input-pass-actual').value;
        const nueva = document.getElementById('input-cambiar-pass').value;
        const confirmar = document.getElementById('input-pass-confirmar').value;

        const errorValidacion = validarPasswordNueva(nueva, actual);
        if (errorValidacion) { msg.textContent = errorValidacion; return; }
        if (nueva !== confirmar) { msg.textContent = 'Las contraseñas nuevas no coinciden.'; return; }

        btn.disabled = true;
        msg.textContent = '';
        try {
            await peticionJson('/api/password/cambiar', 'PUT', { actual, nueva });
            cerrarModalRecuperar();
            alert('Contraseña actualizada. Por seguridad, volvé a iniciar sesión.');
            cerrarSesion();
        } catch (err) {
            msg.textContent = err.message;
        } finally {
            btn.disabled = false;
        }
    }

    // ----- Olvidé mi contraseña (envío de enlace por correo) -----
    if (e.target && e.target.id === 'form-olvide') {
        e.preventDefault();
        const btn = document.getElementById('btn-olvide-enviar');
        const email = document.getElementById('input-olvide-email').value.trim();
        btn.disabled = true;
        try {
            await peticionJson('/api/password/olvide', 'POST', { email });
        } catch (err) {
            console.error('Error en recuperación:', err);
        } finally {
            btn.disabled = false;
        }
        // Mensaje genérico siempre: no revela si el correo existe o no
        alert('Si el correo está registrado, te enviamos un enlace para restablecer la contraseña. Revisá también la carpeta de spam. El enlace vence en 30 minutos.');
        cerrarModalOlvide();
    }
});

window.cerrarSesion = function () {
    localStorage.removeItem('usuarioLogueado');
    // Cierra también la sesión del servidor (si la ruta no existe, no pasa nada)
    fetch('/api/logout', { method: 'POST', credentials: 'include' })
        .catch(() => {})
        .finally(() => { window.location.href = 'login.html'; });
}