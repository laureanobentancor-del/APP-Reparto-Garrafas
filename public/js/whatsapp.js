'use strict';

async function chequearWhatsApp() {
    const txt = $('whatsapp-estado');
    const qrDiv = $('contenedor-qr');
    if (!txt || !qrDiv) return;

    try {
        const datos = await api('/api/whatsapp/qr');

        if (datos.estado === 'Conectado') {
            txt.textContent = '✅ WhatsApp Conectado';
            txt.style.color = '#27ae60';
            qrDiv.innerHTML = '';
        } else {
            txt.textContent = '⚠️ Escanea el QR para conectar';
            txt.style.color = '#e67e22';
            if (datos.qr) {
                qrDiv.innerHTML = '<img src="' + datos.qr + '" style="width:160px; height:160px;">';
            }
        }
    } catch (err) {
        console.error('Error al chequear WhatsApp:', err);
    }
}

window.reiniciarWhatsApp = async function () {
    if (!confirm('¿Seguro que deseas desvincular WhatsApp y generar un nuevo QR?')) return;
    try {
        await api('/api/whatsapp/reiniciar', { method: 'POST' });
        alert('Reiniciando conexión... Espera unos segundos y recarga la página.');
        chequearWhatsApp();
    } catch (err) {
        alert(err.message);
    }
};

function initWhatsApp() {
    if (!$('whatsapp-estado')) return;

    cuandoSeaVisible(() => {
        chequearWhatsApp();
        setInterval(() => {
            if (!document.hidden) chequearWhatsApp();
        }, 3000);
    });
}