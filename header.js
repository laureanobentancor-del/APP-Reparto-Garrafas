document.addEventListener("DOMContentLoaded", () => {
    const user = JSON.parse(localStorage.getItem('usuarioLogueado'));
    if (!user && !window.location.href.includes('login.html')) {
        window.location.href = 'login.html';
        return;
    }

    if (window.location.href.includes('login.html')) return;

    const headerViejo = document.querySelector('header');
    if (headerViejo) headerViejo.remove();

    const rolFormateado = user ? (user.rol && user.rol.toLowerCase() === 'admin' ? 'Administrador' : user.rol) : '';

    const estructuraHeader = `
        <header class = "app-header">
            <div style="display: flex; gap: 20px; align-items: center;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Garrafas App</h2>
                <nav style="display: flex; gap: 5px;">
                    <a href="pedidos.html" style="color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 14px; background: ${window.location.href.includes('pedidos.html') ? '#34495e' : 'transparent'}">Pedidos</a>
                    <a href="clientes.html" style="color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 14px; background: ${window.location.href.includes('clientes.html') ? '#34495e' : 'transparent'}">Clientes</a>
                   <a href="ventas.html" id="nav-ventas" style="color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 14px; background: ${window.location.href.includes('ventas.html') ? '#34495e' : 'transparent'}">Ventas</a>
                   <a href="Diario.html" id="nav-diario" style="color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 14px; background: ${window.location.href.includes('diario.html') ? '#34495e' : 'transparent'}">Diario</a>
                    <a href="stock.html" id="nav-stock" style="color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 14px; background: ${window.location.href.includes('stock.html') ? '#34495e' : 'transparent'}">Stock</a>
                </nav>
            </div>
            
            <div style="position: relative; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 13px; color: #bdc3c7; font-weight: bold;">${rolFormateado}</span>
                
                <div onclick="toggleMenuPerfil(event)" style="width: 38px; height: 38px; border-radius: 50%; background: #3498db; color: white; display: flex; justify-content: center; align-items: center; font-weight: bold; cursor: pointer; user-select: none; border: 2px solid #ecf0f1; overflow: hidden;">
                    <span id="avatar-iniciales" style="font-size: 14px;">U</span>
                </div>

                <div id="dropdown-perfil" style="display: none; position: absolute; right: 0; top: 48px; background: white; color: #333; width: 220px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); overflow: hidden; z-index: 2000;">
                    <a href="#" onclick="cerrarSesion(); event.preventDefault();" style="display: block; padding: 10px 15px; text-decoration: none; color: #e74c3c; font-size: 14px; font-weight: bold; border-bottom: 1px solid #f1f1f1;">1. Cerrar sesión</a>
                    
                    ${user && user.rol === 'admin' ? `
                        <a href="#" onclick="abrirModalAdministrarPerfiles(); event.preventDefault();" style="display: block; padding: 10px 15px; text-decoration: none; color: #2c3e50; font-size: 14px; font-weight: bold; border-bottom: 1px solid #f1f1f1;">2. Administrar perfiles</a>
                    ` : ''}
                    
                    <a href="#" onclick="abrirModalRecuperar(); event.preventDefault();" style="display: block; padding: 10px 15px; text-decoration: none; color: #2c3e50; font-size: 14px;">${user && user.rol === 'admin' ? '3.' : '2.'} Cambiar contraseña</a>
                </div>
            </div>
        </header>

        <!-- Modal de Administrar Perfiles -->
        <div id="modal-admin-perfiles" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 3000;">
            <div style="background: white; padding: 25px; border-radius: 8px; width: 100%; max-width: 650px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #2c3e50;">Administrar Perfiles de Usuario</h3>
                    <button onclick="cerrarModalAdminPerfiles()" style="background: none; border: none; font-size: 18px; cursor: pointer; font-weight: bold;">&times;</button>
                </div>
                
                <div style="margin-bottom: 15px; text-align: right;">
                    <button onclick="toggleFormularioNuevoUsuario()" style="background: #27ae60; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px;">+ Nuevo Usuario</button>
                </div>

                <form id="form-nuevo-repartidor" style="display: none; background: #f4f6f9; padding: 15px; border-radius: 6px; margin-bottom: 15px; border: 1px solid #ddd;" onsubmit="crearNuevoUsuario(event)">
                    <h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 14px;">Crear Nueva Cuenta</h4>
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <input type="text" id="nuevo-usuario-nombre" placeholder="Nombre de usuario" style="flex: 1; padding: 8px; border: 1px solid #bdc3c7; border-radius: 4px; font-size: 13px;" required>
                        <input type="password" id="nuevo-usuario-pass" placeholder="Contraseña" style="flex: 1; padding: 8px; border: 1px solid #bdc3c7; border-radius: 4px; font-size: 13px;" required>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="display: block; font-weight: bold; font-size: 12px; margin-bottom: 4px; color: #34495e;">Rol del Sistema:</label>
                        <select id="nuevo-usuario-rol" style="width: 100%; padding: 8px; border: 1px solid #bdc3c7; border-radius: 4px; font-size: 13px;">
                            <option value="repartidor">Repartidor (Acceso solo a Pedidos y Clientes)</option>
                            <option value="admin">Administrador (Acceso total a todo el sistema)</option>
                        </select>
                    </div>
                    <div style="text-align: right;">
                        <button type="submit" style="background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">Guardar Cuenta</button>
                        <button type="button" onclick="toggleFormularioNuevoUsuario()" style="background: #bdc3c7; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Cancelar</button>
                    </div>
                </form>

                <div style="max-height: 300px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                        <thead>
                            <tr style="background: #f4f6f9; border-bottom: 2px solid #ddd;">
                                <th style="padding: 10px;">ID</th>
                                <th style="padding: 10px;">Usuario</th>
                                <th style="padding: 10px;">Rol</th>
                                <th style="padding: 10px; text-align: center;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="tabla-cuerpo-perfiles"></tbody>
                    </table>
                </div>

                <div style="margin-top: 20px; text-align: right;">
                    <button type="button" onclick="cerrarModalAdminPerfiles()" style="padding: 8px 16px; background: #bdc3c7; color: white; border: none; border-radius: 4px; cursor:pointer; font-weight:bold;">Cerrar</button>
                </div>
            </div>
        </div>

        <!-- Modal de Cambiar Contraseña -->
        <div id="modal-password" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 3000;">
            <div style="background: white; padding: 25px; border-radius: 8px; width: 100%; max-width: 400px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                <h3 style="margin-top: 0; color: #2c3e50;">Cambiar Contraseña</h3>
                <form id="form-password">
                    <div style="margin-bottom: 12px;">
                        <label style="display:block; font-weight:bold; font-size:13px; margin-bottom:4px;">Nueva Contraseña:</label>
                        <input type="password" id="nueva-pass" style="width: 100%; padding: 8px; box-sizing: border-box; border:1px solid #bdc3c7; border-radius:4px;" required>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button type="submit" style="flex: 1; padding: 10px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor:pointer; font-weight:bold;">Actualizar</button>
                        <button type="button" onclick="cerrarModalRecuperar()" style="flex: 1; padding: 10px; background: #bdc3c7; color: white; border: none; border-radius: 4px; cursor:pointer; font-weight:bold;">Cancelar</button>
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

window.toggleMenuPerfil = function(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('dropdown-perfil');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }
}

window.addEventListener('click', () => {
    const dropdown = document.getElementById('dropdown-perfil');
    if (dropdown) dropdown.style.display = 'none';
});

window.abrirModalAdministrarPerfiles = function() {
    const user = JSON.parse(localStorage.getItem('usuarioLogueado'));
    if (!user || user.rol !== 'admin') {
        alert("Acceso denegado. Solo los administradores pueden gestionar perfiles.");
        return;
    }
    document.getElementById('modal-admin-perfiles').style.display = 'flex';
    cargarPerfilesEnTabla();
}

window.cerrarModalAdminPerfiles = function() {
    document.getElementById('modal-admin-perfiles').style.display = 'none';
}

window.toggleFormularioNuevoUsuario = function() {
    const form = document.getElementById('form-nuevo-repartidor');
    if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }
}

window.crearNuevoUsuario = function(e) {
    e.preventDefault();
    const usuario = document.getElementById('nuevo-usuario-nombre').value;
    const password = document.getElementById('nuevo-usuario-pass').value;
    const rol = document.getElementById('nuevo-usuario-rol').value;

    fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password, rol })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            alert(`Cuenta creada con éxito como [${rol.toUpperCase()}].`);
            document.getElementById('nuevo-usuario-nombre').value = '';
            document.getElementById('nuevo-usuario-pass').value = '';
            toggleFormularioNuevoUsuario();
            cargarPerfilesEnTabla();
        }
    })
    .catch(err => console.error("Error al crear usuario:", err));
}

function cargarPerfilesEnTabla() {
    fetch('/api/usuarios')
        .then(res => res.json())
        .then(usuarios => {
            const tbody = document.getElementById('tabla-cuerpo-perfiles');
            tbody.innerHTML = '';
            
            if (usuarios.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 15px;">No hay usuarios registrados.</td></tr>`;
                return;
            }

            usuarios.forEach(u => {
                const estaBloqueado = u.bloqueado === 1;
                const textoBoton = estaBloqueado ? "Desbloquear" : "Bloquear";
                const colorBoton = estaBloqueado ? "#27ae60" : "#f39c12";
                const nuevoEstado = estaBloqueado ? 0 : 1;
                const rolTablaFormateado = u.rol === 'admin' ? 'Administrador' : u.rol;

                tbody.innerHTML += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px;">#${u.id}</td>
                        <td style="padding: 10px; font-weight: bold;">
                            ${u.usuario} 
                            ${estaBloqueado ? '<span style="color: #e74c3c; font-size: 11px; margin-left: 5px;">(Bloqueado)</span>' : ''}
                        </td>
                        <td style="padding: 10px; font-size: 12px; color: #555;">${rolTablaFormateado}</td>
                        <td style="padding: 10px; text-align: center;">
                            <button onclick="toggleBloqueoUsuario(${u.id}, ${nuevoEstado}, '${u.usuario}')" style="background: ${colorBoton}; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 5px;">${textoBoton}</button>
                            <button onclick="borrarUsuario(${u.id})" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Borrar</button>
                        </td>
                    </tr>
                `;
            });
        })
        .catch(err => console.error("Error al cargar perfiles:", err));
}

window.toggleBloqueoUsuario = function(id, nuevoEstado, nombreUsuario) {
    const accion = nuevoEstado === 1 ? "bloquear" : "desbloquear";
    if (confirm(`¿Estás seguro de ${accion} al usuario "${nombreUsuario}"?`)) {
        fetch(`/api/usuarios/${id}/bloquear`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bloqueado: nuevoEstado })
        })
        .then(res => res.json())
        .then(data => {
            alert(`El usuario ha sido ${nuevoEstado === 1 ? 'bloqueado' : 'desbloqueado'} correctamente.`);
            cargarPerfilesEnTabla();
        })
        .catch(err => console.error("Error al cambiar estado:", err));
    }
}

window.borrarUsuario = function(id) {
    if (confirm("¿Estás seguro de que deseas borrar este perfil de forma permanente?")) {
        fetch(`/api/usuarios/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                alert(data.mensaje || "Usuario eliminado");
                cargarPerfilesEnTabla();
            })
            .catch(err => console.error("Error al borrar usuario:", err));
    }
}

window.abrirModalRecuperar = function() {
    document.getElementById('nueva-pass').value = '';
    document.getElementById('modal-password').style.display = 'flex';
}

window.cerrarModalRecuperar = function() {
    document.getElementById('modal-password').style.display = 'none';
}

document.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'form-password') {
        e.preventDefault();
        alert("Contraseña actualizada con éxito.");
        cerrarModalRecuperar();
    }
});

window.cerrarSesion = function() {
    localStorage.removeItem('usuarioLogueado');
    window.location.href = 'login.html';
}