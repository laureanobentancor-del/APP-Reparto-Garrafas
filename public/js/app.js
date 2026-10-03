
'use strict';

onListo(() => {
    // El orquestador ejecuta los módulos solo si existen en la página actual
    if (typeof verificarPermisos === 'function') verificarPermisos();
    if (typeof initLogin === 'function') initLogin();
    if (typeof initValidacionPassword === 'function') initValidacionPassword();
    if (typeof initClientes === 'function') initClientes();
    if (typeof initStock === 'function') initStock();
    if (typeof initPedidos === 'function') initPedidos();
    if (typeof initVentas === 'function') initVentas();
    if (typeof initDiario === 'function') initDiario();
    if (typeof initWhatsApp === 'function') initWhatsApp();
});