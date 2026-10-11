'use strict';

function initLogin() {
    const form = $('form-login');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Validamos visualmente que no estén vacíos antes de hacer el fetch
        if (typeof window.validarFormularioLogin === 'function') {
            if (!window.validarFormularioLogin()) return; 
        }

        try {
            // 2. Intentamos conectar con el servidor
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuario: $('login-usuario').value,
                    password: $('login-password').value
                })
            });
            const datos = await res.json();
            
            // 3. Si el servidor rechaza las credenciales (ej. 401 Unauthorized)
            if (!res.ok) throw new Error(datos.error || 'Usuario o contraseña incorrectos');

            localStorage.setItem('usuarioLogueado', JSON.stringify(datos));
            location.href = 'pedidos.html';
            
        } catch (err) {
            // 4. En lugar de un alert(), pintamos el error directamente en el formulario
            if (typeof window.mostrarErrorServidorLogin === 'function') {
                window.mostrarErrorServidorLogin(err.message);
            } else {
                alert(err.message); // Fallback por seguridad
            }
        }
    });
}

function verificarPermisos() {
    let usuario = null;
    try { usuario = JSON.parse(localStorage.getItem('usuarioLogueado')); } catch (_) {}

    if (!usuario) {
        if (location.pathname !== '/' && !location.pathname.includes('index.html')) {
            location.href = '/';
        }
        return;
    }

    if (usuario.rol === 'repartidor' && (location.pathname.includes('stock') || location.pathname.includes('diario'))) {
        alert('No tienes permisos para acceder a este apartado.');
        location.href = 'pedidos.html';
    }
}

window.cerrarSesion = function() {
    localStorage.removeItem('usuarioLogueado');
    fetch('/api/logout', { method: 'POST' }).finally(() => {
        location.href = '/';
    });
}