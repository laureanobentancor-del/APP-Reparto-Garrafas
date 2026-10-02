'use strict';

function initLogin() {
    const form = $('form-login');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuario: $('login-usuario').value,
                    password: $('login-password').value
                })
            });
            const datos = await res.json();
            if (!res.ok) throw new Error(datos.error || 'Error al iniciar sesión');

            localStorage.setItem('usuarioLogueado', JSON.stringify(datos));
            location.href = 'pedidos.html';
        } catch (err) {
            alert(err.message);
        }
    });
}

function verificarPermisos() {
    let usuario = null;
    try { usuario = JSON.parse(localStorage.getItem('usuarioLogueado')); } catch (_) {}

    if (!usuario) {
        if (!location.pathname.includes('login')) location.href = 'login.html';
        return;
    }

    if (usuario.rol === 'repartidor' && (location.pathname.includes('stock') || location.pathname.includes('diario'))) {
        alert('No tienes permisos para acceder a este apartado.');
        location.href = '/pedidos';
    }
}