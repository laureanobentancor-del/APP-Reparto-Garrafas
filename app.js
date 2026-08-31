// ==========================================
// LÓGICA DE CLIENTES
// ==========================================
if (document.getElementById('cuerpo-tabla-clientes')) {
    function cargarClientes() {
        fetch('/api/clientes')
            .then(res => res.json())
            .then(clientes => {
                const tbody = document.getElementById('cuerpo-tabla-clientes');
                tbody.innerHTML = '';
                clientes.forEach(c => {
                    tbody.innerHTML += `
                        <tr>
                            <td><strong>${c.nombre}</strong></td>
                            <td>${c.telefono}</td>
                            <td>${c.direccion || '-'}</td>
                            <td>
                                <button class="btn-accion btn-editar" onclick="editarCliente(${c.id}, '${c.nombre}', '${c.telefono}', '${c.direccion || ''}')">Editar</button>
                                <button class="btn-accion btn-eliminar" onclick="borrarCliente(${c.id})">Borrar</button>
                            </td>
                        </tr>
                    `;
                });
            });
    }

    window.abrirModalCliente = function() { 
        document.getElementById('titulo-modal-cliente').textContent = "Registrar Nuevo Cliente";
        document.getElementById('form-cliente').reset();
        document.getElementById('cliente-id').value = "";
        document.getElementById('modal-cliente').style.display = 'flex'; 
    }

    window.editarCliente = function(id, nombre, telefono, direccion) {
        document.getElementById('titulo-modal-cliente').textContent = "Editar Cliente";
        document.getElementById('cliente-id').value = id;
        document.getElementById('cliente-nombre').value = nombre;
        document.getElementById('cliente-telefono').value = telefono;
        document.getElementById('cliente-direccion').value = direccion;
        document.getElementById('modal-cliente').style.display = 'flex';
    }
    
    window.cerrarModalCliente = function() { 
        document.getElementById('modal-cliente').style.display = 'none'; 
    }

    document.getElementById('form-cliente').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('cliente-id').value;
        const data = {
            nombre: document.getElementById('cliente-nombre').value,
            telefono: document.getElementById('cliente-telefono').value,
            direccion: document.getElementById('cliente-direccion').value
        };

        if (id) {
            fetch(`/api/clientes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(() => {
                cerrarModalCliente();
                cargarClientes();
            });
        } else {
            fetch('/api/clientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(() => {
                cerrarModalCliente();
                cargarClientes();
            });
        }
    });

    window.borrarCliente = function(id) {
        if (confirm("¿Estás seguro de borrar este cliente?")) {
            fetch(`/api/clientes/${id}`, { method: 'DELETE' }).then(() => cargarClientes());
        }
    }

    cargarClientes();
}

// ==========================================
// LÓGICA DE STOCK
// ==========================================
if (document.getElementById('cuerpo-tabla-stock')) {
    function cargarStock() {
        fetch('/api/stock')
            .then(res => res.json())
            .then(stock => {
                const tbody = document.getElementById('cuerpo-tabla-stock');
                tbody.innerHTML = '';
                stock.forEach(s => {
                    const totalFisico = s.llenas + s.vacias;
                    tbody.innerHTML += `
                        <tr>
                            <td><strong>Garrafa de ${s.tipo}</strong></td>
                            <td style="color: #27ae60; font-weight: bold;">${s.llenas}</td>
                            <td style="color: #e67e22; font-weight: bold;">${s.vacias}</td>
                            <td>$${s.precio}</td>
                            <td>${totalFisico}</td>
                            <td>
                                <button class="btn-accion btn-editar" onclick="abrirModalStock('${s.tipo}', ${s.llenas}, ${s.vacias}, ${s.precio})">Editar</button>
                            </td>
                        </tr>
                    `;
                });
            });
    }

    window.abrirModalStock = function(tipo, llenas, vacias, precio) {
        document.getElementById('titulo-modal-stock').textContent = "Editar Stock - Garrafa de " + tipo;
        document.getElementById('stock-tipo').value = tipo;
        document.getElementById('stock-llenas').value = llenas;
        document.getElementById('stock-vacias').value = vacias;
        document.getElementById('stock-precio').value = precio;
        document.getElementById('modal-stock').style.display = 'flex';
    }

    window.cerrarModalStock = function() { 
        document.getElementById('modal-stock').style.display = 'none'; 
    }

    document.getElementById('form-stock').addEventListener('submit', (e) => {
        e.preventDefault();
        const tipo = document.getElementById('stock-tipo').value;
        const data = {
            llenas: parseInt(document.getElementById('stock-llenas').value),
            vacias: parseInt(document.getElementById('stock-vacias').value),
            precio: parseFloat(document.getElementById('stock-precio').value)
        };
        
        fetch(`/api/stock/${tipo}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(() => {
            cerrarModalStock();
            cargarStock();
        });
    });

    cargarStock();
}

