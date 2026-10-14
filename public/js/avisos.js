'use strict';

(function () {
    function obtenerContenedor() {
        let c = document.getElementById('contenedor-avisos');
        if (!c) {
            c = document.createElement('div');
            c.id = 'contenedor-avisos';
            c.className = 'toast-container position-fixed top-0 end-0 p-3';
            c.style.zIndex = '99999';
            document.body.appendChild(c);
        }
        return c;
    }

    // tipo: 'success' | 'danger' | 'warning' | 'info'
    window.mostrarAviso = function (mensaje, tipo) {
        tipo = tipo || 'success';
        const icono = { success: '✅', danger: '❌', warning: '⚠️', info: 'ℹ️' }[tipo] || '';

        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-bg-' + tipo + ' border-0';
        toast.setAttribute('role', 'alert');

        const flex = document.createElement('div');
        flex.className = 'd-flex';

        const cuerpo = document.createElement('div');
        cuerpo.className = 'toast-body';
        cuerpo.textContent = icono + ' ' + mensaje; // textContent evita inyección HTML

        const cerrar = document.createElement('button');
        cerrar.type = 'button';
        cerrar.className = 'btn-close btn-close-white me-2 m-auto';
        cerrar.setAttribute('data-bs-dismiss', 'toast');

        flex.append(cuerpo, cerrar);
        toast.appendChild(flex);
        obtenerContenedor().appendChild(toast);

        toast.addEventListener('hidden.bs.toast', () => toast.remove());
        new bootstrap.Toast(toast, { delay: 3500 }).show();
    };
})();