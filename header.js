document.addEventListener("DOMContentLoaded", () => {
    const user = JSON.parse(localStorage.getItem('usuarioLogueado'));
    if (!user && !window.location.href.includes('login.html')) {
        window.location.href = 'login.html';
        return;
    }

    if (window.location.href.includes('login.html')) return;

    // Eliminamos cualquier header viejo residual que pudiera quedar en el HTML
    const headerViejo = document.querySelector('header');
    if (headerViejo) headerViejo.remove();

    // Estructura limpia y unificada con todos los apartados
    const estructuraHeader = `
        <header style="background: #2c3e50; color: white; padding: 12px 25px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1); position: relative; z-index: 100;">
            <div style="display: flex; gap: 20px; align-items: center;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 600;">App Garrafas</h2>
                <nav style="display: flex; gap: 5px;">
                    <a href="pedidos.html" style="color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 14px; background: ${window.location.href.includes('pedidos.html') ? '#34495e' : 'transparent'}">Pedidos</a>
                    <a href="clientes.html" style="color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 14px; background: ${window.location.href.includes('clientes.html') ? '#34495e' : 'transparent'}">Clientes</a>
                    <a href="stock.html" id="nav-stock" style="color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 14px; background: ${window.location.href.includes('stock.html') ? '#34495e' : 'transparent'}">Stock</a>
                </nav>
            </div>
            
            <!-- Contenedor del Perfil (Avatar + Dropdown) -->
            <div style="position: relative; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 13px; color: #bdc3c7; text-transform: uppercase; font-weight: bold;">${user ? user.rol : ''}</span>
                
                <!-- Círculo de Perfil -->
                <div onclick="toggleMenuPerfil(event)" style="width: 38px; height: 38px; border-radius: 50%; background: #3498db; color: white; display: flex; justify-content: center; align-items: center; font-weight: bold; cursor: pointer; user-select: none; border: 2px solid #ecf0f1; overflow: hidden;">
                    <span id="avatar-iniciales" style="font-size: 14px;">U</span>
                </div>

                <!-- Menú Desplegable (Orden exacto solicitado) -->
                <div id="dropdown-perfil" style="display: none; position: absolute; right: 0; top: 48px; background: white; color: #333; width: 220px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); overflow: hidden; z-index: 2000;">
                    <a href="#" onclick="cerrarSesion(); event.preventDefault();" style="display: block; padding: 10px 15px; text-decoration: none; color: #e74c3c; font-size: 14px; font-weight: bold; border-bottom: 1px solid #f1f1f1;">1. Cerrar sesión</a>
                    <a href="#" onclick="abrirModalPerfil(); event.preventDefault();" style="display: block; padding: 10px 15px; text-decoration: none; color: #2c3e50; font-size: 14px; border-bottom: 1px solid #f1f1f1;">2. Mi perfil</a>
                    <a href="#" onclick="abrirModalRecuperar(); event.preventDefault();" style="display: block; padding: 10px 15px; text-decoration: none; color: #2c3e50; font-size: 14px;">3. Recuperar / Cambiar contraseña</a>
                </div>
            </div>
        </header>

        <!-- Modal de Mi Perfil -->
        <div id="modal-perfil" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 3000;">
            <div style="background: white; padding: 25px; border-radius: 8px; width: 100%; max-width: 400px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                <h3 style="margin-top: 0; color: #2c3e50;">Mi Perfil</h3>
                <form id="form-perfil">
                    <div style="margin-bottom: 12px;">
                        <label style="display:block; font-weight:bold; font-size:13px; margin-bottom:4px;">Nombre:</label>
                        <input type="text" id="perfil-nombre" style="width: 100%; padding: 8px; box-sizing: border-box; border:1px solid #bdc3c7; border-radius:4px;" required>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <label style="display:block; font-weight:bold; font-size:13px; margin-bottom:4px;">Apellido:</label>
                        <input type="text" id="perfil-apellido" style="width: 100%; padding: 8px; box-sizing: border-box; border:1px solid #bdc3c7; border-radius:4px;" required>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <label style="display:block; font-weight:bold; font-size:13px; margin-bottom:4px;">Correo:</label>
                        <input type="email" id="perfil-correo" style="width: 100%; padding: 8px; box-sizing: border-box; border:1px solid #bdc3c7; border-radius:4px;" required>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display:block; font-weight:bold; font-size:13px; margin-bottom:4px;">Edad:</label>
                        <input type="number" id="perfil-edad" style="width: 100%; padding: 8px; box-sizing: border-box; border:1px solid #bdc3c7; border-radius:4px;">
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button type="submit" style="flex: 1; padding: 10px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor:pointer; font-weight:bold;">Guardar</button>
                        <button type="button" onclick="cerrarModalPerfil()" style="flex: 1; padding: 10px; background: #bdc3c7; color: white; border: none; border-radius: 4px; cursor:pointer; font-weight:bold;">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Modal de Cambiar / Recuperar Contraseña -->
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
        const linkStock = document.getElementById('nav-stock');
        if (linkStock) linkStock.style.display = 'none';

        if (window.location.href.includes('stock.html')) {
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

window.abrirModalPerfil = function() {
    const datosPerfil = JSON.parse(localStorage.getItem('datosPersonalesPerfil')) || {};
    document.getElementById('perfil-nombre').value = datosPerfil.nombre || '';
    document.getElementById('perfil-apellido').value = datosPerfil.apellido || '';
    document.getElementById('perfil-correo').value = datosPerfil.correo || '';
    document.getElementById('perfil-edad').value = datosPerfil.edad || '';
    document.getElementById('modal-perfil').style.display = 'flex';
}

window.cerrarModalPerfil = function() {
    document.getElementById('modal-perfil').style.display = 'none';
}

window.abrirModalRecuperar = function() {
    document.getElementById('nueva-pass').value = '';
    document.getElementById('modal-password').style.display = 'flex';
}

window.cerrarModalRecuperar = function() {
    document.getElementById('modal-password').style.display = 'none';
}

document.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'form-perfil') {
        e.preventDefault();
        const datos = {
            nombre: document.getElementById('perfil-nombre').value,
            apellido: document.getElementById('perfil-apellido').value,
            correo: document.getElementById('perfil-correo').value,
            edad: document.getElementById('perfil-edad').value
        };
        localStorage.setItem('datosPersonalesPerfil', JSON.stringify(datos));
        alert("Datos de perfil guardados correctamente.");
        cerrarModalPerfil();
    }

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