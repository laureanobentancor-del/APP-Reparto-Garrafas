// ==========================================
// CONTROL DE INACTIVIDAD (8 HORAS)
// ==========================================
const TIEMPO_INACTIVIDAD = 8 * 60 * 60 * 1000; // 8 horas exactas
let temporizadorInactividad;

function reiniciarTemporizador() {
    clearTimeout(temporizadorInactividad);
    
    temporizadorInactividad = setTimeout(() => {
        cerrarSesionPorInactividad();
    }, TIEMPO_INACTIVIDAD);
}

async function cerrarSesionPorInactividad() {
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (e) {
        console.error("Error al cerrar sesión", e);
    }

    alert("Tu sesión se ha cerrado automáticamente por inactividad prolongada (8 horas).");
    window.location.href = '/'; 
}

// Escuchamos la actividad del mouse, teclado y toques
['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'].forEach(evento => {
    window.addEventListener(evento, reiniciarTemporizador, true);
});

// Arranca el temporizador al cargar
reiniciarTemporizador();