// ==========================================
// LÓGICA DE PEDIDOS Y WHATSAPP
// ==========================================
if (document.getElementById('cuerpo-tabla-pedidos')) {
    function cargarPedidos() {
        fetch('/api/pedidos').then(res => res.json()).then(pedidos => {
            const tbody = document.getElementById('cuerpo-tabla-pedidos');
            tbody.innerHTML = '';
            pedidos.forEach(p => {
                tbody.innerHTML += `
                    <tr>
                        <td>#${p.id}</td>
                        <td><strong>${p.cliente_nombre}</strong><br><small>${p.cliente_telefono}</small></td>
                        <td>${p.tipo}</td>
                        <td>${p.cantidad}</td>
                        <td>$${p.total}</td>
                        <td><span onclick="cambiarEstado(${p.id}, '${p.estado}')" style="cursor:pointer; font-weight:bold; color:${p.estado==='Pendiente'?'#e67e22':'#27ae60'}">${p.estado}</span></td>
                        <td>
                            <button class="btn-accion btn-editar" onclick="editarPedido(${p.id}, '${p.tipo}', ${p.cantidad})">Editar</button> 
                            <button class="btn-accion btn-eliminar" onclick="borrarPedido(${p.id})">Borrar</button>
                        </td>
                    </tr>`;
            });
        });
    }

    window.chequearWhatsApp = function() {
        fetch('/api/whatsapp/qr').then(res => res.json()).then(data => {
            const txt = document.getElementById('whatsapp-estado');
            const qrDiv = document.getElementById('contenedor-qr');
            if (!txt || !qrDiv) return;
            if (data.estado === 'Conectado') {
                txt.textContent = "✅ WhatsApp Conectado";
                txt.style.color = "#27ae60";
                qrDiv.innerHTML = "";
            } else {
                txt.textContent = "⚠️ Escanea el QR";
                txt.style.color = "#e67e22";
                if (data.qr) qrDiv.innerHTML = `<img src="${data.qr}" style="width:140px; height:140px;">`;
            }
        });
    }

    window.reiniciarWhatsApp = function() {
        if (confirm("¿Seguro que deseas desvincular WhatsApp y generar un nuevo QR?")) {
            fetch('/api/whatsapp/reiniciar', { method: 'POST' })
                .then(res => res.json())
                .then(() => {
                    alert("Reiniciando conexión... Espera unos segundos y recarga la página.");
                    chequearWhatsApp();
                });
        }
    }

    window.abrirModalPedido = function() {
        document.getElementById('titulo-modal-pedido').textContent = "Nuevo Pedido Manual";
        document.getElementById('form-pedido').reset();
        document.getElementById('pedido-id').value = "";
        document.getElementById('grupo-cliente').style.display = "block";
        fetch('/api/clientes').then(res => res.json()).then(clientes => {
            const select = document.getElementById('pedido-cliente');
            select.innerHTML = '';
            clientes.forEach(c => select.innerHTML += `<option value="${c.id}">${c.nombre} (${c.telefono})</option>`);
            document.getElementById('modal-pedido').style.display = "flex";
        });
    }

    window.editarPedido = function(id, tipo, cantidad) {
        document.getElementById('titulo-modal-pedido').textContent = "Editar Pedido #" + id;
        document.getElementById('pedido-id').value = id;
        document.getElementById('grupo-cliente').style.display = "none";
        document.getElementById('pedido-tipo').value = tipo;
        document.getElementById('pedido-cantidad').value = cantidad;
        document.getElementById('modal-pedido').style.display = "flex";
    }

    window.cerrarModalPedido = function() { document.getElementById('modal-pedido').style.display = 'none'; }

    document.getElementById('form-pedido').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('pedido-id').value;
        const tipo = document.getElementById('pedido-tipo').value;
        const cantidad = document.getElementById('pedido-cantidad').value;
        if (id) {
            fetch(`/api/pedidos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, cantidad }) }).then(() => { cerrarModalPedido(); cargarPedidos(); });
        } else {
            fetch('/api/pedidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente_id: document.getElementById('pedido-cliente').value, tipo, cantidad }) }).then(() => { cerrarModalPedido(); cargarPedidos(); });
        }
    });

    window.borrarPedido = function(id) { if (confirm("¿Borrar pedido?")) fetch(`/api/pedidos/${id}`, { method: 'DELETE' }).then(() => cargarPedidos()); }
    
    window.cambiarEstado = function(id, estadoActual) {
        const nuevo = estadoActual === 'Pendiente' ? 'Completado' : 'Pendiente';
        fetch(`/api/pedidos/${id}/estado`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevo }) }).then(() => cargarPedidos());
    }

    cargarPedidos();
    chequearWhatsApp();
    setInterval(() => { cargarPedidos(); chequearWhatsApp(); }, 3000);
}