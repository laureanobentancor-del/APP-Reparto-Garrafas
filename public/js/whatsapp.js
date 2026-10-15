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

/* ==========================================================
   Modal Bootstrap (#modal-reinicio-whatsapp en pedidos.html)
   Reemplaza los cuadros confirm() / alert() del navegador.
   Devuelve una promesa: true si el usuario apretó el botón principal,
   false si canceló o cerró el modal.
   opciones: { modo: 'confirmar' | 'info', icono, titulo, texto, aviso, textoConfirmar }
   ========================================================== */
function mostrarModalWhatsApp(o) {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('modal-reinicio-whatsapp');

        // Respaldo: si falta el modal o Bootstrap, se usa el cuadro nativo
        if (!modalEl || typeof bootstrap === 'undefined') {
            if (o.modo === 'info') { alert(o.texto); resolve(true); }
            else resolve(confirm(o.texto));
            return;
        }

        const esInfo = o.modo === 'info';
        const btnOk = modalEl.querySelector('[data-accion="confirmar"]');
        const btnNo = modalEl.querySelector('[data-accion="cancelar"]');
        const cajaAviso = modalEl.querySelector('.wa-reinicio-aviso');

        modalEl.classList.toggle('wa-modo-info', esInfo);
        modalEl.querySelector('.wa-reinicio-ico').textContent = o.icono;
        modalEl.querySelector('.wa-titulo-txt').textContent = o.titulo;
        modalEl.querySelector('.wa-reinicio-texto').textContent = o.texto;
        cajaAviso.textContent = o.aviso || '';
        cajaAviso.style.display = o.aviso ? '' : 'none';
        btnNo.style.display = esInfo ? 'none' : '';
        btnOk.textContent = o.textoConfirmar;

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        let confirmado = false;
        const alConfirmar = () => { confirmado = true; modal.hide(); };
        btnOk.addEventListener('click', alConfirmar);

        // Se resuelve cuando terminó de cerrarse (animación incluida)
        modalEl.addEventListener('hidden.bs.modal', () => {
            btnOk.removeEventListener('click', alConfirmar);
            resolve(confirmado);
        }, { once: true });

        modal.show();
    });
}

let reinicioWhatsAppEnCurso = false;

window.reiniciarWhatsApp = async function () {
    if (reinicioWhatsAppEnCurso) return;
    reinicioWhatsAppEnCurso = true;

    try {
        const confirmado = await mostrarModalWhatsApp({
            modo: 'confirmar',
            icono: '⚠️',
            titulo: 'Reiniciar WhatsApp',
            texto: '¿Estás seguro de que deseas reiniciar la sesión? Esto borrará el estado actual y generará un nuevo código QR para escanear.',
            aviso: '📱 Vas a tener que volver a vincular WhatsApp desde tu celular.',
            textoConfirmar: '🔄 Sí, reiniciar'
        });
        if (!confirmado) return;

        try {
            await api('/api/whatsapp/reiniciar', { method: 'POST' });
            chequearWhatsApp();
            await mostrarModalWhatsApp({
                modo: 'info',
                icono: '✅',
                titulo: 'Reiniciando conexión',
                texto: 'En unos segundos va a aparecer el nuevo código QR en el panel de WhatsApp. No hace falta recargar la página.',
                textoConfirmar: 'Entendido'
            });
        } catch (err) {
            await mostrarModalWhatsApp({
                modo: 'info',
                icono: '❌',
                titulo: 'No se pudo reiniciar',
                texto: err.message || 'Ocurrió un error al reiniciar WhatsApp.',
                textoConfirmar: 'Entendido'
            });
        }
    } finally {
        reinicioWhatsAppEnCurso = false;
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