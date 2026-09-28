document.addEventListener("DOMContentLoaded", () => {
    const user = JSON.parse(localStorage.getItem('usuarioLogueado'));
    if (!user && !window.location.href.includes('login')) {
        window.location.href = 'login.html';
        return;
    }

    if (window.location.href.includes('login')) return;

    const headerViejo = document.querySelector('header');
    if (headerViejo) headerViejo.remove();

    const rolFormateado = user ? (user.rol && user.rol.toLowerCase() === 'admin' ? 'Administrador' : user.rol) : '';

    const estructuraHeader = `
   
        <header class="app-header">
            <div class="app-header-left">
                <h2 class="app-title">Garrafas App</h2>
                <nav class="app-nav">
    <a href="/pedidos" class="app-nav-link ${window.location.pathname === '/pedidos' ? 'active' : ''}">Pedidos</a>
    <a href="/clientes" class="app-nav-link ${window.location.pathname === '/clientes' ? 'active' : ''}">Clientes</a>
    <a href="/ventas" class="app-nav-link ${window.location.pathname === '/ventas' ? 'active' : ''}">Ventas</a>
    <a href="/diario" class="app-nav-link ${window.location.pathname === '/diario' ? 'active' : ''}">Diario</a>
    <a href="/stock" class="app-nav-link ${window.location.pathname === '/stock' ? 'active' : ''}">Stock</a>
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
            <!-- Campo de usuario oculto para accesibilidad y gestores de contraseñas -->
            <input type="text" autocomplete="username" style="display: none;" value="" aria-hidden="true">

            <div class="form-group">
                <label>Nueva Contraseña:</label>
                <input type="password" id="input-cambiar-pass" autocomplete="new-password" required>
            </div>
            <div class="form-fila-flex mt-20">
                <button type="submit" class="btn-guardar flex-1">Actualizar</button>
                <button type="button" onclick="cerrarModalRecuperar()" class="btn-cancelar flex-1">Cancelar</button>
            </div>
        </form>
    </div>
</div>

    `;

    document.body.insertAdjacentHTML('afterbegin', estructuraHeader);

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
        if (window.location.href.includes('stock.html') || window.location.href.includes('diario.html')) {
            alert("No tienes permisos para acceder a este apartado.");
            window.location.href = 'pedidos.html';
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
    fetch('/api/usuarios', {
        method: 'GET',
        credentials: 'include'
    })
        .then(res => {
            if (!res.ok) throw new Error("No autorizado para ver usuarios");
            return res.json();
        })
        .then(usuarios => {
            const tbody = document.getElementById('tabla-cuerpo-perfiles');
            if (!tbody) return;
            tbody.innerHTML = '';

            const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioLogueado')) || {};

            usuarios.forEach(u => {
                const esBloqueado = u.bloqueado === 1;
                const iconoEstado = esBloqueado ? "🔓 Desbloquear" : "🔒 Bloquear";

                const esUsuarioActual = usuarioLogueado && Number(u.id) === Number(usuarioLogueado.id);

                let botonesAccion = '';
                if (esUsuarioActual) {
                    botonesAccion = '🔒 Vos';
                } else {
                    const claseEstado = esBloqueado ? 'btn-desbloquear' : 'btn-bloquear';
                    botonesAccion = `
                    <button onclick="toggleBloqueoUsuario(${u.id}, ${esBloqueado ? 0 : 1}, '${u.usuario}')"
                            class="btn-accion ${claseEstado}">
                        ${iconoEstado}
                    </button>
                    <button onclick="borrarUsuario(${u.id})" class="btn-accion btn-borrar">
                        🗑️ Borrar
                    </button>
                `;
                }

                tbody.innerHTML += `
                <tr>
                    <td>${u.id}</td>
                    <td>${u.usuario}</td>
                    <td>${u.rol}</td>
                    <td class="text-center">
                        ${botonesAccion}
                    </td>
                </tr>
            `;
            });
        })
        .catch(err => console.error("Error al cargar usuarios:", err));
};

window.crearNuevoUsuario = function (event) {
    event.preventDefault();

    const nombreInput = document.getElementById('nuevo-usuario-nombre');
    const passInput = document.getElementById('nuevo-usuario-pass');
    const rolInput = document.getElementById('nuevo-usuario-rol');

    if (!nombreInput || !passInput || !rolInput) {
        alert("Error: No se encontraron los campos del formulario en el DOM.");
        return;
    }

    const data = {
        usuario: nombreInput.value,
        password: passInput.value,
        rol: rolInput.value
    };

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
        .then(data => {
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

window.toggleBloqueoUsuario = function (id, nuevoEstado, nombreUsuario) {
    const accion = nuevoEstado === 1 ? "bloquear" : "desbloquear";

    if (confirm(`¿Estás seguro de \({accion} al usuario "\){nombreUsuario}"?`)) {
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

window.abrirModalRecuperar = function () {
    document.getElementById('nueva-pass').value = '';
    document.getElementById('modal-password').style.display = 'flex';
}

window.cerrarModalRecuperar = function () {
    document.getElementById('modal-password').style.display = 'none';
}

document.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'form-password') {
        e.preventDefault();
        alert("Contraseña actualizada con éxito.");
        cerrarModalRecuperar();
    }
});

window.cerrarSesion = function () {
    localStorage.removeItem('usuarioLogueado');
    window.location.href = 'login.html';
}