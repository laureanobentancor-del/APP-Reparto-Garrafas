// Tiempo límite de inactividad en milisegundos (Ejemplo: 2 horas = 2 * 60 * 60 * 1000)
const TIEMPO_INACTIVIDAD = 2 * 60 * 60 * 1000; 

let temporizadorInactividad;

function reiniciarTemporizador() {
    // Cada vez que el usuario hace algo, borramos el temporizador anterior y lo ponemos en cero
    clearTimeout(temporizadorInactividad);
    
    temporizadorInactividad = setTimeout(() => {
        cerrarSesionPorInactividad();
    }, TIEMPO_INACTIVIDAD);
}

async function cerrarSesionPorInactividad() {
    try {
        // Opcional: Avisar al servidor que destruya la sesión
        await fetch('/api/logout', { method: 'POST' }); // Asegúrate de tener o crear esta ruta si lo deseas, o simplemente limpiar y redirigir
    } catch (e) {
        console.error("Error al cerrar sesión", e);
    }

    alert("Tu sesión se ha cerrado automáticamente por inactividad prolongada.");
    window.location.href = '/'; // Redirige al login o index principal
}

// Eventos que detectan si hay alguien usando la aplicación
const eventosUsuario = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];

eventosUsuario.forEach(evento => {
    window.addEventListener(evento, reiniciarTemporizador, true);
});

// Iniciar el temporizador al cargar la página
reiniciarTemporizador();